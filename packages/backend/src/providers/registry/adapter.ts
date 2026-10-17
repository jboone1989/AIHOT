import {credential} from "../../config.ts";
import {assertAccepted,paidRequest} from "../receipts.ts";
import type {ProviderProfile} from "./types.ts";

export abstract class IndependentProvider {
 readonly profile:ProviderProfile;
 constructor(profile:ProviderProfile){this.profile=profile}
 supports(capability:string):boolean{return this.profile.capabilities.includes(capability as never);}
 protected assertReady(capability:string):void{
  const p=this.profile;
  if(!p.enabled||!p.endpoint||!this.supports(capability))throw Error("Provider is not configured for "+capability);
  const check=p.checks.find(c=>c.capability===capability&&c.status==="verified"&&c.verifiedAt&&
     Date.now()-Date.parse(c.verifiedAt)<86400000);
  if(!p.routeEnabled||!check)throw Error("Provider is not verified for "+capability);
 }
 protected async post(body:Record<string,unknown>):Promise<{data:Record<string,unknown>;requestId:string|null}>{
  const p=this.profile;
  if(!p.endpoint)throw Error("Missing API endpoint");
  const key=credential("models",p.credentialEnv);
  if(!key)throw Error("Missing provider credential "+p.credentialEnv);
  const res=await fetch(p.endpoint,{method:"POST",headers:{authorization:"Bearer "+key,"content-type":"application/json",accept:p.stream?"text/event-stream":"application/json"},
    body:JSON.stringify(body),signal:AbortSignal.timeout(p.timeoutMs)});
  const raw=await res.text();assertAccepted(p.vendor,res.status,raw);
  const data=p.stream?parseSseCompletion(raw):JSON.parse(raw) as Record<string,unknown>;
  return {data,requestId:res.headers.get("x-request-id")};
 }
}

/** Streaming reasoning output is not the answer: preserve only the final content for schema parsers. */
export function parseSseCompletion(raw:string):Record<string,unknown>{
 let answer="",reasoning="",finish:string|null=null,usage:Record<string,unknown>|null=null,done=false;
 for(const line of raw.split(/\r?\n/)){
  if(!line.startsWith("data:"))continue;
  const s=line.slice(5).trim();
  if(s==="[DONE]"){done=true;break}
  if(!s)continue;
  let item:Record<string,unknown>;try{item=JSON.parse(s)}catch{throw Error("Invalid SSE JSON payload")}
  const chunk=(item.choices as Array<{delta?:{content?:string;reasoning?:string;reasoning_content?:string};finish_reason?:string}>|undefined)?.[0];
  answer+=chunk?.delta?.content??"";
  reasoning+=chunk?.delta?.reasoning_content??chunk?.delta?.reasoning??"";
  if(chunk?.finish_reason)finish=chunk.finish_reason;
  if(item.usage&&typeof item.usage==="object")usage=item.usage as Record<string,unknown>;
 }
 if(!done)throw Error("Streaming provider ended without DONE marker");
 return {choices:[{message:{content:answer,reasoning_content:reasoning},finish_reason:finish}],usage};
}
export class ChatProvider extends IndependentProvider{
 async request(body:Record<string,unknown>,capability="text"){
  this.assertReady(capability);
  return this.post({...body,...this.profile.requestDefaults,model:this.profile.modelId,stream:this.profile.stream});
 }
}
export class DocumentProvider extends ChatProvider{
 override async request(body:Record<string,unknown>,capability="document"){return super.request(body,capability)}
}
export class SafetyProvider extends ChatProvider{
 override async request(body:Record<string,unknown>,capability="safety"){return super.request(body,capability)}
}
export class EmbeddingProvider extends IndependentProvider{
 async embed(input:string|string[],inputType:"query"|"passage"="passage"){
  this.assertReady("embedding");
  const p=this.profile;
  const body={...p.requestDefaults,model:p.modelId,input:input, input_type:inputType};
  const receipt=await paidRequest({service:p.vendor,model:p.modelId,purpose:"provider.embedding",subject:p.modelId,
   identity:{input,inputType,profileVersion:p.version}},async()=>{
    const r=await this.post(body);
    return {response:r.data,requestId:r.requestId,usage:(r.data.usage as Record<string,unknown>)??null};
   });
  const response=receipt.response as {data?:Array<{embedding?:number[]}>};
  const vectors=response.data?.map(v=>v.embedding);
  if(!vectors?.length||vectors.some(v=>!v?.length||v.some(n=>!Number.isFinite(n))))throw Error("Provider returned invalid embeddings");
  return {vectors:vectors as number[][],receiptId:receipt.receiptId,dimension:vectors[0]!.length};
 }
}
export class UnconfiguredProvider extends IndependentProvider{}
export type ProviderInstance=ChatProvider|DocumentProvider|SafetyProvider|EmbeddingProvider|UnconfiguredProvider;
export function instantiateProvider(profile:ProviderProfile):ProviderInstance{
 switch(profile.adapter){
  case "chat":return new ChatProvider(profile);
  case "document":return new DocumentProvider(profile);
  case "safety":return new SafetyProvider(profile);
  case "embedding":return new EmbeddingProvider(profile);
  default:return new UnconfiguredProvider(profile);
 }
}
