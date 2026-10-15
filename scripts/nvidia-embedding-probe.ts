const key=process.env.NVIDIA_API_KEY;
const base=(process.env.NVIDIA_BASE_URL||"https://integrate.api.nvidia.com/v1").replace(/\/$/,"");
if(!key){console.log(JSON.stringify({keyConfigured:false}));process.exit(0)}
const headers={authorization:"Bearer "+key,accept:"application/json","content-type":"application/json"};
const c=await fetch(base+"/models",{headers,signal:AbortSignal.timeout(12000)});
const data=await c.json();
const ids=(data.data||[]).map(x=>x.id||"");
const embedding=ids.filter(x=>/embed|embedding|nv-embed/i.test(x));
console.log(JSON.stringify({catalogStatus:c.status,total:ids.length,embeddingCandidates:embedding.slice(0,30)}));
for(const model of ["nvidia/nemotron-3-embed-1b","snowflake/arctic-embed-l"]){
 try{
 const response=await fetch(base+"/embeddings",{method:"POST",headers,body:JSON.stringify({model,input:["Google released a Gemini model"],input_type:"passage",truncate:"END"}),signal:AbortSignal.timeout(9000)});
 const answer=await response.json().catch(()=>({}));
 console.log(JSON.stringify({model,status:response.status,dimensions:answer.data?.[0]?.embedding?.length??0,error:answer.error?.type||answer.error?.code||answer.message?.slice?.(0,80)||null}));
 }catch(e){console.log(JSON.stringify({model,error:e instanceof Error?e.message:"unavailable"}))}
}
