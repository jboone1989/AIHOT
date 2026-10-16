/** Development acceptance probe for the Graphiti bridge (not a second graph engine). */
import {sql, closeDb} from "@aihot/backend/db";
import {ingestGraphitiOnce, graphStats, graphSearch} from "@aihot/backend/knowledge/graphiti";

async function main() {
  const mode=process.argv[2]??"read";
  if(mode==="ingest") {
    console.log("ingest",JSON.stringify(await ingestGraphitiOnce()));
  }
  const [receipts,articles] = await Promise.all([
    sql<{article_id:string;revision:number;episode_id:string;source:string}[]>`
      SELECT g.article_id,g.revision,g.episode_id,s.name AS source
      FROM graphiti_ingestions g JOIN articles a ON a.id=g.article_id
      JOIN sources s ON s.id=a.source_id
      ORDER BY a.discovered_at DESC LIMIT 15`,
    sql<{id:string;revision:number;source:string}[]>`
      SELECT a.id,a.revision,s.name AS source FROM articles a
      JOIN sources s ON s.id=a.source_id
      LEFT JOIN graphiti_ingestions g ON g.article_id=a.id AND g.revision=a.revision
      WHERE a.processing_state='analyzed' AND s.participation_mode='editorial'
        AND g.article_id IS NULL AND a.revision>=1
        AND a.discovered_at>now()-interval '21 days'
        AND length(coalesce(a.body_text,a.excerpt,''))>=80
      ORDER BY (s.tier='T1') DESC,a.discovered_at DESC LIMIT 5`,
  ]);
  console.log("receipts",JSON.stringify(receipts));
  console.log("next_eligible_articles",JSON.stringify(articles));
  console.log("graphiti_stats",JSON.stringify(await graphStats()));
  if(mode==="search") {
    const results=await graphSearch("Gemini Argon Google",5);
    console.log("search",JSON.stringify({fact_count:results.facts.length,sourced_episodes:Object.keys(results.sources).length,first_fact:results.facts[0]}));
  }
}
try {await main();}catch(e){console.error(e);process.exitCode=1;}finally{await closeDb();}
