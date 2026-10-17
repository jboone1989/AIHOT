import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const manifest=JSON.parse(readFileSync(new URL("../docs/nvidia-model-official-crosscheck.json",import.meta.url),"utf8"));
test("NVIDIA audit covers each of the 81 concrete IDs exactly once",()=>{
 assert.equal(manifest.models.length,81);
 assert.equal(new Set(manifest.models.map((m:{id:string})=>m.id)).size,81);
 assert.equal(manifest.models.every((m:{production_route_admitted:boolean})=>m.production_route_admitted===false),true);
});
test("official sources are explicitly separated from legacy API catalogue membership",()=>{
 assert.equal(manifest.models.filter((m:{reference_status:string})=>m.reference_status==="model_page_checked").length,17);
 assert.equal(manifest.models.filter((m:{reference_status:string})=>m.reference_status==="current_family_index_exact_match").length,16);
 assert.equal(manifest.models.filter((m:{reference_status:string})=>m.reference_status==="no_exact_match_in_three_current_indexes").length,48);
});
test("model-specific API rechecks override only documented capability errors",()=>{
 const byId=Object.fromEntries(manifest.models.map((m:{id:string})=>[m.id,m])) as Record<string,any>;
 assert.equal(byId["google/diffusiongemma-26b-a4b-it"].capability.primary,"vision_chat");
 assert.equal(byId["nvidia/nvclip"].capability.primary,"embedding_multimodal");
 assert.equal(byId["nvidia/nemotron-parse-2.0"].capability.primary,"document_ocr");
 assert.equal(byId["nvidia/riva-translate-4b-instruct-v2"].capability.primary,"translation");
 assert.equal(byId["nvidia/nemotron-3-embed-1b"].capability.primary,"embedding_text");
});
