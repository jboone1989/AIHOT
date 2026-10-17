import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {providerSampleBody} from "@aihot/backend/providers/registry/probe";
import type {ProviderProfile} from "@aihot/backend/providers/registry/types";
import {isVerifiedFreeTrialProvider,VERIFIED_FREE_TRIAL_ENDPOINTS} from "@aihot/backend/providers/registry/types";

const base:ProviderProfile={
 vendor:"nvidia",modelId:"example/base",adapter:"chat",
 endpoint:"https://integrate.api.nvidia.com/v1/chat/completions",credentialEnv:"NVIDIA_API_KEY",
 capabilities:["text"],requestDefaults:{temperature:0.2},timeoutMs:60000,stream:false,
 complexity:"light",documentationUrl:null,notes:null,enabled:false,routeEnabled:false,version:1,
 updatedAt:new Date().toISOString(),checks:[],probeSpec:null,
};
test("every seeded model has its own independent test entry and no test timeout",()=>{
 const json=JSON.parse(readFileSync(new URL("../config/model-provider-probes.json",import.meta.url),"utf8"));
 assert.equal(json.providers.length,81);
 assert.equal(new Set(json.providers.map((x:{modelId:string})=>x.modelId)).size,81);
 assert.ok(json.providers.filter((x:{probeSpec:unknown})=>x.probeSpec!==null).length>50);
 for(const row of json.providers){
  if(row.probeSpec)assert.equal("timeoutMs" in row.probeSpec,false);
 }
});
test("request body belongs to that Provider and uses its own sample parameters",()=>{
 const a:{[K in keyof ProviderProfile]:ProviderProfile[K]}={...base,modelId:"vendor/a",
  probeSpec:{capability:"text",body:{messages:[{role:"user",content:"Hi A"}],temperature:0.7},response:"chat"}};
 const b:{[K in keyof ProviderProfile]:ProviderProfile[K]}={...base,modelId:"vendor/b",
  probeSpec:{capability:"text",body:{messages:[{role:"user",content:"Hi B"}],max_tokens:4096},response:"chat"}};
 const first=providerSampleBody(a),second=providerSampleBody(b);
 assert.equal(first.model,"vendor/a");assert.equal(second.model,"vendor/b");
 assert.notDeepEqual(first.messages,second.messages);
 assert.equal(first.temperature,0.7);assert.equal(second.max_tokens,4096);
});
test("bulk runner waits for fetch without artificial AbortSignal timeout",()=>{
 const code=readFileSync(new URL("../packages/backend/src/providers/registry/probe.ts",import.meta.url),"utf8");
 assert.doesNotMatch(code,/AbortSignal\.timeout\(/);
});

test("only source-verified NVIDIA free trial endpoints can be selected or bulk tested",()=>{
 const ids=Object.keys(VERIFIED_FREE_TRIAL_ENDPOINTS);
 assert.ok(ids.length>0&&ids.length<81);
 assert.ok(ids.every(id=>VERIFIED_FREE_TRIAL_ENDPOINTS[id]?.startsWith("https://build.nvidia.com/")));
 assert.ok(isVerifiedFreeTrialProvider("openai/gpt-oss-20b"));
 assert.ok(isVerifiedFreeTrialProvider("nvidia/nemotron-3-ultra-550b-a55b"));
 assert.equal(isVerifiedFreeTrialProvider("nvidia/nemotron-nano-3-30b-a3b"),false);
 assert.equal(isVerifiedFreeTrialProvider("nvidia/llama-nemotron-embed-vl-1b-v2"),false);
 assert.equal(isVerifiedFreeTrialProvider("meta/llama2-70b"),false);
 assert.equal(isVerifiedFreeTrialProvider("made-up/model"),false);
});

test("bulk dispatch starts all free API model probes concurrently without a fixed cap",()=>{
 const source=readFileSync(new URL("../packages/backend/src/providers/registry/bulk.ts",import.meta.url),"utf8");
 const worker=readFileSync(new URL("../apps/worker/src/main.ts",import.meta.url),"utf8");
 assert.match(source,/Promise\.allSettled\(eligible\.map\(p=>runBulkProviderJob\(/);
 assert.doesNotMatch(source,/PROVIDER_PROBE_CONCURRENCY|Promise\.all\(eligible\.slice\(/);
 assert.doesNotMatch(source,/for\(const p of rows\)\s*\{\s*await enqueue\(QUEUES\.providerVerify/);
 assert.match(worker,/work\(boss,QUEUES\.providerDispatch/);
});
