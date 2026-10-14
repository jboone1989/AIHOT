// NVIDIA hosted model availability: one synthetic JSON probe per five-minute tick.
// Independent from Ferro; the settings row is the shared state between API and worker.
import { z } from "zod";
import { sql } from "../db.ts";
import { credential } from "../config.ts";
import { chatJson, ModelOutputError } from "./llm.ts";
import { BudgetExceededError, ProviderRejectedError, ReceiptUnknownError } from "./receipts.ts";

const KEY="nvidia.model_pool.v1";
const TTL=4*3600_000, CATALOG_TTL=2*3600_000, MAX=100;
const preferred=[
 "openai/gpt-oss-20b","nvidia/nemotron-3.5-lightning-30b-a3b",
 "z-ai/glm-5.3-flash","google/gemma-4-31b-it","deepseek-ai/deepseek-v4.1-flash",
 "mistralai/mistral-nemotron","nvidia/nemotron-3-super-120b-a12b",
 "meta/llama-3.3-70b-instruct","openai/gpt-oss-120b"
];
export const isTextModel=(id:string)=>/^[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(id)
 && /gpt-oss|nemotron|glm-|gemma-|llama-|deepseek|mistral|qwen|kimi|granite/i.test(id)
 && !/embed|rerank|retriev|audio|speech|video|image|diffusion|safety|guard|moderation|ocr|vlm|vision|detector|coder|codegemma|codellama|reward/i.test(id);
export type Health={model:string;ok:boolean;checkedAt:string;lastOk?:string;latencyMs?:number;reason?:string;samples:number};
export type Pool={catalogVersion?:number;catalogAt:string|null;catalogCount:number;candidates:string[];health:Record<string,Health>;probes:number};
const empty=():Pool=>({catalogAt:null,catalogCount:0,candidates:preferred,health:{},probes:0});
const age=(t:string|null|undefined,now:number)=>t?now-Date.parse(t):Infinity;
export function healthyModels(s:Pool,now=Date.now()):Health[]{
 return Object.values(s.health).filter(h=>h.ok&&age(h.lastOk,now)<TTL&&s.candidates.includes(h.model))
  .sort((a,b)=>(a.latencyMs??99999)-(b.latencyMs??99999));
}
export function chooseModel(s:Pool,preferredModel:string,now=Date.now()):string|null{
 const ok=healthyModels(s,now);if(!ok.length)return null;
 const wanted=preferredModel==="nvidia-gpt-oss-20b"?"openai/gpt-oss-20b":
 preferredModel==="nvidia-nemotron-lightning"?"nvidia/nemotron-3.5-lightning-30b-a3b":
 preferredModel==="nvidia-glm-5.3-flash"?"z-ai/glm-5.3-flash":"";
 return ok.some(h=>h.model===wanted)?wanted:ok[0]!.model;
}
export function nextProbe(s:Pool,now=Date.now()):string|null{
 const list=s.candidates.filter(isTextModel);
 const recheck=list.filter(id=>s.health[id]?.ok&&age(s.health[id]!.checkedAt,now)>=50*60_000);
 if(recheck.length)return recheck.sort((a,b)=>age(s.health[b]?.checkedAt,now)-age(s.health[a]?.checkedAt,now))[0]!;
 const due=list.filter(id=>!s.health[id]||age(s.health[id]!.checkedAt,now)>=20*60_000);
 return due.sort((a,b)=>{
   if(!s.health[a]&&s.health[b])return -1;
   if(s.health[a]&&!s.health[b])return 1;
   return age(s.health[b]?.checkedAt,now)-age(s.health[a]?.checkedAt,now);
 })[0]??null;
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
export async function availableModel(preferredModel:string):Promise<string>{
 const id=chooseModel(await read(),preferredModel);
 if(!id)throw new BudgetExceededError("nvidia","waiting_for_healthy_model",300);
 return "nvidia:"+id;
}
export async function poolOverview(){
 const s=await read();
 return {catalogCount:s.catalogCount,catalogAt:s.catalogAt,candidates:s.candidates.length,probes:s.probes,
 healthy:healthyModels(s).map(h=>({model:h.model,latencyMs:h.latencyMs,checkedAt:h.checkedAt})),
 lastChecks:Object.values(s.health).map(h=>({model:h.model,ok:h.ok,reason:h.reason,checkedAt:h.checkedAt}))};
}
async function catalog(s:Pool){
 if(s.catalogVersion===2&&age(s.catalogAt,Date.now())<CATALOG_TTL)return;
 const key=credential("models","NVIDIA_API_KEY"),url=credential("models","NVIDIA_BASE_URL");
 if(!key||!url)throw Error("NVIDIA not configured");
 const response=await fetch(url.replace(/\/$/,"")+"/models",{
   headers:{authorization:"Bearer "+key,accept:"application/json"},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error("NVIDIA catalog HTTP "+response.status);
 const data=await response.json() as {data?:Array<{id?:string}>};
 const all=(data.data??[]).map(x=>x.id??"").filter(Boolean);
 const ids=[...new Set(all.filter(isTextModel))];
 s.catalogVersion=2;s.catalogCount=all.length;s.catalogAt=new Date().toISOString();
 s.candidates=[...preferred.filter(x=>ids.includes(x)),...ids.filter(x=>!preferred.includes(x))].slice(0,MAX);
}
// A successfully completed real editorial call is stronger evidence than a
// synthetic health ping. Reuse existing durable receipts without extra API cost.
async function mergeLiveSuccesses(s:Pool):Promise<void>{
 const rows=await sql<{model:string;last_ok:Date;samples:number}[]>`
   SELECT model,max(updated_at) AS last_ok,count(*)::int AS samples
   FROM receipts WHERE service='nvidia' AND status='completed'
     AND updated_at > now() - interval '4 hours'
   GROUP BY model`;
 for(const r of rows){
   if(!isTextModel(r.model)||!s.candidates.includes(r.model))continue;
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
 const model=nextProbe(s);
 if(!model){await save(s);return {state:"no_candidate",catalogCount:s.catalogCount};}
 let reason="ok",ok=false;const started=Date.now();
 try {
   const result=await chatJson({model:"nvidia:"+model,purpose:"nvidia_model_probe",
     subject:"nvidia:"+model+":"+new Date().toISOString().slice(0,16),
     promptVersion:"nvidia-probe.v1",system:"Return JSON only.",user:prompt,
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
   reason,samples:(old?.samples??0)+1};
 s.probes++;await save(s);
 return {state:reason,model,latencyMs:Date.now()-started,healthy:healthyModels(s).length,catalogCount:s.catalogCount,candidates:s.candidates.length};
}
