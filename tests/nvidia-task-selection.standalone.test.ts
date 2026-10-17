import assert from "node:assert/strict";
import {test} from "node:test";
import {eligibleForWorkload,selectNvidiaForWorkload,workloadRequirement, type VerifiedModel} from "@aihot/backend/providers/nvidia-task-selection";
const now=Date.parse("2026-10-17T00:00:00Z"),proof={at:now-1000,passes:2};
const mk=(id:string,caps:VerifiedModel["capabilities"],tier:VerifiedModel["modelLevel"],quality=95):VerifiedModel=>({
 id,capabilities:caps,modelLevel:tier,
 verified:Object.fromEntries(caps.map(x=>[x,proof])),
 qualityByTask:{news_filter:quality,event_linking:quality,deep_synthesis:quality},
 p95LatencyMs:tier==="heavy"?45000:tier==="medium"?18000:4000,p95CostUnits:tier==="heavy"?4:1
});
test("light jobs use verified light profiles; heavy jobs use verified strong profiles",()=>{
 const candidates=[mk("heavy",["text","reasoning"],"heavy"),mk("medium",["text","reasoning"],"medium"),mk("light",["text","reasoning"],"light")];
 assert.equal(selectNvidiaForWorkload(candidates,{workload:"news_filter",now})?.id,"light");
 assert.equal(selectNvidiaForWorkload(candidates,{workload:"deep_synthesis",now})?.id,"heavy");
 assert.equal(selectNvidiaForWorkload(candidates,{workload:"event_linking",now})?.id,"medium");
});
test("image success must be measured independently of text",()=>{
 const model=mk("vlm",["vision","text"],"medium");
 delete model.verified.vision;
 assert.equal(eligibleForWorkload(model,{workload:"image_understanding",now}),false);
 assert.equal(eligibleForWorkload(model,{workload:"news_filter",now}),true);
});
test("embedding, translation and safety use their own verified API family",()=>{
 const docs=mk("embed",["embedding"],"light"),text=mk("text",["text"],"light");
 assert.equal(selectNvidiaForWorkload([docs,text],{workload:"text_embedding",now})?.id,"embed");
 assert.equal(selectNvidiaForWorkload([docs,text],{workload:"translation",now}),null);
 assert.equal(selectNvidiaForWorkload([docs,text],{workload:"safety_classification",now}),null);
 assert.equal(workloadRequirement("document_extraction").requires,"document");
});
test("prior 404, timeout and unverified catalog names are never routed",()=>{
 const stale=mk("old",["text"],"light");stale.verified.text={at:now-2*86400000,passes:3};
 const blocked=mk("circuit",["text"],"medium");blocked.circuitOpen=true;
 const listing=mk("catalogue-only",["text"],"light");listing.verified={};
 assert.equal(selectNvidiaForWorkload([stale,blocked,listing],{workload:"news_filter",now}),null);
});
test("latency is a task policy not a universal fixed model timeout",()=>{
 const heavy=mk("complex",["reasoning"],"heavy");
 assert.equal(selectNvidiaForWorkload([heavy],{workload:"deep_synthesis",now,latencyBudgetMs:10000}),null);
 assert.equal(selectNvidiaForWorkload([heavy],{workload:"deep_synthesis",now,latencyBudgetMs:120000})?.id,"complex");
});
test("task quality thresholds only accept model with measured quality",()=>{
 const m=mk("model",["text"],"light"); delete m.qualityByTask;
 assert.equal(selectNvidiaForWorkload([m],{workload:"news_filter",now,minimumQuality:80}),null);
 m.qualityByTask={news_filter:81};
 assert.equal(selectNvidiaForWorkload([m],{workload:"news_filter",now,minimumQuality:80})?.id,"model");
});
