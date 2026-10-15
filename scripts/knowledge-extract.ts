// Dedicated one-article knowledge extraction, safe for manual verification.
import {extractKnowledgeOnce,graphStats} from "@aihot/backend/knowledge/graph";
import {closeDb} from "@aihot/backend/db";
try{
  console.log(JSON.stringify(await extractKnowledgeOnce(process.argv[2])));
  console.log(JSON.stringify(await graphStats()));
}finally{await closeDb();}
