import { z } from "zod";
import { sql } from "../db.ts";
import { chatJson } from "../providers/llm.ts";
import { modelFor } from "../editorial/models.ts";
import { collapseWhitespace } from "../lib/text.ts";

export const KINDS=["organization","person","product","technology","asset","regulator","other"] as const;
export const RELATIONS=["released","developed","owns","invested_in","partnered_with","integrates","regulates","uses","offers_to","acquired","employed_by","funded","supplies_to"] as const;
const node=z.object({name:z.string().min(1),kind:z.string().min(1)});
const claim=z.object({subject:node,predicate:z.string().min(2).max(60),object:node,evidence:z.string().min(1)});
const schema=z.object({relations:z.array(claim).max(40)});
export type Claim=z.infer<typeof claim>;
export const entityKey=(n:{kind:string;name:string})=>n.kind+":"+n.name.normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase();
const PREDICATE_ALIASES:Record<string,string>={using:"uses",announced:"released",launched:"released"};
const KIND_ALIASES:Record<string,string>={company:"organization",business:"organization",model:"product",platform:"product",framework:"technology"};
export function supportedClaims(claims:Claim[],material:string):Claim[]{
  const compact=(s:string)=>collapseWhitespace(s).normalize("NFKC").toLowerCase();
  const text=compact(material),seen=new Set<string>(),out:Claim[]=[];
  for(const c of claims){
    const predicate=PREDICATE_ALIASES[c.predicate]??c.predicate;
    const subject={...c.subject,kind:KIND_ALIASES[c.subject.kind]??c.subject.kind};
    const object={...c.object,kind:KIND_ALIASES[c.object.kind]??c.object.kind};
    if(!RELATIONS.includes(predicate as typeof RELATIONS[number])
      || !KINDS.includes(subject.kind as typeof KINDS[number])
      || !KINDS.includes(object.kind as typeof KINDS[number])
      || subject.name.length>120 || object.name.length>120 || c.evidence.length<8 || c.evidence.length>600)continue;
    const a=entityKey(subject),b=entityKey(object),k=a+"|"+predicate+"|"+b;
    const quote=compact(c.evidence);
    if(a===b||!text.includes(quote)||seen.has(k))continue;
    // Both named endpoints must be in the actual quoted evidence, not elsewhere in the article.
    if(!quote.includes(compact(subject.name))||!quote.includes(compact(object.name)))continue;
    seen.add(k);out.push({...c,subject,object,predicate});
  }
  return out;
}
const SYSTEM="Extract ONLY explicitly asserted entity relations. Return JSON {relations:[{subject:{name,kind},predicate,object:{name,kind},evidence}]}. Kinds: "+KINDS.join(",")+". Predicates: "+RELATIONS.join(",")+". evidence MUST be a verbatim contiguous source quote proving this relation. Never infer relationships from mere co-occurrence; no alias guesses. If uncertain return {relations:[]}.";
type Article={id:string;revision:number;title:string;excerpt:string|null;body_text:string|null;source_name:string};
export async function extractKnowledgeOnce(articleId?:string){
  if(process.env.KNOWLEDGE_GRAPH_ENABLED!=="true"||process.env.MODEL_CALLS_ENABLED!=="true")return {status:"disabled"};
  const [a]=await sql<Article[]>`
    SELECT a.id,a.revision,a.title,a.excerpt,a.body_text,s.name AS source_name
    FROM articles a JOIN sources s ON s.id=a.source_id
    LEFT JOIN knowledge_extractions k ON k.article_id=a.id AND k.revision=a.revision
    WHERE a.processing_state='analyzed' AND s.participation_mode='editorial'
      AND k.article_id IS NULL
      AND (${articleId??null}::text IS NULL OR a.id=${articleId??null})
      AND a.discovered_at>now()-interval '21 days'
      AND length(coalesce(a.body_text,a.excerpt,''))>=80
    ORDER BY (s.tier='T1') DESC,a.discovered_at DESC LIMIT 1`;
  if(!a)return {status:"no_candidate"};
  const material=[a.title,a.excerpt??"",a.body_text?.slice(0,6000)??""].filter(Boolean).join("\n");
  const res=await chatJson({model:await modelFor("structure"),purpose:"knowledge_extract",
    subject:"article:"+a.id+"@"+a.revision,promptVersion:"knowledge-graph.v1",
    system:SYSTEM,user:"Source: "+a.source_name+"\n"+material,schema,
    temperature:0,maxTokens:1400,timeoutMs:38000});
  const claims=supportedClaims(res.data.relations,material);
  const status=await sql.begin(async tx=>{
    const [current]=await tx<{revision:number}[]>`SELECT revision FROM articles WHERE id=${a.id} FOR UPDATE`;
    if(current?.revision!==a.revision)return "superseded";
    await tx`DELETE FROM knowledge_claims WHERE article_id=${a.id}`;
    for(const c of claims){
      for(const n of [c.subject,c.object]){
        await tx`INSERT INTO knowledge_entities(entity_key,kind,name)
          VALUES(${entityKey(n)},${n.kind},${n.name.trim()}) ON CONFLICT DO NOTHING`;
      }
      await tx`INSERT INTO knowledge_claims(article_id,revision,subject_key,predicate,object_key,evidence,receipt_id)
        VALUES(${a.id},${a.revision},${entityKey(c.subject)},${c.predicate},${entityKey(c.object)},${c.evidence},${res.receiptId})
        ON CONFLICT DO NOTHING`;
    }
    await tx`INSERT INTO knowledge_extractions(article_id,revision,status,receipt_id)
      VALUES(${a.id},${a.revision},'complete',${res.receiptId})
      ON CONFLICT(article_id) DO UPDATE SET revision=EXCLUDED.revision,status=EXCLUDED.status,
      receipt_id=EXCLUDED.receipt_id,updated_at=now()`;
    return "complete";
  });
  return {status,articleId:a.id,claims:claims.length,rejected:res.data.relations.length-claims.length};
}
export interface GraphEdge{
 subject:{key:string;name:string;kind:string};predicate:string;
 object:{key:string;name:string;kind:string};
 evidence:Array<{articleId:string;url:string;title:string;source:string;quote:string;publishedAt:string|null}>;
}
type Row={subject_key:string;subject_name:string;subject_kind:string;object_key:string;object_name:string;object_kind:string;predicate:string;article_id:string;url:string;title:string;source_name:string;published_at:Date|null;quote:string};
function assemble(rows:Row[]):GraphEdge[]{
 const map=new Map<string,GraphEdge>();
 for(const r of rows){
  const k=r.subject_key+"|"+r.predicate+"|"+r.object_key;
  let edge=map.get(k);
  if(!edge){edge={subject:{key:r.subject_key,name:r.subject_name,kind:r.subject_kind},
   predicate:r.predicate,object:{key:r.object_key,name:r.object_name,kind:r.object_kind},evidence:[]};map.set(k,edge);}
  edge.evidence.push({articleId:r.article_id,url:r.url,title:r.title,source:r.source_name,quote:r.quote,publishedAt:r.published_at?.toISOString()??null});
 }
 return [...map.values()].sort((a,b)=>b.evidence.length-a.evidence.length);
}
const columns="c.subject_key,s.name AS subject_name,s.kind AS subject_kind,c.object_key,o.name AS object_name,o.kind AS object_kind,c.predicate,a.id AS article_id,a.url,a.title,src.name AS source_name,a.published_at,c.evidence AS quote";
const joins="FROM knowledge_claims c JOIN articles a ON a.id=c.article_id AND a.revision=c.revision JOIN sources src ON src.id=a.source_id JOIN knowledge_entities s ON s.entity_key=c.subject_key JOIN knowledge_entities o ON o.entity_key=c.object_key";
export async function graphForStory(publicId:string){
 const rows=await sql.unsafe<Row[]>(`SELECT ${columns} ${joins}
   JOIN fact_articles fa ON fa.article_id=a.id JOIN facts f ON f.id=fa.fact_id
   JOIN stories st ON st.id=f.story_id WHERE st.public_id=$1::uuid
   ORDER BY a.discovered_at DESC LIMIT 100`,[publicId]);
 const edges=assemble(rows);
 return {edges,entities:new Set(edges.flatMap(e=>[e.subject.key,e.object.key])).size};
}
export async function graphForEntity(key:string){
 const [n]=await sql<{entity_key:string;name:string;kind:string}[]>`SELECT entity_key,name,kind FROM knowledge_entities WHERE entity_key=${key}`;
 if(!n)return {entity:null,edges:[]};
 const rows=await sql.unsafe<Row[]>(`SELECT ${columns} ${joins}
   WHERE c.subject_key=$1 OR c.object_key=$1 ORDER BY a.discovered_at DESC LIMIT 100`,[key]);
 return {entity:{key:n.entity_key,name:n.name,kind:n.kind},edges:assemble(rows)};
}
export async function graphStats(){
 const [nodes,edges,processed]=await Promise.all([
  sql<{n:number}[]>`SELECT count(*)::int AS n FROM knowledge_entities`,
  sql<{n:number}[]>`SELECT count(*)::int AS n FROM knowledge_claims c JOIN articles a ON a.id=c.article_id AND a.revision=c.revision`,
  sql<{n:number}[]>`SELECT count(*)::int AS n FROM knowledge_extractions WHERE status='complete'`
 ]);
 return {entities:nodes[0]?.n??0,relations:edges[0]?.n??0,articles:processed[0]?.n??0};
}
