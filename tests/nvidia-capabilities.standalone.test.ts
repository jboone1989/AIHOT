import assert from "node:assert/strict";
import {test} from "node:test";
import {classifyNvidiaModel,makeCapabilityPools} from "@aihot/backend/providers/nvidia-capabilities";
import {chooseModel,type Pool} from "@aihot/backend/providers/nvidia-pool";

test("catalog models are separated into actual modality pools and unknowns remain visible",()=>{
 const names=["openai/gpt-oss-20b","meta/llama-3.2-11b-vision-instruct",
   "nvidia/nemotron-3-embed-1b","nvidia/nv-rerank-qa-4","black-forest-labs/flux.1-schnell",
   "nvidia/parakeet-tdt-0.6b-v3","other/unclassified-v99"];
 const records=names.map(id=>classifyNvidiaModel({id,type:"model"}));
 assert.ok(records.every(Boolean));
 const pools=makeCapabilityPools(records.filter(x=>x!==null));
 assert.deepEqual(pools.text.slice(0,2),names.slice(0,2));
 assert.deepEqual(pools.vision,[names[1]]);
 assert.deepEqual(pools.embedding,[names[2]]);
 assert.deepEqual(pools.reranking,[names[3]]);
 assert.deepEqual(pools.image_generation,[names[4]]);
 assert.deepEqual(pools.audio,[names[5]]);
 assert.deepEqual(pools.unknown,[names[6]]);
});
test("routing uses the full verified text catalog, but never substitutes embedding or image generation",()=>{
 const ids=["openai/gpt-oss-20b","meta/llama-3.3-70b-instruct","nvidia/nemotron-3-embed-1b"];
 const rec=ids.map(id=>classifyNvidiaModel({id})!).filter(Boolean);
 const at=Date.parse("2026-10-16T15:00:00Z");
 const health=Object.fromEntries(ids.map((id,i)=>[id,{model:id,ok:true,checkedAt:new Date(at-60000).toISOString(),lastOk:new Date(at-60000).toISOString(),latencyMs:i+1000,samples:3}]));
 const pool:Pool={catalogAt:new Date(at).toISOString(),catalogCount:ids.length,candidates:ids,probes:3,health,pools:makeCapabilityPools(rec)};
 pool.health["openai/gpt-oss-20b"]!.ok=false;
 assert.equal(chooseModel(pool,"nvidia-gpt-oss-20b",at),"meta/llama-3.3-70b-instruct");
 pool.health["meta/llama-3.3-70b-instruct"]!.ok=false;
 assert.equal(chooseModel(pool,"nvidia-gpt-oss-20b",at),null);
});
test("vision tasks cannot run on text-only models or unverified image probes",()=>{
 const at=Date.parse("2026-10-16T15:00:00Z");
 const id="meta/llama-3.2-11b-vision-instruct";
 const pool:Pool={catalogAt:null,catalogCount:1,candidates:[id],probes:1,pools:makeCapabilityPools([classifyNvidiaModel({id})!]),
   health:{[id]:{model:id,ok:true,checkedAt:new Date(at).toISOString(),lastOk:new Date(at).toISOString(),latencyMs:1000,samples:2}}};
 assert.equal(chooseModel(pool,"nvidia-glm-5.3-flash",at),null);
 pool.health[id]!.visionVerified=true;
 assert.equal(chooseModel(pool,"nvidia-glm-5.3-flash",at),id);
});
