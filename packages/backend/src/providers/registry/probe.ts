/** Isolated, capability-specific smoke probe. These checks alone do not certify quality. */
import {sql} from "../../db.ts";
import {credential} from "../../config.ts";
import {audit} from "../../audit.ts";
import {getProvider} from "./repository.ts";
import {parseSseCompletion} from "./adapter.ts";
import {paidRequest,assertAccepted} from "../receipts.ts";

const image="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jcWQAAAAASUVORK5CYII=";
export async function probeConfiguredProvider(vendor:string,id:string,capability:string,actor:string){
 const item=await getProvider(vendor,id);
 if(!item)throw Object.assign(new Error("provider not found"),{statusCode:404});
 if(!item.enabled||!item.endpoint)throw Object.assign(new Error("configure and enable this provider first"),{statusCode:400});
 if(!item.capabilities.includes(capability as never))throw Object.assign(new Error("capability is not configured"),{statusCode:400});
 if(!["text","vision","embedding","safety"].includes(capability))throw Object.assign(new Error("this specialized capability needs its official model-specific test adapter"),{statusCode:400});
 if(!["chat","safety","embedding"].includes(item.adapter))throw Object.assign(new Error("unsupported probe adapter"),{statusCode:400});
 const [prev]=await sql<{updated_at:Date}[]>`SELECT updated_at FROM model_provider_checks WHERE vendor=${vendor} AND model_id=${id} AND capability=${capability}`;
 if(prev&&Date.now()-prev.updated_at.getTime()<60000)throw Object.assign(new Error("probe cooldown: 60 seconds"),{statusCode:429});
 const key=credential("models",item.credentialEnv);if(!key)throw Error("model credential unavailable");
 const isEmbedding=capability==="embedding";
 const message=capability==="vision"
   ?[{role:"user",content:[{type:"text",text:"Describe the image."},{type:"image_url",image_url:{url:image}}]}]
   :[{role:"user",content:capability==="safety"?"Classify this harmless greeting: hello.":"Reply with the word OK."}];
 const body:Record<string,unknown>=isEmbedding
  ?{...item.requestDefaults,model:id,input:["Development model health check"],input_type:"passage"}
  :{...item.requestDefaults,model:id,messages:message,max_tokens:768,stream:item.stream};
 const started=Date.now();let status:"verified"|"failed"|"unknown"="unknown";let detail="unknown";
 try{
  const receipt=await paidRequest({
   service:vendor,model:id,purpose:"model_provider_probe",subject:capability+":"+id,
   identity:{capability,version:item.version,prompt:"model-provider-probe.v1"},
   attemptTag:new Date().toISOString().slice(0,13),
   requestSummary:{capability,version:item.version},
  },async()=>{
   const response=await fetch(item.endpoint!,{method:"POST",headers:{"authorization":"Bearer "+key,"content-type":"application/json","accept":item.stream?"text/event-stream":"application/json"},
    body:JSON.stringify(body),signal:AbortSignal.timeout(item.timeoutMs)});
   const text=await response.text();assertAccepted(vendor,response.status,text);
   const json=item.stream?parseSseCompletion(text):JSON.parse(text);
   return {response:json,requestId:response.headers.get("x-request-id"),
    usage:(json.usage as Record<string,unknown>)??null};
  });
  const answer=receipt.response as {data?:Array<{embedding?:number[]}>;choices?:Array<{message?:{content?:string}}>} ;
  const valid=isEmbedding?!!answer.data?.[0]?.embedding?.length
     :typeof answer.choices?.[0]?.message?.content==="string"&&!!answer.choices[0]!.message!.content!.trim();
  status=valid?"verified":"failed";
  detail=valid?"valid_response":"unusable_output";
 }catch(error){
  const reason=String(error);
  status=/HTTP 4(?!29)\d/.test(reason)?"failed":"unknown";
  detail=/HTTP \d\d\d/.exec(reason)?.[0]??(/timeout|aborted/i.test(reason)?"timeout":"transport_or_budget_error");
 }
 const elapsed=Date.now()-started;
 await sql`INSERT INTO model_provider_checks (vendor,model_id,capability,verified_at,status,latency_ms,detail,updated_at)
 VALUES (${vendor},${id},${capability},${status==="verified"?new Date():null},${status},${elapsed},${detail},now())
 ON CONFLICT (vendor,model_id,capability) DO UPDATE SET
 status=EXCLUDED.status,latency_ms=EXCLUDED.latency_ms,detail=EXCLUDED.detail,updated_at=now(),
 verified_at=CASE WHEN EXCLUDED.status='verified' THEN EXCLUDED.verified_at ELSE model_provider_checks.verified_at END`;
 await audit(actor,"model.provider.probe",vendor+":"+id,capability,null,{status,elapsed});
 return {vendor,modelId:id,capability,status,elapsedMs:elapsed};
}
