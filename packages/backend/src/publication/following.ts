// What a reader follows, read back as one list. The follow list lives only in the reader's browser and
// arrives in the query; nothing about it is stored here. Topics take their selected reports (the topic
// index), entities the public reports their Graphiti relations cite.
import type { FeedItemSummary } from "@aihot/contracts/site";
import { sql } from "../db.ts";
import { ITEM_COLUMNS, ITEM_FROM, toFeedItemSummary, type ItemRow } from "./items.ts";
import { citedArticleIds, entityGraph } from "./knowledge.ts";
import { storyReportCondition } from "./scope.ts";
import { findTopic, topicMemberIds } from "./topics.ts";

export const FOLLOW_LIMITS = { topics: 30, entities: 20, items: 40 } as const;
const ENTITY_KEY = /^[A-Za-z0-9_-]{1,80}$/;

export interface FollowingResponse {
  items: Array<FeedItemSummary & { via: string[] }>;
  /** The follows that were found, with their current names; unknown ones are left out. */
  follows: { topics: Array<{ slug: string; name: string }>; entities: Array<{ key: string; name: string }> };
}

/** Comma-separated slugs or keys from a query value: known shapes only, at most `limit`, in order. */
export function followList(value: unknown, limit: number, shape: RegExp): string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(",").map((v) => v.trim()).filter((v) => shape.test(v)))].slice(0, limit);
}

export const isEntityKey = (v: string) => ENTITY_KEY.test(v);

export async function followingItems(topicSlugs: string[], entityKeys: string[], now = new Date()): Promise<FollowingResponse> {
  const topics = topicSlugs.map(findTopic).filter((t) => t !== null);
  const [members, graphs] = await Promise.all([
    topicMemberIds(topics.map((t) => t.slug), FOLLOW_LIMITS.items),
    Promise.all(entityKeys.filter(isEntityKey).map(async (key) => ({ key, graph: await entityGraph(key) }))),
  ]);
  const via = new Map<string, string[]>();
  const add = (id: string, name: string) => {
    const names = via.get(id) ?? [];
    if (!names.includes(name)) names.push(name);
    via.set(id, names);
  };
  for (const t of topics) for (const id of members.get(t.slug) ?? []) add(id, t.name);
  const entities = graphs.flatMap(({ key, graph }) => (graph.entity ? [{ key, name: graph.entity.name, ids: citedArticleIds(graph) }] : []));
  for (const e of entities) for (const id of e.ids) add(id, e.name);
  const ids = [...via.keys()];
  const rows = ids.length
    ? await sql<ItemRow[]>`SELECT ${ITEM_COLUMNS} ${ITEM_FROM}
        WHERE p.article_id = ANY(${ids}::text[]) AND ${storyReportCondition(now)}
        ORDER BY p.timeline_at DESC, p.article_id DESC LIMIT ${FOLLOW_LIMITS.items}`
    : [];
  return {
    items: rows.map((r) => ({ ...toFeedItemSummary(r), via: via.get(r.id) ?? [] })),
    follows: { topics: topics.map((t) => ({ slug: t.slug, name: t.name })), entities: entities.map(({ key, name }) => ({ key, name })) },
  };
}
