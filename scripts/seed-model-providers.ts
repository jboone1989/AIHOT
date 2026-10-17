/** Populate independent model-provider profiles once, without overwriting admin edits.
 * Run AFTER additive database migrations on dev/prod separately. Zero credentials in seed.
 * node --env-file-if-exists=.env scripts/seed-model-providers.ts
 */
import {readFileSync} from "node:fs";
import path from "node:path";
import {REPO_ROOT} from "@aihot/backend/config";
import {sql,closeDb} from "@aihot/backend/db";
import {checkProviderChanges} from "@aihot/backend/providers/registry/validation";
import type {ProviderChanges} from "@aihot/backend/providers/registry/types";
export async function seedModelProviders(){
 const data=JSON.parse(readFileSync(path.join(REPO_ROOT,"config/model-provider-seed.json"),"utf8")) as
   {providers:Array<{vendor:string;modelId:string;credentialEnv:string}&ProviderChanges>};
 const ids=new Set(data.providers.map(p=>p.vendor+":"+p.modelId));
 if(ids.size!==data.providers.length)throw Error("duplicate seed profile");
 let imported=0;
 for(const p of data.providers){
  checkProviderChanges(p);
  if(p.vendor!=="nvidia"||p.credentialEnv!=="NVIDIA_API_KEY")throw Error("unapproved bootstrap profile");
  const rows=await sql<{vendor:string}[]>`INSERT INTO model_providers (
    vendor,model_id,adapter,endpoint,credential_env,capabilities,request_defaults,
    timeout_ms,stream,complexity,documentation_url,notes,enabled,route_enabled,updated_by)
   VALUES (
    ${p.vendor},${p.modelId},${p.adapter??"unconfigured"},${p.endpoint??null},${p.credentialEnv},
    ${sql.json(p.capabilities??[])},${sql.json(p.requestDefaults??{})},${p.timeoutMs??60000},
    ${p.stream??false},${p.complexity??"medium"},${p.documentationUrl??null},${p.notes??null},
    false,false,'bootstrap')
   ON CONFLICT (vendor,model_id) DO NOTHING RETURNING vendor`;
  imported+=rows.length;
 }
 console.log(JSON.stringify({seeded:imported,catalogue:data.providers.length,unchanged:data.providers.length-imported}));
}
if(import.meta.main){try{await seedModelProviders()}finally{await closeDb()}}
