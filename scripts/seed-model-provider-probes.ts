/** Seed only missing per-Provider test samples; never overwrite admin-edited model requests. */
import {readFileSync} from "node:fs";
import path from "node:path";
import {REPO_ROOT} from "@aihot/backend/config";
import {sql,closeDb} from "@aihot/backend/db";
import {checkProviderChanges} from "@aihot/backend/providers/registry/validation";
type Row={vendor:string;modelId:string;probeSpec:unknown};
export async function seedProviderProbes(){
 const config=JSON.parse(readFileSync(path.join(REPO_ROOT,"config/model-provider-probes.json"),"utf8")) as {providers:Row[]};
 let seeded=0;
 for(const row of config.providers){
  if(row.probeSpec===null)continue;
  checkProviderChanges({probeSpec:row.probeSpec as never});
  const changed=await sql`UPDATE model_providers SET probe_spec=${sql.json(row.probeSpec as never)},updated_at=now()
   WHERE vendor=${row.vendor} AND model_id=${row.modelId} AND probe_spec IS NULL RETURNING model_id`;
  seeded+=changed.length;
 }
 console.log(JSON.stringify({catalogue:config.providers.length,added:seeded,unchangedOrUnconfigured:config.providers.length-seeded}));
}
if(import.meta.main){try{await seedProviderProbes()}finally{await closeDb()}}
