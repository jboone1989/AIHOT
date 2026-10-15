// Additive coverage rollout. Existing editorial sources and their fetch cursors
// are deliberately untouched. These three feeds were checked from cn-dev.
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "@aihot/backend/config";
import { sql, closeDb } from "@aihot/backend/db";
import { assertSupportedConfig } from "@aihot/backend/sources/config-keys";
const ids = ["rss-google-ai", "rss-dev-ai", "rss-dev-crypto"];
type Source={id:string;name:string;kind:"rss";config:Record<string,unknown>;tier:string;
 owner_entity_id?:string|null;participation_mode:"editorial"|"hot_signal"|"isolated";
 interval_minutes:number;tags:string[];site_fulltext:boolean;syndicate_fulltext:boolean};
const file=JSON.parse(readFileSync(path.join(REPO_ROOT,"industry/sources.json"),"utf8")) as {sources:Source[]};
try {
 for(const id of ids){
  const s=file.sources.find(x=>x.id===id);if(!s)throw new Error("missing coverage source "+id);
  assertSupportedConfig(s.kind,s.config);
  const {name,kind,config,tier,owner_entity_id,participation_mode,interval_minutes,tags,site_fulltext,syndicate_fulltext}=s;
  await sql`INSERT INTO sources (id,name,kind,config,tier,first_party,owner_entity_id,
   participation_mode,interval_minutes,tags,site_fulltext,syndicate_fulltext,enabled,next_fetch_at)
   VALUES (${id},${name},${kind},${sql.json(config as never)},${tier},${tier==="T1"},${owner_entity_id??null},
    ${participation_mode},${interval_minutes},${tags},${site_fulltext},${syndicate_fulltext},true,now())
   ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,config=EXCLUDED.config,
     tier=EXCLUDED.tier,first_party=EXCLUDED.first_party,
     owner_entity_id=EXCLUDED.owner_entity_id,participation_mode=EXCLUDED.participation_mode,
     interval_minutes=EXCLUDED.interval_minutes,tags=EXCLUDED.tags,
     site_fulltext=EXCLUDED.site_fulltext,syndicate_fulltext=EXCLUDED.syndicate_fulltext,enabled=true`;
  console.log("coverage source registered: "+id+" ("+participation_mode+")");
 }
}finally{await closeDb();}
