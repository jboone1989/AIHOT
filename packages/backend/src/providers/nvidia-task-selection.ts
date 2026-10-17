/**
 * Capability-aware NVIDIA routing policy. Deliberately decoupled from inference:
 * health evidence is supplied by the caller and only proven task abilities may route.
 * modelLevel is provisional task fit (NOT benchmark accuracy or a parameter count).
 */
export type Workload = "news_filter" | "entity_extraction" | "short_summary" |
 "event_linking" | "deep_synthesis" | "translation" | "code_agent" |
 "image_understanding" | "document_extraction" | "text_embedding" |
 "multimodal_embedding" | "safety_classification";
export type Capability = "text" | "reasoning" | "vision" | "document" |
 "embedding" | "embedding_vision" | "safety" | "translation" | "coding";
export type Level = "light" | "medium" | "heavy";
export interface VerifiedModel {
 id:string;
 capabilities:Capability[];
 modelLevel:Level;
 /** Only successful capability-specific requests. No inference from model name or HTTP 200 with empty content. */
 verified:Partial<Record<Capability,{at:number;passes:number}>>;
 /** A failure in one capability must never erase another capability's evidence. */
 lastError?:string;
 circuitOpen?:boolean;
 p95LatencyMs?:number;
 p95CostUnits?:number;
 qualityByTask?:Partial<Record<Workload,number>>;
}
export interface RouteRequest {
 workload:Workload;
 /** Heavy research must not be forced into an 18-second probe deadline. */
 latencyBudgetMs?:number;
 /** Operator can require a benchmarked minimum quality before routing. */
 minimumQuality?:number;
 now?:number;
}
const tasks:Record<Workload,{requires:Capability;level:Level;maxAgeMs:number}> = {
 news_filter:{requires:"text",level:"light",maxAgeMs:86400000},
 entity_extraction:{requires:"text",level:"light",maxAgeMs:86400000},
 short_summary:{requires:"text",level:"light",maxAgeMs:86400000},
 event_linking:{requires:"reasoning",level:"medium",maxAgeMs:86400000},
 deep_synthesis:{requires:"reasoning",level:"heavy",maxAgeMs:86400000},
 translation:{requires:"translation",level:"light",maxAgeMs:86400000},
 code_agent:{requires:"coding",level:"medium",maxAgeMs:86400000},
 image_understanding:{requires:"vision",level:"medium",maxAgeMs:86400000},
 document_extraction:{requires:"document",level:"medium",maxAgeMs:86400000},
 text_embedding:{requires:"embedding",level:"light",maxAgeMs:86400000},
 multimodal_embedding:{requires:"embedding_vision",level:"medium",maxAgeMs:86400000},
 safety_classification:{requires:"safety",level:"light",maxAgeMs:86400000}
};
const order:Record<Level,number>={light:0,medium:1,heavy:2};
export function workloadRequirement(w:Workload){return tasks[w];}
export function eligibleForWorkload(m:VerifiedModel,r:RouteRequest):boolean{
 const spec=tasks[r.workload],now=r.now??Date.now();
 const evidence=m.verified[spec.requires];
 if(m.circuitOpen||!m.capabilities.includes(spec.requires)||!evidence||evidence.passes<1) return false;
 if(now-evidence.at>spec.maxAgeMs || evidence.at>now+60000)return false;
 const quality=m.qualityByTask?.[r.workload];
 if(r.minimumQuality!=null && (quality==null || quality<r.minimumQuality))return false;
 if(r.latencyBudgetMs!=null && m.p95LatencyMs!=null && m.p95LatencyMs>r.latencyBudgetMs)return false;
 return true;
}
/** For light tasks prefer sufficient low-compute models; complex tasks prefer proven heavy ones.
 * Health and quality gates always run before tier/latency selection.
 * Do not guess costs: unknown cost gets an explicit penalty.
 */
export function selectNvidiaForWorkload(models:VerifiedModel[],r:RouteRequest):VerifiedModel|null{
 const task=tasks[r.workload],w=order[task.level];
 return models.filter(m=>eligibleForWorkload(m,r)).sort((a,b)=>{
   const score=(m:VerifiedModel)=>{
     const lvl=order[m.modelLevel];
     const tier=w===0?lvl*100 : w===2?(2-lvl)*100 : Math.abs(1-lvl)*100;
     const quality=m.qualityByTask?.[r.workload]??0;
     return tier+(100-quality)*.15+(m.p95LatencyMs??90000)/120000+
       (m.p95CostUnits??10)*.5;
   };
   return score(a)-score(b) || a.id.localeCompare(b.id);
 })[0]??null;
}
/** These are provisional *task-fit* hypotheses for dev evaluation, not performance claims.
 * Model may be placed in a production pool only after capability and task verification.
 */
export const NVIDIA_DEV_CANDIDATES:Readonly<Record<string,{capabilities:Capability[];modelLevel:Level}>>={
 "openai/gpt-oss-20b":{capabilities:["text","reasoning"],modelLevel:"light"},
 "nvidia/nemotron-3.5-lightning-30b-a3b":{capabilities:["text","reasoning"],modelLevel:"medium"},
 "nvidia/nemotron-3-super-120b-a12b":{capabilities:["text","reasoning"],modelLevel:"heavy"},
 "z-ai/glm-5.3-flash":{capabilities:["text","reasoning","vision"],modelLevel:"medium"},
 "google/gemma-4-31b-it":{capabilities:["text","reasoning","vision"],modelLevel:"heavy"},
 "stepfun-ai/step-5-preview":{capabilities:["text","reasoning","vision"],modelLevel:"heavy"},
 "meta/llama-3.2-11b-vision-instruct":{capabilities:["text","vision"],modelLevel:"light"},
 "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning":{capabilities:["text","reasoning","vision"],modelLevel:"medium"},
 "nvidia/nemotron-3.5-super-vl-120b-a12b":{capabilities:["text","reasoning","vision"],modelLevel:"heavy"},
 "nvidia/nemotron-3-embed-1b":{capabilities:["embedding"],modelLevel:"light"},
 "nvidia/llama-nemotron-embed-vl-1b-v2":{capabilities:["embedding","embedding_vision"],modelLevel:"light"},
 "nvidia/nemotron-3.5-content-safety":{capabilities:["safety"],modelLevel:"light"},
 "nvidia/llama-3.1-nemotron-safety-guard-8b-v3":{capabilities:["safety"],modelLevel:"light"},
 "nvidia/riva-translate-4b-instruct-v2":{capabilities:["translation"],modelLevel:"light"},
 "poolside/laguna-xs-2.1":{capabilities:["coding"],modelLevel:"medium"},
 "nvidia/nemotron-parse-2.0":{capabilities:["document"],modelLevel:"medium"}
};
