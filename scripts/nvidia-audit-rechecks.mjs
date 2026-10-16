#!/usr/bin/env node
/** Follow-up checks for models whose first-pass adapter was inaccurate.
 * Per-model request shapes are based on the cited NVIDIA API reference pages.
 * Runs only on cn-dev; reads its .env without logging secrets or touching service state.
 */
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
for(const line of (existsSync('.env')?readFileSync('.env','utf8'):'').split(/\r?\n/)){
 const m=line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)\s*$/);
 if(!m||process.env[m[1]])continue;
 let v=m[2].trim();if((v[0]==='"'&&v.at(-1)==='"')||(v[0]==="'"&&v.at(-1)==="'"))v=v.slice(1,-1);
 process.env[m[1]]=v;
}
const key=process.env.NVIDIA_API_KEY,base=(process.env.NVIDIA_BASE_URL||'https://integrate.api.nvidia.com/v1').replace(/\/$/,'');
if(!key||!base.startsWith('https:'))throw Error('Dev NVIDIA credentials unavailable');
const imgSmall='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jcWQAAAAASUVORK5CYII=';
function crc32(buf){let c=0xffffffff;for(const v of buf){c^=v;for(let i=0;i<8;i++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return (c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),b=Buffer.alloc(4),c=Buffer.alloc(4);b.writeUInt32BE(data.length);c.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([b,t,data,c]);}
function docImage(){
 const w=1024,h=1280,ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 const pixels=Buffer.alloc((w*3+1)*h,255);for(let y=0;y<h;y++){const off=y*(w*3+1);pixels[off]=0;if(y>180&&y<240)for(let x=80;x<850;x++){const p=off+1+x*3;pixels[p]=pixels[p+1]=pixels[p+2]=0;}}
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixels,{level:9})),chunk('IEND',Buffer.alloc(0))]);
 return 'data:image/png;base64,'+png.toString('base64');
}
const doc=docImage(),sources={
 'google/diffusiongemma-26b-a4b-it':'https://docs.api.nvidia.com/nim/reference/diffusiongemma-26b-a4b-it-infer',
 'nvidia/nvclip':'https://docs.api.nvidia.com/nim/reference/nvidia-nvclip-infer',
 'nvidia/nemotron-parse':'https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-parse-infer',
 'nvidia/nemotron-parse-2.0':'https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-parse-2_0',
 'nvidia/neva-22b':'https://docs.api.nvidia.com/nim/reference/nvidia-neva-22b-infer',
 'meta/muse-glimmer-30b':'https://docs.api.nvidia.com/nim/reference/meta-muse-glimmer-30b-infer',
 'nvidia/ising-calibration-1.5-31b':'https://docs.api.nvidia.com/nim/reference/nvidia-ising-calibration-1-5-31b-infer'
};
const chat=(model,messages,extra={})=>({model,messages,max_tokens:2048,stream:false,...extra});
const cases=[
 ['google/diffusiongemma-26b-a4b-it','/chat/completions',chat('google/diffusiongemma-26b-a4b-it',[{role:'user',content:'Reply with just OK.'}],{temperature:1,top_p:0.95,chat_template_kwargs:{enable_thinking:true}})],
 ['nvidia/nvclip','/embeddings',{model:'nvidia/nvclip',input:'NVIDIA image and text embeddings test',encoding_format:'float'}],
 ['nvidia/nemotron-parse','/chat/completions',chat('nvidia/nemotron-parse',[{role:'user',content:'<img src="'+doc+'" />'}],{max_tokens:1024,temperature:0})],
 ['nvidia/nemotron-parse-2.0','/chat/completions',chat('nvidia/nemotron-parse-2.0',[{role:'user',content:'</s><output_markdown> <img src="'+doc+'" />'}],{max_tokens:1024})],
 ['nvidia/neva-22b','/v1/vlm/nvidia/neva-22b',chat('nvidia/neva-22b',[{role:'user',content:[{type:'text',text:'What is in the image?'},{type:'image_url',image_url:{url:imgSmall}}]}],{max_tokens:256})],
 ['meta/muse-glimmer-30b','/chat/completions',chat('meta/muse-glimmer-30b',[{role:'user',content:'Say OK in one sentence.'}],{reasoning_effort:'low',temperature:0.95,top_p:1})],
 ['nvidia/ising-calibration-1.5-31b','/chat/completions',chat('nvidia/ising-calibration-1.5-31b',[{role:'user',content:[{type:'text',text:'Summarize this image.'},{type:'image_url',image_url:{url:imgSmall}}]}],{max_tokens:2048,temperature:0.2})]
];
async function invoke([id,path,body]){
 const url=path.startsWith('/v1/')?'https://ai.api.nvidia.com'+path:base+path;
 const start=Date.now(),item={id,reference:sources[id],endpoint:new URL(url).pathname,checked_at:new Date().toISOString()};
 try{
  const r=await fetch(url,{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(52000)});
  let data;let raw=(await r.text()).slice(0,65536);try{data=JSON.parse(raw)}catch{data={}};
  const msg=data.choices?.[0]?.message;
  item.http=r.status;item.finish=data.choices?.[0]?.finish_reason||null;item.ms=Date.now()-start;
  item.content_valid=typeof msg?.content==='string'?msg.content.trim().length>0:Array.isArray(msg?.content)?msg.content.length>0:false;
  item.embedding_dim=Array.isArray(data.data?.[0]?.embedding)?data.data[0].embedding.length:null;
  item.error=r.ok?null:String(data.error?.message||data.detail||raw.slice(0,160)).slice(0,180);
 }catch(e){item.http=null;item.ms=Date.now()-start;item.error=e?.name==='TimeoutError'?'timeout':String(e).slice(0,180);}
 console.log(JSON.stringify(item));return item;
}
const results=[];
for(const entry of cases) results.push(await invoke(entry));
const folder='var/nvidia-audit';mkdirSync(folder,{recursive:true});
writeFileSync(folder+'/corrected-adapters.json',JSON.stringify({checked_at:new Date().toISOString(),results},null,2));
console.log('TARGETED_SUMMARY',JSON.stringify({tests:results.length,success:results.filter(r=>r.http===200&&(r.content_valid||r.embedding_dim)).length,output:folder+'/corrected-adapters.json'}));
