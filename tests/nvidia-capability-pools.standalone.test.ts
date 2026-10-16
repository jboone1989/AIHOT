import assert from "node:assert/strict";
import {test} from "node:test";
import {nvidiaCapability,nvidiaInventory} from "@aihot/backend/providers/nvidia-catalog";
import {chooseModel,nextProbe,type Pool} from "@aihot/backend/providers/nvidia-pool";
const now=Date.parse("2026-10-17T01:00:00Z");
const h=(model:string,visionVerified=false)=>({model,ok:true,checkedAt:new Date(now-1000).toISOString(),lastOk:new Date(now-1000).toISOString(),latencyMs:900,samples:2,visionVerified});
test("catalogue keeps every capability without treating embeddings/images as chat",()=>{
 const data=["openai/gpt-oss-20b","meta/llama-3.3-70b-instruct","nvidia/nv-embed-qa","nvidia/nv-rerank-qa","stabilityai/stable-diffusion-xl","meta/llama-guard-4-12b","z-ai/glm-5.3-flash","unknown/new-service"].map(id=>({id}));
 const groups=nvidiaInventory(data);
 assert.equal(Object.values(groups).reduce((s,x)=>s+x.length,0),data.length);
 assert.equal(groups.embedding.length,1);assert.equal(groups.rerank.length,1);
 assert.equal(groups.image.length,1);assert.equal(groups.safety.length,1);
 assert.equal(groups.vision.length,1);assert.equal(groups.unknown.length,1);
 assert.equal(nvidiaCapability("meta/llama-3.3-70b-instruct"),"text");
});
test("newly discovered, independently verified text model can be used as fallback",()=>{
 const candidates=["openai/gpt-oss-20b","meta/llama-3.3-70b-instruct"];
 const state:Pool={catalogAt:null,catalogCount:80,candidates,probes:1,health:{
  [candidates[0]!]:{...h(candidates[0]!),ok:false},
  [candidates[1]!]:h(candidates[1]!),
 }};
 assert.equal(chooseModel(state,"nvidia-gpt-oss-20b",now),candidates[1]);
 assert.equal(nextProbe(state,now),null);
});
test("vision task cannot use text evidence or a text-only fallback",()=>{
 const vision="z-ai/glm-5.3-flash",text="openai/gpt-oss-20b";
 const state:Pool={catalogAt:null,catalogCount:80,candidates:[vision,text],probes:0,health:{[vision]:h(vision),[text]:h(text)}};
 assert.equal(chooseModel(state,"nvidia-glm-5.3-flash",now),null);
 state.health[vision]!.visionVerified=true;
 assert.equal(chooseModel(state,"nvidia-glm-5.3-flash",now),vision);
});
