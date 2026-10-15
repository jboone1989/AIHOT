import { sql } from "../db.ts";

type Article = {
  id: string; revision: number; title: string; url: string;
  excerpt: string | null; body_text: string | null;
  source_name: string; published_at: Date | null;
};
type Evidence = { articleId: string; url: string; source: string; quote: string; publishedAt: string | null };
type Edge = {
  id: string; subject: { key: string; name: string; kind: string };
  predicate: string; object: { key: string; name: string; kind: string };
  fact: string; validAt: string | null; invalidAt: string | null; evidence: Evidence[];
};
type Graph = { entities: number; edges: Edge[]; status?: string };
const emptyGraph = (status: string): Graph => ({ entities: 0, edges: [], status });

async function graphiti<T>(path: string, options?: { method?: string; body?: unknown; timeoutMs?: number }): Promise<T> {
  const origin = process.env.GRAPHITI_API_URL;
  if (!origin) throw new Error("Graphiti URL is not configured");
  const response = await fetch(origin.replace(/\/$/, "") + path, {
    method: options?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(options?.timeoutMs ?? 8000),
  });
  if (!response.ok) throw new Error("Graphiti HTTP " + response.status);
  return await response.json() as T;
}

/** One new article revision per scheduled tick. Failed requests are NOT marked complete. */
export async function ingestGraphitiOnce() {
  if (process.env.GRAPHITI_INGEST_ENABLED !== "true" || process.env.MODEL_CALLS_ENABLED !== "true")
    return { status: "disabled" };
  const [article] = await sql<Article[]>`
    SELECT a.id, a.revision, a.title, a.url, a.excerpt, a.body_text,
           a.published_at, s.name AS source_name
    FROM articles a JOIN sources s ON s.id=a.source_id
    LEFT JOIN graphiti_ingestions g ON g.article_id=a.id AND g.revision=a.revision
    WHERE a.processing_state='analyzed' AND s.participation_mode='editorial'
      AND g.article_id IS NULL AND a.revision >= 1
      AND a.discovered_at > now() - interval '21 days'
      AND length(coalesce(a.body_text, a.excerpt, '')) >= 80
    ORDER BY (s.tier='T1') DESC, a.discovered_at DESC LIMIT 1`;
  if (!article) return { status: "no_candidate" };
  const text = [article.title, article.excerpt, article.body_text?.slice(0, 8500)]
    .filter(Boolean).join("\n").slice(0, 9950);
  const receipt = await graphiti<{ accepted: boolean; episode_id: string; duplicate: boolean }>("/episodes", {
    method: "POST", timeoutMs: 180000,
    body: {
      article_id: article.id, revision: article.revision, title: article.title,
      url: article.url, source: article.source_name, text,
      published_at: article.published_at?.toISOString() ?? null,
    },
  });
  if (!receipt.accepted || !receipt.episode_id) throw new Error("Graphiti did not accept episode");
  await sql`
    INSERT INTO graphiti_ingestions(article_id,revision,episode_id)
    VALUES(${article.id},${article.revision},${receipt.episode_id})
    ON CONFLICT (article_id,revision) DO NOTHING`;
  return { status: "ingested", articleId: article.id, duplicate: receipt.duplicate };
}

/** AIHot is the authority for story membership, Graphiti for knowledge relations. */
export async function graphForStory(publicId: string): Promise<Graph> {
  if (!process.env.GRAPHITI_API_URL) return emptyGraph("disabled");
  const articles = await sql<{ id: string; revision: number }[]>`
    SELECT DISTINCT a.id, a.revision FROM articles a
    JOIN fact_articles fa ON fa.article_id=a.id
    JOIN facts f ON f.id=fa.fact_id
    JOIN stories st ON st.id=f.story_id
    WHERE st.public_id=${publicId}::uuid
    ORDER BY a.id LIMIT 100`;
  if (!articles.length) return emptyGraph("empty");
  try {
    return await graphiti<Graph>("/relations/by-articles", {
      method: "POST", body: { articles: articles.map(a => a.id + ":r" + a.revision), limit: 60 },
    });
  } catch (error) {
    console.error("graphiti_story_lookup_failed", error);
    return emptyGraph("unavailable");
  }
}

export async function graphForEntity(uuid: string) {
  if (!process.env.GRAPHITI_API_URL) return { entity: null, edges: [], status: "disabled" };
  try {
    return await graphiti<{ entity: {key:string;name:string;kind:string;summary?:string|null}|null; edges:Edge[]; status?: string }>("/entities/" + encodeURIComponent(uuid));
  } catch (error) {
    console.error("graphiti_entity_lookup_failed", error);
    return { entity: null, edges: [], status: "unavailable" };
  }
}

export async function graphStats() {
  if (!process.env.GRAPHITI_API_URL) return { entities: 0, relations: 0, episodes: 0, status: "disabled" };
  try { return await graphiti<{ entities:number; relations:number; episodes:number }>("/stats"); }
  catch (error) {
    console.error("graphiti_stats_failed", error);
    return { entities: 0, relations: 0, episodes: 0, status: "unavailable" };
  }
}

/** Authenticated future Ferro retrieval, without LlamaIndex or public embedding abuse. */
export async function graphSearch(text: string, limit: number) {
  return await graphiti<{ sources: Record<string,{name:string;url:string|null;title:string}>; facts: unknown[] }>("/search", {
    method: "POST", body: { text, limit }, timeoutMs: 30000,
  });
}


export async function graphOverview(): Promise<Graph> {
  if (!process.env.GRAPHITI_API_URL) return emptyGraph("disabled");
  try { return await graphiti<Graph>("/overview"); }
  catch (error) {
    console.error("graphiti_overview_failed", error);
    return emptyGraph("unavailable");
  }
}
