#!/usr/bin/env node
/** Official-example-aligned, development-only NVIDIA rechecks for slow and reasoning models.
 * Must be executed in the development repo with a development NVIDIA_API_KEY.
 * No production writes, no retries, no raw responses/credentials stored.
 */
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
for (const line of (existsSync('.env')?readFileSync('.env','utf8'):'').split(/\r?\n/)) {
 const m=line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)\s*$/);if(!m||process.env[m[1]])continue;
 const v=m[2].trim();process.env[m[1]]=/^(['"]).*\1$/.test(v)?v.slice(1,-1):v;
}
const api=process.env.NVIDIA_BASE_URL?.replace(/\/$/,'')||'https://integrate.api.nvidia.com/v1';
const key=process.env.NVIDIA_API_KEY;if(!key)throw Error('Missing development API credential');
const common='Reply with one clear sentence in English explaining what an AI news knowledge graph is.';
const rows=[
 {id:'nvidia/nemotron-3.5-lightning-30b-a3b',tier:'medium',maxMs:180000,stream:true,max_tokens:2048,temperature:1,top_p:0.95,reasoning_budget:1024,source:'https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-5-lightning-30b-a3b-infer'},
 {id:'nvidia/nemotron-3-super-120b-a12b',tier:'complex',maxMs:150000,stream:true,max_tokens:1800,temperature:1,top_p:0.95,reasoning_effort:'low',reasoning_budget:1024,source:'https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-super-120b-a12b-infer'},
 {id:'z-ai/glm-5.3-flash',tier:'medium',maxMs:180000,stream:false,max_tokens:1536,temperature:0.5,source:'https://docs.api.nvidia.com/nim/reference/z-ai-glm-5-3-flash-infer'},
 {id:'z-ai/glm-5.3',tier:'complex',maxMs:180000,stream:false,max_tokens:2048,temperature:0.5,source:'https://docs.api.nvidia.com/nim/reference/z-ai-glm-5-3-infer'},
 {id:'google/gemma-4-31b-it',tier:'complex',maxMs:180000,stream:false,max_tokens:1024,chat_template_kwargs:{enable_thinking:false},source:'https://docs.api.nvidia.com/nim/reference/google-gemma-4-31b-it-infer'},
 {id:'deepseek-ai/deepseek-v4.1-flash',tier:'medium',maxMs:120000,stream:false,max_tokens:1024,source:null},
 {id:'meta/llama-3.2-90b-vision-instruct',tier:'complex',maxMs:180000,stream:false,max_tokens:1024,source:null},
 {id:'nvidia/nemotron-3.5-super-vl-120b-a12b',tier:'complex',maxMs:180000,stream:false,max_tokens:2048,source:'https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3_5-super-vl-120b-a12b-infer'},
 {id:'nvidia/nemotron-3-ultra-550b-a55b',tier:'complex',maxMs:180000,stream:true,max_tokens:1600,source:'https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-ultra-550b-a55b-infer'},
 {id:'moonshotai/kimi-k2.6',tier:'complex',maxMs:140000,stream:false,max_tokens:1600,source:'https://docs.api.nvidia.com/nim/reference/moonshotai-kimi-k2-6-infer'},
 {id:'meta/muse-glimmer-30b',tier:'complex',maxMs:160000,stream:false,max_tokens:1800,temperature:0.95,top_p:1,source:'https://docs.api.nvidia.com/nim/reference/meta-muse-glimmer-30b-infer'},
 {id:'nvidia/ising-calibration-1.5-31b',tier:'complex',maxMs:130000,stream:false,max_tokens:1600,temperature:0.2,source:'https://docs.api.nvidia.com/nim/reference/nvidia-ising-calibration-1-5-31b-infer'}
];
const outputDir='var/nvidia-audit';mkdirSync(outputDir,{recursive:true});const out=[];
async function single(spec){
 const {id,tier,maxMs,source,stream,...args}=spec;
 const body={model:id,messages:[{role:'user',content:common}],...args,stream};
 let status=null,finish=null,reason=null,chars=0,thinking=0,firstTokenMs=null,errCode=null;
 const start=Date.now();
 try{
  const response=await fetch(api+'/chat/completions',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json',accept:stream?'text/event-stream':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(maxMs)});
  status=response.status;
  if(response.ok&&stream){
   const reader=response.body.getReader();const decoder=new TextDecoder();let pending='';let stop=false;
   while(!stop){
    const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});
    const parts=pending.split(/\r?\n/);pending=parts.pop()||'';
    for(const line of parts) {
     if(!line.startsWith('data:'))continue;
     const json=line.slice(5).trim();if(json==='[DONE]'){stop=true;break}
     try{const data=JSON.parse(json),c=data.choices?.[0],delta=c?.delta||{};
      const n=(delta.content||'').length;if(n){chars+=n;firstTokenMs??=Date.now()-start}
      thinking+=(delta.reasoning_content||delta.reasoning||'').length;
      finish=c?.finish_reason||finish;
     }catch{}
    }
   }
  }else{
   const txt=await response.text();let j={};try{j=JSON.parse(txt)}catch{}
   if(response.ok){const c=j.choices?.[0],m=c?.message||{};chars=typeof m.content==='string'?m.content.length:0;thinking=(m.reasoning_content||m.reasoning||'').length;finish=c?.finish_reason||null;firstTokenMs=Date.now()-start;}
   else {reason=String(j.error?.message||j.detail||j.title||'HTTP rejection').slice(0,90).replace(/account\s+['"]?[^'"\s]+/gi,'account REDACTED');errCode=j.error?.code||null;}
  }
 }catch(e){reason=e?.name==='TimeoutError'?'timeout':String(e).slice(0,90);}
 const item={id,tier,official_model_doc:source,api:'/chat/completions',timeout_ms:maxMs,http:status,elapsed_ms:Date.now()-start,first_token_ms:firstTokenMs,content_chars:chars,thinking_chars:thinking,finish,reason,errCode,verified:status===200&&chars>0};
 process.stdout.write(JSON.stringify(item)+'\n');return item;
}
let cursor=0;async function worker(){while(cursor<rows.length){let row=rows[cursor++];out.push(await single(row));}}
await Promise.all(Array.from({length:3},()=>worker()));
const summary={run_at:new Date().toISOString(),environment:'cn-dev',note:'One official-style request per target. Source null when no matching current official reference was found.',models:out.sort((a,b)=>a.id.localeCompare(b.id))};
writeFileSync(outputDir+'/slow-model-documentation-recheck.json',JSON.stringify(summary,null,2)+'\n');
console.log('SUMMARY',JSON.stringify({attempted:out.length,verified:out.filter(x=>x.verified).length,timeout:out.filter(x=>x.reason==='timeout').length,notFound:out.filter(x=>x.http===404).length,output:outputDir+'/slow-model-documentation-recheck.json'}));
