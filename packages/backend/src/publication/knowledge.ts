// An entity's public profile: its Graphiti relations, plus the public reports those relations cite and the
// events (stories) those reports belong to. Graphiti owns the relations; this database owns what is
// public, so a cited report that was withdrawn, held back or never published is left out here.
import { sql } from "../db.ts";
import { graphForEntity } from "../knowledge/graphiti.ts";
import { cachedByKey } from "../lib/cache.ts";
import { publicSourceName } from "./rules.ts";
import { storyReportCondition } from "./scope.ts";

export interface EntityReport {
  id: string;
  title: string;
  originalTitle: string | null;
  source: { name: string; firstParty: boolean };
  publishedAt: string;
}
export interface EntityStory {
  publicId: string;
  title: string;
  /** A cited report's English original title, for English reading. */
  englishTitle: string | null;
  /** Of this entity's cited reports, how many belong to the story. */
  reportCount: number;
  latestAt: string;
}

const hasHan = (s: string) => /[㐀-鿿]/u.test(s);

/** The cited reports that are public now, newest first, each with the live story it belongs to (if any). */
export async function citedReports(articleIds: string[], now = new Date()) {
  if (articleIds.length === 0) return { reports: [] as EntityReport[], stories: [] as EntityStory[] };
  const rows = await sql<{
    id: string; title: string; original_title: string | null; at: Date; source_name: string; first_party: boolean;
    story_public_id: string | null; story_title: string | null;
  }[]>`
    SELECT DISTINCT ON (p.article_id) p.article_id AS id, p.title, p.original_title,
      coalesce(p.published_at, p.discovered_at) AS at, s.name AS source_name, (s.tier = 'T1') AS first_party,
      st.public_id::text AS story_public_id, st.title AS story_title
    FROM publications p JOIN sources s ON s.id = p.source_id
    LEFT JOIN fact_articles fa ON fa.article_id = p.article_id
    LEFT JOIN facts f ON f.id = fa.fact_id
    LEFT JOIN stories st ON st.id = f.story_id AND st.merged_into IS NULL
    WHERE p.article_id = ANY(${articleIds}::text[]) AND ${storyReportCondition(now)}
    ORDER BY p.article_id, (fa.role = 'primary') DESC NULLS LAST, (st.id IS NULL), f.id`;
  rows.sort((a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id));
  const reports: EntityReport[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    originalTitle: r.original_title,
    source: { name: publicSourceName(r.source_name), firstParty: r.first_party },
    publishedAt: r.at.toISOString(),
  }));
  const stories = new Map<string, EntityStory>();
  for (const r of rows) {
    if (!r.story_public_id || !r.story_title) continue;
    const story = stories.get(r.story_public_id);
    const english = r.original_title && !hasHan(r.original_title) ? r.original_title : null;
    if (story) {
      story.reportCount += 1;
      story.englishTitle ??= english;
    } else {
      stories.set(r.story_public_id, { publicId: r.story_public_id, title: r.story_title, englishTitle: english, reportCount: 1, latestAt: r.at.toISOString() });
    }
  }
  return { reports, stories: [...stories.values()] };
}

/** One entity's Graphiti relations, kept a minute: profiles, follows and feeds ask for the same entities. */
export const entityGraph = cachedByKey((key: string) => key, graphForEntity, { freshMs: 60_000, maxStaleMs: 60_000, maxKeys: 500 });

/** The articles an entity's relations cite, as evidence ids. */
export const citedArticleIds = (graph: Awaited<ReturnType<typeof graphForEntity>>) =>
  [...new Set(graph.edges.flatMap((e) => e.evidence.map((ev) => ev.articleId)).filter(Boolean))];

/** The relations around one Graphiti entity, with the public reports and events behind them. */
export async function entityProfile(key: string) {
  const graph = await entityGraph(key);
  const ids = citedArticleIds(graph);
  const { reports, stories } = await citedReports(ids);
  return { ...graph, reports: reports.slice(0, 30), stories: stories.slice(0, 12) };
}
