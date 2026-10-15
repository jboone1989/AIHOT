// AIHot owns only source material and the durable import cursor.
// Graphiti owns entity resolution, temporal edges and graph retrieval.
import { sql, closeDb } from "@aihot/backend/db";
const service=process.env.KNOWLEDGE_SERVICE_URL||"http://knowledge:8000";
type Article={id:string;revision:number;title:string;url:string;source_name:string;body_text:string|null;excerpt:string|null;published_at:Date|null};
async function main(){
 const [article]=await sql<Article[]>`
   SELECT a.id,a.revision,a.title,a.url,a.body_text,a.excerpt,a.published_at,s.name AS source_name
   FROM articles a JOIN sources s ON s.id=a.source_id
   LEFT JOIN knowledge_sync x ON x.article_id=a.id AND x.revision=a.revision
   WHERE a.processing_state='analyzed' AND s.participation_mode='editorial'
     AND x.article_id IS NULL
     AND length(coalesce(a.body_text,a.excerpt,''))>=80
     AND a.discovered_at>now()-interval '21 days'
   ORDER BY (s.tier='T1') DESC,a.discovered_at DESC LIMIT 1`;
 if(!article)return {status:"no_candidate"};
 const input={
   article_id:article.id,revision:article.revision,title:article.title,url:article.url,
   source:article.source_name,text:article.body_text?.slice(0,9500)||article.excerpt||"",
   published_at:article.published_at?.toISOString()??null
 };
 const r=await fetch(service+"/episodes",{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify(input),signal:AbortSignal.timeout(90000)});
 const json=await r.json().catch(()=>({}));
 if(!r.ok||!json.accepted)throw new Error("Graphiti ingestion failed: HTTP "+r.status);
 await sql`INSERT INTO knowledge_sync(article_id,revision,episode_id)
   VALUES(${article.id},${article.revision},${String(json.episode_id)})
   ON CONFLICT(article_id) DO UPDATE SET revision=excluded.revision,episode_id=excluded.episode_id,
   synced_at=now()`;
 return {status:"imported",articleId:article.id,revision:article.revision,episodeId:json.episode_id};
}
try{console.log(JSON.stringify(await main()));}
finally{await closeDb();}
