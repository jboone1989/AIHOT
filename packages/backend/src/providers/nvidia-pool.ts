// NVIDIA hosted model availability: one synthetic JSON probe per five-minute tick.
// Independent from Ferro; the settings row is the shared state between API and worker.
import { z } from "zod";
import { sql } from "../db.ts";
import { credential } from "../config.ts";
import { chatJson, isNvidiaChatModel, ModelOutputError, MODELS } from "./llm.ts";
import { nvidiaCapability, nvidiaInventory, type NvidiaCapability, type NvidiaCatalogEntry } from "./nvidia-catalog.ts";
import { BudgetExceededError, ProviderRejectedError, ReceiptUnknownError } from "./receipts.ts";
import { eligibleFallback, modelCircuitOpen, trafficFailureRate, conservativeFailureRisk, EMPTY_TRAFFIC, probeAttemptTag, type ModelTraffic } from "./nvidia-routing.ts";

const KEY="nvidia.model_pool.v1";
const TTL=4*3600_000, CATALOG_TTL=2*3600_000;
const preferred=[
 "openai/gpt-oss-20b","nvidia/nemotron-3.5-lightning-30b-a3b",
 "z-ai/glm-5.3-flash","google/gemma-4-31b-it","deepseek-ai/deepseek-v4.1-flash",
 "mistralai/mistral-nemotron","nvidia/nemotron-3-super-120b-a12b",
 "meta/llama-3.3-70b-instruct","openai/gpt-oss-120b"
];
export type Health={model:string;ok:boolean;checkedAt:string;lastOk?:string;latencyMs?:number;reason?:string;samples:number;visionVerified?:boolean};
export type Pool={catalogVersion?:number;catalogAt:string|null;catalogCount:number;candidates:string[];inventory?:Record<NvidiaCapability,string[]>;health:Record<string,Health>;probes:number};
const empty=():Pool=>({catalogAt:null,catalogCount:0,candidates:preferred,health:{},probes:0});
const age=(t:string|null|undefined,now:number)=>t?now-Date.parse(t):Infinity;
export function healthyModels(s:Pool,now=Date.now()):Health[]{
 return Object.values(s.health).filter(h=>h.ok&&age(h.lastOk,now)<TTL&&s.candidates.includes(h.model))
  .sort((a,b)=>(a.latencyMs??99999)-(b.latencyMs??99999));
}
/** Request and fallback must belong to the same capability pool; real healthy evidence
 * admits any matching text model, rather than a permanent three-name whitelist. */
export function chooseModel(s:Pool,preferredModel:string,now=Date.now(),traffic:Record<string,ModelTraffic>={}):string|null{
 const spec=MODELS[preferredModel], wanted=spec?.model??"";
 const capability: NvidiaCapability=spec?.vision?"vision":"text";
 const candidates=healthyModels(s,now).filter(h=>
   nvidiaCapability(h.model)===capability &&
   (capability!=="vision"||h.visionVerified===true) &&
   eligibleFallback(h.model,wanted));
 const viable=candidates.filter(h=>!modelCircuitOpen(traffic[h.model]??EMPTY_TRAFFIC));
 if(viable.some(h=>h.model===wanted))return wanted;
 return viable.sort((a,b)=>conservativeFailureRisk(traffic[a.model]??EMPTY_TRAFFIC)-
   conservativeFailureRisk(traffic[b.model]??EMPTY_TRAFFIC)||
   (a.latencyMs??99999)-(b.latencyMs??99999))[0]?.model??null;
}
/** One real probe per tick, prioritizing untested candidates across both chat pools. */
export function nextProbe(s:Pool,now=Date.now(),discover=true):string|null{
 const list=[...new Set(s.candidates)].filter(isNvidiaChatModel);
 const fresh=healthyModels(s,now);
 const refresh=list.filter(id=>s.health[id]?.ok && age(s.health[id]!.checkedAt,now)>=50*60_000)
   .sort((a,b)=>Date.parse(s.health[a]!.checkedAt)-Date.parse(s.health[b]!.checkedAt));
 const untested=discover?list.filter(id=>!s.health[id]):[];
 // Continuous rotation: retain enough fresh working models while spending one
 // in four probe slots on unexplored models. Failures are retried after cooldown.
 if(refresh.length && (fresh.length<3 || s.probes%4!==0))return refresh[0]!;
 if(untested.length)return untested[0]!;
 if(refresh.length)return refresh[0]!;
 const failed=list.filter(id=>s.health[id]&&!s.health[id]!.ok&&age(s.health[id]!.checkedAt,now)>=60*60_000)
   .sort((a,b)=>Date.parse(s.health[a]!.checkedAt)-Date.parse(s.health[b]!.checkedAt));
 return failed[0]??null;
}
let cached:{at:number;data:Pool}|null=null;
async function read():Promise<Pool>{
 if(cached&&Date.now()-cached.at<15000)return cached.data;
 const [row]=await sql<{value:Pool}[]>`SELECT value FROM settings WHERE key = ${KEY}`;
 const data=row?.value&&Array.isArray(row.value.candidates)?row.value:empty();
 cached={at:Date.now(),data};return data;
}
async function save(s:Pool){
 await sql`INSERT INTO settings (key,value,updated_by) VALUES (${KEY},${sql.json(s as never)},'nvidia-monitor')
 ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=now()`;
 cached={at:Date.now(),data:s};
}
let trafficCache:{at:number;data:Record<string,ModelTraffic>}|null=null;
/** Each actual paid request is counted once by its current receipt status.
 * Probe calls are excluded: cheap synthetic probes must not overwhelm real failure evidence. */
export async function recentModelTraffic():Promise<Record<string,ModelTraffic>>{
 if(trafficCache&&Date.now()-trafficCache.at<15_000)return trafficCache.data;
 const rows=await sql<{model:string;status:string;count:number}[]>`
   SELECT model,status,count(*)::int AS count FROM receipts
   WHERE service='nvidia' AND model IS NOT NULL AND purpose<>'nvidia_model_probe'
     AND updated_at>now()-interval '2 hours'
     AND status IN ('completed','received','unknown','failed')
   GROUP BY model,status`;
 const data:Record<string,ModelTraffic>={};
 for(const r of rows){
   const stats=data[r.model]??={...EMPTY_TRAFFIC};
   stats[r.status as keyof ModelTraffic]=r.count;
 }
 trafficCache={at:Date.now(),data};return data;
}
export async function availableModel(preferredModel:string):Promise<string>{
 const [pool,traffic]=await Promise.all([read(),recentModelTraffic()]);
 const id=chooseModel(pool,preferredModel,Date.now(),traffic);
 if(!id)throw new BudgetExceededError("nvidia","waiting_for_healthy_model",300);
 if(MODELS[preferredModel]?.model!==id)
   console.warn("nvidia_model_fallback",JSON.stringify({stepModel:preferredModel,selected:id,reason:"unhealthy_or_circuit_open"}));
 return "nvidia:"+id;
}
export async function poolOverview(){
 const [s,traffic]=await Promise.all([read(),recentModelTraffic()]);
 return {catalogCount:s.catalogCount,catalogAt:s.catalogAt,candidates:s.candidates.length,probes:s.probes,
 inventory:Object.fromEntries(Object.entries(s.inventory??nvidiaInventory(s.candidates.map(id=>({id})))).map(([k,ids])=>[k,{total:ids.length,healthy:ids.filter(id=>s.health[id]?.ok && age(s.health[id]?.lastOk,Date.now())<TTL).length}])),
 healthy:healthyModels(s).map(h=>({model:h.model,capability:nvidiaCapability(h.model),visionVerified:!!h.visionVerified,latencyMs:h.latencyMs,checkedAt:h.checkedAt,
   circuitOpen:modelCircuitOpen(traffic[h.model]??EMPTY_TRAFFIC),
   failureRate:trafficFailureRate(traffic[h.model]??EMPTY_TRAFFIC),
   last2h:traffic[h.model]??EMPTY_TRAFFIC})),
 lastChecks:Object.values(s.health).map(h=>({model:h.model,ok:h.ok,reason:h.reason,checkedAt:h.checkedAt}))};
}
async function catalog(s:Pool){
 if(s.catalogVersion===3&&age(s.catalogAt,Date.now())<CATALOG_TTL)return;
 const key=credential("models","NVIDIA_API_KEY"),url=credential("models","NVIDIA_BASE_URL");
 if(!key||!url)throw Error("NVIDIA not configured");
 const response=await fetch(url.replace(/\/$/,"")+"/models",{
   headers:{authorization:"Bearer "+key,accept:"application/json"},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error("NVIDIA catalog HTTP "+response.status);
 const data=await response.json() as {data?:NvidiaCatalogEntry[]};
 const all=(data.data??[]).filter(x=>x.id);
 const inventory=nvidiaInventory(all);
 // Retain every discovered entry; unknown/specialized models stay visible but cannot
 // accidentally be called as a chat completion or substituted for embeddings.
 s.inventory=inventory;s.catalogVersion=3;s.catalogCount=all.length;s.catalogAt=new Date().toISOString();
 const chat=[...inventory.text,...inventory.vision];
 s.candidates=[...preferred.filter(x=>chat.includes(x)),...chat.filter(x=>!preferred.includes(x))];
}
// A successfully completed real editorial call is stronger evidence than a
// synthetic health ping. Reuse existing durable receipts without extra API cost.
async function mergeLiveSuccesses(s:Pool):Promise<void>{
 const rows=await sql<{model:string;last_ok:Date;samples:number}[]>`
   SELECT model,max(updated_at) AS last_ok,count(*)::int AS samples
   FROM receipts WHERE service='nvidia' AND status='completed' AND purpose<>'nvidia_model_probe'
     AND updated_at > now() - interval '4 hours'
   GROUP BY model`;
 for(const r of rows){
   if(!isNvidiaChatModel(r.model)||!s.candidates.includes(r.model))continue;
   const at=new Date(r.last_ok).toISOString();
   const old=s.health[r.model];
   if(old && Date.parse(old.checkedAt)>=Date.parse(at))continue;
   s.health[r.model]={model:r.model,ok:true,checkedAt:at,lastOk:at,
     latencyMs:old?.latencyMs??7000,reason:"real_completed_request",
     samples:Math.max(old?.samples??0,r.samples)};
 }
}
const schema=z.object({label:z.literal("PASS"),titleZh:z.string().min(4),summaryZh:z.string().min(6)});
const prompt='模拟消息：An AI research lab publishes an open-source model with reduced energy use in translation tests. 返回JSON对象：label固定为PASS，titleZh为中文标题，summaryZh为中文简短摘要。不允许添加未给出的事实。';
export async function probeNvidiaPool(){
 if(process.env.NVIDIA_MODEL_POOL_ENABLED!=="true"||process.env.MODEL_CALLS_ENABLED!=="true")return {state:"disabled"};
 const s=structuredClone(await read());
 try{await catalog(s);}catch(e){console.warn("NVIDIA catalogue refresh skipped",String(e).slice(0,120));}
 await mergeLiveSuccesses(s);
 const model=nextProbe(s,Date.now(),process.env.NVIDIA_MODEL_DISCOVERY_PROBES_ENABLED!=="false");
 if(!model){await save(s);return {state:"no_candidate",catalogCount:s.catalogCount};}
 let reason="ok",ok=false;const started=Date.now();
 try {
   const vision=nvidiaCapability(model)==="vision";
   const image=[{type:"text" as const,text:prompt},{type:"image_url" as const,image_url:{url:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jcWQAAAAASUVORK5CYII="}}];
   const result=await chatJson({model:"nvidia:"+model,purpose:"nvidia_model_probe",
     subject:"nvidia:"+model+":"+new Date().toISOString().slice(0,16),
     // subject is audit-only; attemptTag is part of the durable logical key.
     // Without this a year-old successful probe is reused in 3ms as false proof of health.
     attemptTag:probeAttemptTag(new Date()),
     promptVersion:"nvidia-probe.v2",system:"Return JSON only.",user:vision?image:prompt,
     schema,temperature:0,maxTokens:512,timeoutMs:18000});
   ok=/[\u4e00-\u9fff]/.test(result.data.titleZh+result.data.summaryZh);
   if(!ok)reason="non_chinese";
 }catch(e){
   if(e instanceof BudgetExceededError){await save(s);return {state:"budget_wait",model};}
   reason=e instanceof ModelOutputError?"invalid_json":
     e instanceof ProviderRejectedError&&e.status===429?"rate_limit":
     e instanceof ProviderRejectedError?"upstream_http":
     e instanceof ReceiptUnknownError||/timeout|abort/i.test(String(e))?"timeout":"unavailable";
 }
 const old=s.health[model];s.health[model]={model,ok,checkedAt:new Date().toISOString(),
   lastOk:ok?new Date().toISOString():old?.lastOk,latencyMs:ok?Date.now()-started:old?.latencyMs,
   reason,samples:(old?.samples??0)+1,visionVerified:ok&&nvidiaCapability(model)==="vision"?true:old?.visionVerified};
 s.probes++;await save(s);
 return {state:reason,model,latencyMs:Date.now()-started,healthy:healthyModels(s).length,catalogCount:s.catalogCount,candidates:s.candidates.length};
}
