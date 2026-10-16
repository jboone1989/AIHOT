#!/usr/bin/env node
/**
 * Development-only NVIDIA catalogue audit.
 * Uses the API-key already configured on the development host; never logs it.
 * Does not touch service configuration, production DB or app model routing.
 *
 * node scripts/nvidia-official-audit.mjs --inventory
 * node scripts/nvidia-official-audit.mjs --all
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

function envFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file,'utf8').split(/\r?\n/)) {
    const m=line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    let v=m[2].trim();
    if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
    process.env[m[1]]=v;
  }
}
envFile('.env');
const key=process.env.NVIDIA_API_KEY;
const base=(process.env.NVIDIA_BASE_URL||'https://integrate.api.nvidia.com/v1').replace(/\/$/,'');
if(!key || !base.startsWith('https://')) throw Error('Development NVIDIA_API_KEY / HTTPS base URL not configured');
const outDir=process.env.NVIDIA_AUDIT_OUT||'var/nvidia-audit';
mkdirSync(outDir,{recursive:true});
const record=join(outDir,'model-results.ndjson');
const controller=()=>AbortSignal.timeout(26000);
const img='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jcWQAAAAASUVORK5CYII=';
const ref={
  text:'https://docs.api.nvidia.com/nim/reference/llm-apis',
  vision:'https://docs.api.nvidia.com/nim/reference/multimodal-apis',
  embedding:'https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-embed-1b-infer',
  rerank:'https://docs.api.nvidia.com/nim/reference/nvidia-llama-nemotron-rerank-1b-v2-infer',
  image:'https://docs.api.nvidia.com/nim/reference/black-forest-labs-flux_1-kontext-dev-infer',
  document:'https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-parse-infer',
  safety:'https://docs.api.nvidia.com/nim/reference/meta-llama-guard-4-12b-infer',
  audio:'https://docs.api.nvidia.com/nim/reference/models-1',
  unknown:'https://docs.api.nvidia.com/nim/reference/models-1'
};
const classify=e=>{
 const id=(e.id||'').toLowerCase(),tag=[e.task||'',e.type||'',JSON.stringify(e.capabilities||'')].join(' ').toLowerCase(),s=id+' '+tag;
 if(/rerank|re-rank/.test(s))return 'rerank';
 if(/embed|text.embedding|vector.representation/.test(s))return 'embedding';
 if(/speech|audio|asr|tts|transcri|whisper|parakeet|canary|diariz/.test(s))return 'audio';
 if(/ocr|document|table.extract|layout.detect|paddleocr|nv-yolo|nemotron-parse/.test(s))return 'document';
 if(/diffusion|image.generation|text.to.image|flux|stable-diffusion|sana-|edify/.test(s))return 'image';
 if(/safety|moderation|guard|shield|content.filter|reward.model/.test(s))return 'safety';
 if(/vision|multimodal|image.understanding|visual.question|[-/]vl[-/]|-vl-|omni/.test(s)||id==='z-ai/glm-5.3-flash')return 'vision';
 if(/chat|completion|language.model|text.generation|text-generation/.test(tag)||/gpt|nemotron|glm|gemma|llama|deepseek|mistral|qwen|kimi|granite|phi-|command-|olmo|yi-|internlm|falcon|starcoder|coder/.test(id))return 'text';
 return 'unknown';
};
async function request(path,body,host=base,timeout=controller()){
 const t=Date.now();
 try {
  const r=await fetch(host+path,{method:'POST',headers:{authorization:'Bearer '+key,accept:'application/json','content-type':'application/json'},body:JSON.stringify(body),signal:timeout});
  const raw=(await r.text()).slice(0,130000);
  let data;try{data=JSON.parse(raw)}catch{data=null}
  return {http:r.status,ms:Date.now()-t,data,error:r.ok?null:(data?.error?.message||data?.detail||data?.title||raw.slice(0,200)).slice(0,230)};
 } catch(e){return {http:null,ms:Date.now()-t,data:null,error:e?.name==='TimeoutError'?'timeout':String(e).slice(0,150)}}
}
function brief(r,mode){
 const info={mode,http:r.http,ms:r.ms};
 if(r.error)info.error=r.error;
 if(r.http===200){
  if(mode==='embedding') {const v=r.data?.data?.[0]?.embedding;info.dim=Array.isArray(v)?v.length:null;info.valid=Array.isArray(v)&&v.length>0;}
  else if(mode==='rerank')info.valid=Array.isArray(r.data?.rankings)||Array.isArray(r.data?.data);
  else if(mode==='image')info.valid=!!r.data&&(!!r.data.artifacts||!!r.data.image||!!r.data.data);
  else {let m=r.data?.choices?.[0]?.message;info.finish=r.data?.choices?.[0]?.finish_reason||null;info.valid=!!m&&(typeof m.content==='string'?m.content.trim().length>0:Array.isArray(m.content)?m.content.length>0:!!m.reasoning_content||!!m.reasoning);}
 }
 return info;
}
async function check(e){
 const id=e.id,kind=classify(e);
 const result={id,kind,docs:ref[kind],checked_at:new Date().toISOString(),probes:[]};
 if(kind==='embedding'){
   let r=await request('/embeddings',{model:id,input:['NVIDIA API model audit text'],input_type:'passage',encoding_format:'float'});
   result.probes.push(brief(r,'embedding'));
   if([400,422].includes(r.http)&&/input_type|unsupported|not allowed|extra field/i.test(r.error||'')){
     r=await request('/embeddings',{model:id,input:['NVIDIA API model audit text'],encoding_format:'float'});
     result.probes.push(brief(r,'embedding'));
   }
 } else if(kind==='rerank'){
   const host='https://ai.api.nvidia.com';
   const path='/v1/retrieval/'+id+'/reranking';
   const r=await request(path,{model:id,query:{text:'NVIDIA'},passages:[{text:'NVIDIA provides AI inference services'}],truncate:'END'},host);
   result.probes.push(brief(r,'rerank'));
 } else if(kind==='image'&&id==='black-forest-labs/flux.1-kontext-dev'){
   const r=await request('/v1/genai/'+id,{prompt:'Simple flat blue circle',image:'data:image/png;example_id,0',width:1024,height:1024,steps:20},'https://ai.api.nvidia.com');
   result.probes.push(brief(r,'image'));
 } else if(kind==='image'||kind==='audio'){
   result.note='not_probed: model-specific media payload/endpoint required; catalogue listing alone is not evidence';
 } else {
   const r=await request('/chat/completions',{model:id,messages:[{role:'user',content:kind==='safety'?'Hello, please evaluate this harmless greeting.':'Reply briefly: OK'}],max_tokens:256,stream:false});
   result.probes.push(brief(r,kind==='safety'?'safety':'text'));
   if(kind==='vision'&&r.http===200){
     const v=await request('/chat/completions',{model:id,messages:[{role:'user',content:[{type:'text',text:'Describe the attached image in five words.'},{type:'image_url',image_url:{url:img}}]}],max_tokens:256,stream:false});
     result.probes.push(brief(v,'vision'));
   }
   if(kind==='unknown')result.note='chat endpoint exploratory only: failures do not establish this model cannot run on its actual API';
   if(kind==='document')result.note='chat text-only is a connectivity check, NOT a valid document extraction proof; needs a full-resolution document image';
 }
 const statuses=result.probes;
 result.verdict=statuses.some(s=>s.http===200&&s.valid) ? 'verified_response' :
     statuses.some(s=>s.http===202) ? 'pending_async' :
     statuses.some(s=>s.http===429||s.http===503) ? 'capacity_or_rate_limited':
     statuses.some(s=>s.http===401||s.http===403) ? 'auth_restricted':
     statuses.some(s=>s.http===404) ? 'endpoint_404':
     statuses.some(s=>s.http===200) ? 'responded_but_output_unusable':
     statuses.some(s=>s.http===400||s.http===422) ? 'payload_or_adapter_rejected':
     statuses.some(s=>s.http===null) ? 'timeout_or_network':
     statuses.length ? 'other_http_failure' : 'not_tested_adapter_unknown';
 appendFileSync(record,JSON.stringify(result)+'\n');
 process.stdout.write(JSON.stringify({model:id,kind,verdict:result.verdict,http:statuses.map(s=>s.http)})+'\n');
 return result;
}
const catalogue=await fetch(base+'/models',{headers:{authorization:'Bearer '+key,accept:'application/json'},signal:AbortSignal.timeout(18000)});
if(!catalogue.ok)throw Error('catalogue HTTP '+catalogue.status);
const response=await catalogue.json();
const entries=(response.data||[]).filter(e=>e.id).sort((a,b)=>a.id.localeCompare(b.id));
writeFileSync(join(outDir,'catalogue.json'),JSON.stringify({observed_at:new Date().toISOString(),count:entries.length,entries},null,2));
console.log('CATALOGUE',JSON.stringify({count:entries.length,kinds:entries.reduce((a,e)=>(a[classify(e)]=(a[classify(e)]||0)+1,a),{})}));
if(process.argv.includes('--inventory'))process.exit(0);
writeFileSync(record,'');
const limit=Number((process.argv.find(x=>x.startsWith('--limit='))||'--limit='+entries.length).split('=')[1]);
const target=entries.slice(0,Number.isFinite(limit)?Math.max(0,limit):entries.length);
let next=0;let stopped=false;const results=[];
async function work(){
 while(!stopped){
  const index=next++;if(index>=target.length)return;
  const r=await check(target[index]);results.push(r);
  if(r.probes.some(p=>p.http===401||p.http===403)){stopped=true;console.error('Stopping: authentication error')}
  await new Promise(resolve=>setTimeout(resolve,700));
 }
}
await Promise.all(Array.from({length:Math.min(3,target.length)},()=>work()));
const totals=results.reduce((a,r)=>(a[r.verdict]=(a[r.verdict]||0)+1,a),{});
const summary={checked_at:new Date().toISOString(),catalogue_count:entries.length,attempted:results.length,by_verdict:totals,models:results.sort((a,b)=>a.id.localeCompare(b.id))};
writeFileSync(join(outDir,'summary.json'),JSON.stringify(summary,null,2));
console.log('SUMMARY',JSON.stringify({catalogue_count:entries.length,attempted:results.length,by_verdict:totals,output:outDir}));
