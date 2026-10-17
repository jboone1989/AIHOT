#!/usr/bin/env node
/** Golden AIHOT tasks on cn-dev: observed quality, not model size or naming.
 * Output only pass/fail, latency, first token, finish. Never log model responses or secrets.
 */
import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
for(const line of (existsSync('.env')?readFileSync('.env','utf8'):'').split(/\r?\n/)){
 const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'');
}
const key=process.env.NVIDIA_API_KEY,base=(process.env.NVIDIA_BASE_URL||'https://integrate.api.nvidia.com/v1').replace(/\/$/,'');if(!key)throw Error('dev credential missing');
const models=[
{id:'openai/gpt-oss-20b',level:'light',extra:{reasoning_effort:'low'},timeout:90000},
{id:'nvidia/nemotron-3.5-lightning-30b-a3b',level:'medium',extra:{temperature:1,top_p:.95,reasoning_budget:768},timeout:150000},
{id:'nvidia/nemotron-3-super-120b-a12b',level:'heavy',extra:{temperature:1,top_p:.95,reasoning_effort:'low',reasoning_budget:1024},timeout:150000},
{id:'stepfun-ai/step-5-preview',level:'heavy',extra:{},timeout:180000}
];
const cases=[
 {task:'news_filter',difficulty:'light',prompt:'A headline says: "Bitcoin ETF recorded $25M inflow on Friday." Return exactly one word, CRYPTO, AI or OTHER.',check:t=>/\bCRYPTO\b/i.test(t)},
 {task:'entity_extraction',difficulty:'light',prompt:'Extract organization, product, investment amount from this sentence: "On October 16, Example Labs invested $12 million in Nova AI." Reply compact JSON {"organization":...,"product":...,"amount_usd":...}.',check:t=>/Example Labs/i.test(t)&&/Nova AI/i.test(t)&&(/12000000|12 million|12,000,000/i.test(t))},
 {task:'event_linking',difficulty:'medium',prompt:'Event A: Acme announced Model X on June 1. Event B: Acme changed Model X pricing on June 2. Are these EXACT_SAME_EVENT, RELATED_FOLLOWUP, or UNRELATED? Reply one of the three labels only.',check:t=>/\bRELATED_FOLLOWUP\b/.test(t)&&!/\bEXACT_SAME_EVENT\b/.test(t)},
 {task:'numerical_reasoning',difficulty:'heavy',prompt:'A portfolio bought 100 units at $2 and 50 more units at $3, with no fees. What is the weighted average cost per unit? Reply with the numeric answer only to three decimal places.',check:t=>/\b2\.333\b/.test(t)}
];
function contentFromEvent(e){
 const ch=e.choices?.[0]||{},d=ch.delta||{},m=ch.message||{};
 return {text:typeof d.content==='string'?d.content:typeof m.content==='string'?m.content:'',finish:ch.finish_reason||null};
}
async function probe(model,sample){
 const now=Date.now();let code=null,body='',finish=null,reason='',tokens=null;
 const input={model:model.id,messages:[{role:'user',content:sample.prompt}],max_tokens:1200,stream:true,...model.extra};
 try{
  const res=await fetch(base+'/chat/completions',{method:'POST',headers:{authorization:'Bearer '+key,accept:'text/event-stream','content-type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(model.timeout)});code=res.status;
  if(!res.ok){let err=(await res.text()).slice(0,200);try{err=JSON.parse(err).error?.code||'HTTP '+code}catch{err='HTTP '+code};reason=String(err).slice(0,60)}
  else {
   const reader=res.body.getReader();const dec=new TextDecoder();let tail='',completed=false;
   while(!completed){
    const {done,value}=await reader.read();if(done)break;
    tail+=dec.decode(value,{stream:true});const lines=tail.split(/\r?\n/);tail=lines.pop()||'';
    for(const line of lines){if(!line.startsWith('data:'))continue;const chunk=line.slice(5).trim();if(chunk==='[DONE]'){completed=true;break}
     try{const datum=JSON.parse(chunk);const c=contentFromEvent(datum);body+=c.text;finish=c.finish||finish}catch{}
    }
   }
  }
 }catch(e){reason=e?.name==='TimeoutError'?'timeout':String(e).slice(0,60)}
 const passed=code===200&&sample.check(body);const out={model:model.id,tier:model.level,task:sample.task,difficulty:sample.difficulty,http:code,elapsed_ms:Date.now()-now,answer_chars:body.length,pass:passed,finish,reason};
 console.log(JSON.stringify(out));return out;
}
const tasks=models.flatMap(m=>cases.map(c=>({m,c})));let cursor=0,results=[];
async function work(){while(cursor<tasks.length){const {m,c}=tasks[cursor++];results.push(await probe(m,c));}}
await Promise.all([work(),work()]);
mkdirSync('var/nvidia-audit',{recursive:true});
const result={date:new Date().toISOString(),environment:'cn-dev',task_cases:cases.length,models:models.length,results:results.sort((a,b)=>a.model.localeCompare(b.model)||a.task.localeCompare(b.task))};
writeFileSync('var/nvidia-audit/aihot-task-fit.json',JSON.stringify(result,null,2)+'\n');
console.log('TASK_FIT',JSON.stringify({cases:results.length,success:results.filter(r=>r.pass).length,by_model:Object.fromEntries(models.map(m=>[m.id,results.filter(r=>r.model===m.id&&r.pass).length])),output:'var/nvidia-audit/aihot-task-fit.json'}));
