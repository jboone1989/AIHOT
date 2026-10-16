import assert from "node:assert/strict";
import { test } from "node:test";
import { chooseModel,nextProbe,healthyModels,type Pool } from "@aihot/backend/providers/nvidia-pool";
import { isNvidiaTextModel } from "@aihot/backend/providers/llm";
const at=new Date("2026-10-14T12:00:00Z").getTime();
const pool=():Pool=>({
 catalogAt:null,catalogCount:80,candidates:["openai/gpt-oss-20b","nvidia/nemotron-3.5-lightning-30b-a3b","google/gemma-4-31b-it"],probes:2,
 health:{"openai/gpt-oss-20b":{model:"openai/gpt-oss-20b",ok:true,checkedAt:new Date(at-120000).toISOString(),lastOk:new Date(at-120000).toISOString(),latencyMs:3000,samples:1},
 "nvidia/nemotron-3.5-lightning-30b-a3b":{model:"nvidia/nemotron-3.5-lightning-30b-a3b",ok:true,checkedAt:new Date(at-180000).toISOString(),lastOk:new Date(at-180000).toISOString(),latencyMs:1800,samples:1}}
});
test("catalog is not all chat models",()=>{
 assert.ok(isNvidiaTextModel("openai/gpt-oss-20b"));
 assert.ok(!isNvidiaTextModel("nvidia/nv-embed-qa"));
 assert.ok(!isNvidiaTextModel("meta/llama-guard-4-12b"));
 assert.ok(isNvidiaTextModel("google/gemma-3-vision"));
});
test("capability preference with verified low-latency fallback",()=>{
 const s=pool();
 assert.equal(chooseModel(s,"nvidia-gpt-oss-20b",at),"openai/gpt-oss-20b");
 assert.equal(chooseModel(s,"nvidia-glm-5.3-flash",at),null); // Do not silently route image-capable tasks to a text-only model.
 assert.equal(nextProbe(s,at),null);
 assert.equal(nextProbe(s,at,true),"google/gemma-4-31b-it");
});
test("stale or recently failed models cannot be selected",()=>{
 const s=pool();
 s.health["openai/gpt-oss-20b"]!.ok=false;
 assert.equal(chooseModel(s,"nvidia-gpt-oss-20b",at),"nvidia/nemotron-3.5-lightning-30b-a3b");
 assert.equal(healthyModels(s,at).length,1);
 assert.equal(chooseModel(s,"nvidia-gpt-oss-20b",at+5*3600_000),null);
});
