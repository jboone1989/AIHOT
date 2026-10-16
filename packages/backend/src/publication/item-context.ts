// What the site knows around one public report, for its English page: the event it belongs to and the
// other public reports of that event, the relations Graphiti extracted from it (public evidence only, as
// the report itself is public), and exchange prices around it for the assets it names. Prices are set side
// by side only; nothing here says the report moved them.
import type { ItemContext } from "@aihot/contracts/site";
import { sql } from "../db.ts";
import { graphForArticle } from "../knowledge/graphiti.ts";
import { ENGLISH_ITEM_INPUTS } from "./items.ts";
import { assetsNamed, marketAround } from "./market.ts";
import { publicSourceName } from "./rules.ts";
import { storyReportCondition } from "./scope.ts";
import { storyTexts } from "./story-text.ts";

const COVERAGE_LIMIT = 8;
const FACT_LIMIT = 8;
/** An English page is indexed when its report is one of several on its event: the page then adds context of its own. */
export const INDEXED_MIN_REPORTS = 2;

const hasHan = (s: string) => /[㐀-鿿]/u.test(s);

export async function loadItemContext(id: string, now = new Date()): Promise<ItemContext | null> {
  const [item] = await sql<{ story_id: number | null; revision: number; at: Date; title: string; original_title: string | null; en_title: string | null; en_summary: string | null }[]>`
    SELECT p.story_id, a.revision, coalesce(p.published_at, p.discovered_at) AS at, p.title, p.original_title, ec.title AS en_title, ec.summary AS en_summary
    FROM publications p JOIN sources s ON s.id = p.source_id JOIN articles a ON a.id = p.article_id
    LEFT JOIN english_copies ec ON ec.article_id = p.article_id AND ec.outcome = 'written' AND ec.inputs_hash = ${ENGLISH_ITEM_INPUTS}
    WHERE p.article_id = ${id} AND ${storyReportCondition(now)}`;
  if (!item) return null;

  const [story] = item.story_id
    ? await sql<{ id: number; public_id: string; title: string }[]>`SELECT id, public_id::text, title FROM stories WHERE id = ${item.story_id} AND merged_into IS NULL`
    : [];
  const reports = story
    ? await sql<{ id: string; source_name: string; at: Date; original_title: string | null; en_title: string | null }[]>`
        SELECT p.article_id AS id, s.name AS source_name, coalesce(p.published_at, p.discovered_at) AS at, p.original_title, ec.title AS en_title
        FROM publications p JOIN sources s ON s.id = p.source_id
        LEFT JOIN english_copies ec ON ec.article_id = p.article_id AND ec.outcome = 'written' AND ec.inputs_hash = ${ENGLISH_ITEM_INPUTS}
        WHERE p.story_id = ${story.id} AND ${storyReportCondition(now)}
        ORDER BY at, p.article_id`
    : [];
  const text = story ? (await storyTexts([story.id], now)).get(story.id) : undefined;
  const others = reports.filter((r) => r.id !== id);
  // The reports nearest in time to this one, in time order.
  const near = [...others].sort((a, b) => Math.abs(a.at.getTime() - item.at.getTime()) - Math.abs(b.at.getTime() - item.at.getTime()))
    .slice(0, COVERAGE_LIMIT).sort((a, b) => a.at.getTime() - b.at.getTime());

  const graph = await graphForArticle(id, item.revision);
  const seen = new Set<string>();
  const facts = graph.edges
    .filter((e) => e.evidence.some((ev) => ev.articleId === id) && !e.invalidAt)
    .filter((e) => !seen.has(e.fact) && !!seen.add(e.fact))
    .slice(0, FACT_LIMIT)
    .map((e) => ({ subject: e.subject.name, predicate: e.predicate, object: e.object.name, fact: e.fact }));

  const assets = assetsNamed([item.title, item.original_title ?? "", item.en_title ?? "", item.en_summary ?? ""]);
  const market = assets.length ? await marketAround(assets, item.at, now) : null;

  return {
    story: story ? {
      publicId: story.public_id,
      english: text?.english ?? null,
      reportCount: reports.length,
      sourceCount: new Set(reports.map((r) => r.source_name)).size,
    } : null,
    coverage: near.map((r) => ({
      id: r.id,
      source: publicSourceName(r.source_name),
      publishedAt: r.at.toISOString(),
      title: r.en_title ?? (r.original_title && !hasHan(r.original_title) ? r.original_title : null),
      earlier: r.at.getTime() < item.at.getTime(),
    })),
    facts,
    market: market && market.assets.length ? market : null,
    indexable: reports.length >= INDEXED_MIN_REPORTS,
  };
}
