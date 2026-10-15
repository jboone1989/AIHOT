import {sql,closeDb} from "@aihot/backend/db";
try{
 const claims=await sql<{subject_name:string;predicate:string;object_name:string;source:string;url:string;evidence:string;public_id:string|null}[]>`
 SELECT s.name AS subject_name,c.predicate,o.name AS object_name,src.name AS source,a.url,c.evidence,
   (SELECT st.public_id::text FROM fact_articles fa JOIN facts f ON f.id=fa.fact_id JOIN stories st ON st.id=f.story_id WHERE fa.article_id=a.id LIMIT 1) AS public_id
 FROM knowledge_claims c JOIN knowledge_entities s ON s.entity_key=c.subject_key
 JOIN knowledge_entities o ON o.entity_key=c.object_key
 JOIN articles a ON a.id=c.article_id AND a.revision=c.revision
 JOIN sources src ON src.id=a.source_id
 ORDER BY c.created_at DESC LIMIT 8`;
 console.log(JSON.stringify(claims));
}finally{await closeDb();}
