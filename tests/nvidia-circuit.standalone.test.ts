import assert from "node:assert/strict";
import {test} from "node:test";
import { chooseModel, nextProbe, type Pool } from "@aihot/backend/providers/nvidia-pool";
import { modelCircuitOpen, trafficFailureRate, conservativeFailureRisk, type ModelTraffic } from "@aihot/backend/providers/nvidia-routing";

const now = Date.parse("2026-10-16T15:00:00Z");
const health = (model: string, latencyMs=2000) => ({
 model, ok:true, checkedAt:new Date(now-120000).toISOString(),
 lastOk:new Date(now-120000).toISOString(), latencyMs,samples:4,
});
const candidates=["nvidia/nemotron-3.5-lightning-30b-a3b","openai/gpt-oss-20b","z-ai/glm-5.3-flash","meta/llama-3.3-70b-instruct"];
const pool=():Pool=>({
 catalogAt:null,catalogCount:45,candidates,probes:3,
 health:Object.fromEntries(candidates.map((m,i)=>[m,health(m,900+i*900)])),
});
const counts=(completed:number,unknown:number,failed=0):ModelTraffic=>({completed,received:0,unknown,failed});
test("real unknown receipts open circuit while one failure cannot",()=>{
 assert.equal(modelCircuitOpen(counts(18,46)),true);
 assert.equal(trafficFailureRate(counts(18,46)),46/64);
 assert.equal(modelCircuitOpen(counts(7,1)),false);
 assert.equal(modelCircuitOpen(counts(14,0)),false);
});
test("unsafe primary is replaced only by a verified approved fallback",()=>{
 const state=pool();
 const traffic={
  "nvidia/nemotron-3.5-lightning-30b-a3b":counts(18,46),
  "openai/gpt-oss-20b":counts(35,1),
  "z-ai/glm-5.3-flash":counts(10,0),
 };
 assert.equal(chooseModel(state,"nvidia-nemotron-lightning",now,traffic),"openai/gpt-oss-20b");
 assert.ok(conservativeFailureRisk(traffic["openai/gpt-oss-20b"]!)<conservativeFailureRisk(traffic["z-ai/glm-5.3-flash"]!));
 assert.equal(chooseModel(state,"nvidia-nemotron-lightning",now),"nvidia/nemotron-3.5-lightning-30b-a3b");
 // Eligible models are determined by the discovered capability pool and a real health probe.
 state.health["openai/gpt-oss-20b"]!.ok=false;
 state.health["z-ai/glm-5.3-flash"]!.ok=false;
 assert.equal(chooseModel(state,"nvidia-nemotron-lightning",now,traffic),null);
});
test("vision-required capability never changes to text-only GPT-OSS",()=>{
 const state=pool();
 state.health["z-ai/glm-5.3-flash"]!.ok=false;
 assert.equal(chooseModel(state,"nvidia-glm-5.3-flash",now,{
  "z-ai/glm-5.3-flash":counts(1,15)
 }),null);
});
test("unobserved models are not preferred over strongly verified successes",()=>{
 assert.ok(conservativeFailureRisk(counts(0,0))>conservativeFailureRisk(counts(35,1)));
});
test("approved models are probed before unknown catalog entries",()=>{
 const state=pool();
 state.health={};
 assert.equal(nextProbe(state,now),"openai/gpt-oss-20b");
});
