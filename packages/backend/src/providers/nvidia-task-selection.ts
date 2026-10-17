/**
 * Capability-aware NVIDIA routing policy. Deliberately decoupled from inference:
 * health evidence is supplied by the caller and only proven task abilities may route.
 * modelLevel is provisional task fit (NOT benchmark accuracy or a parameter count).
 */
export type Workload = "news_filter" | "entity_extraction" | "short_summary" |
 "event_linking" | "deep_synthesis" | "translation" | "code_agent" |
 "image_understanding" | "document_extraction" | "text_embedding" |
 "multimodal_embedding" | "safety_classification" | "numerical_reasoning";
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
 numerical_reasoning:{requires:"reasoning",level:"heavy",maxAgeMs:86400000},
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
