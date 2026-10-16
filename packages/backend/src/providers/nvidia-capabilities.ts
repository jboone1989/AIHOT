/** NVIDIA /models inventory classification. An unknown model is catalogued, never guessed safe. */
export type ModelCapability = "text"|"vision"|"embedding"|"reranking"|"image_generation"|"audio"|"video"|"safety"|"unknown";
export type CatalogModel = { id:string; capabilities:ModelCapability[]; source:"metadata"|"name"; };
/** Metadata takes precedence where the provider supplies an explicit task or modality.
 * OpenAI-style GET /models often returns only id/owner; conservative names are a fallback. */
export function classifyNvidiaModel(item:{id?:string; type?:string; task?:string; capabilities?:unknown; modalities?:unknown; input_modalities?:unknown; output_modalities?:unknown}):CatalogModel|null{
 const id=String(item.id??"").trim();
 if(!/^[\w.-]+\/[\w.-]+$/.test(id))return null;
 const metadata=[item.type,item.task,...(Array.isArray(item.capabilities)?item.capabilities:[]),
  ...(Array.isArray(item.modalities)?item.modalities:[]),
  ...(Array.isArray(item.input_modalities)?item.input_modalities:[]),
  ...(Array.isArray(item.output_modalities)?item.output_modalities:[])]
  .filter(x=>typeof x==="string").join(" ").toLowerCase();
 const meaningfulMetadata=metadata&&!/^(model|system|nvidia|api)$/i.test(metadata);
 const source=meaningfulMetadata?"metadata" as const:"name" as const;
 const signature=meaningfulMetadata?metadata+" "+id.toLowerCase():id.toLowerCase();
 let caps:ModelCapability[];
 if(/rerank|cross.encoder/.test(signature))caps=["reranking"];
 else if(/embed|embedding|retriev|bge-|e5-/.test(signature))caps=["embedding"];
 else if(/image.generation|text.to.image|diffusion|flux|stable.diffusion|sdxl|imagen|imagegen/.test(signature))caps=["image_generation"];
 else if(/audio|speech|asr|tts|whisper|parakeet|canary/.test(signature))caps=["audio"];
 else if(/video.generation|text.to.video|video.gen/.test(signature))caps=["video"];
 else if(/safety|guard|moderation|shield|reward/.test(signature))caps=["safety"];
 else if(/vision|vlm|vl-|vl_|image.understanding|multimodal|pixtral/.test(signature))caps=["text","vision"];
 else if(/chat|completion|text.generation|instruct|gpt-oss|nemotron|llama|qwen|deepseek|gemma|glm-|mistral|kimi|granite|phi-|command-r|jamba|mixtral/.test(signature))caps=["text"];
 else caps=["unknown"];
 // Explicit service metadata may describe a multimodal model without a known family.
 if(metadata&&/vision|image.input|image.understanding|image.text/.test(metadata)&&caps.includes("text")&&!caps.includes("vision"))caps=[...caps,"vision"];
 return {id,capabilities:caps,source};
}
export const POOL_CAPABILITIES:readonly ModelCapability[]=["text","vision","embedding","reranking","image_generation","audio","video","safety","unknown"];
export type CapabilityPools=Record<ModelCapability,string[]>;
export function makeCapabilityPools(items:CatalogModel[]):CapabilityPools{
 const pools:CapabilityPools={text:[],vision:[],embedding:[],reranking:[],image_generation:[],audio:[],video:[],safety:[],unknown:[]};
 for(const model of items)for(const cap of model.capabilities) pools[cap].push(model.id);
 return pools;
}
export function eligibleChatModel(item:CatalogModel,needed:"text"|"vision"):boolean {
 return item.capabilities.includes(needed);
}
