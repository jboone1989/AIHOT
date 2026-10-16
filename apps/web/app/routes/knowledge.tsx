import { useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/knowledge";
import { apiGet, cachedPage } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { localized, pageMeta } from "../lib/seo";
import { PhoneBar } from "../components/shell/PhoneBar";
import type { Screen } from "../components/shell/screens";
import { IconArrowRight, IconHistory, IconSearch } from "../components/icons";
import { KnowledgeExplorer, type KnowledgeGraph, type KnowledgeStats } from "../components/KnowledgeNetwork";
import { SITE } from "@aihot/site";
import { useText } from "../components/LanguageSwitch";

export const handle: Screen = { tab: "knowledge", name: "知识网络" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();
export async function loader({ request }: Route.LoaderArgs) {
  const [graph, stats] = await Promise.all([
    apiGet<KnowledgeGraph>("/api/site/knowledge/overview", {signal: request.signal, timeoutMs: 4_000}).catch(()=>({entities: 0, edges: [], status: "unavailable"} as KnowledgeGraph)),
    apiGet<KnowledgeStats>("/api/site/knowledge/stats", {signal: request.signal, timeoutMs: 4_000}).catch(()=>({episodes: 0, entities: 0, relations: 0, status: "unavailable"} as KnowledgeStats)),
  ]);
  return cachedPage(60, { graph, stats });
}
export function meta({ location }: Route.MetaArgs) {
  return localized(pageMeta({ title: `知识网络 | ${SITE.name}`, description: "探索新闻背后的实体关系、历史变化与可追溯的原始来源。", path: "/knowledge" }), location.pathname, {
    title: "Knowledge graph",
    description: "Explore the entities and relations behind the news, how they changed over time, and the original sources that support them.",
  });
}

export default function KnowledgePage() {
  const { graph, stats } = useLoaderData<typeof loader>();
  const [filter, setFilter] = useState("");
  const t = useText();
  const filtered = useMemo<KnowledgeGraph>(()=> ({
    ...graph, edges: filter.trim()
      ? graph.edges.filter(e => [e.subject.name,e.object.name,e.predicate,e.fact].some(s => s.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())))
      : graph.edges,
  }),[graph,filter]);
  return (
    <div className="lr-knowledge-page pb-12">
      <PhoneBar title={t("知识网络","Knowledge Graph")} />
      <header className="lr-knowledge-header">
        <div className="lr-eyebrow">LIVING KNOWLEDGE / 01—03</div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 data-page-title className="lr-page-title">{t("让信息形成","Make knowledge")}<span>{t("联系。","connected.")}</span></h1>
            <p className="mt-3 max-w-[720px] text-[14px] leading-[1.9] text-ink-3">{t("事件是短期的，知识可以持续积累。这里展示由 Graphiti 从新闻提取、存入 Neo4j 的真实实体关系；点开任何节点，都能沿着事实走向它的其他联系。","News events evolve quickly. This is an evolving knowledge graph extracted from reporting through Graphiti and stored in Neo4j. Open any node to explore its sourced connections.")}</p>
          </div>
          <Link to="/hot" className="lr-inline-link">{t("查看新闻事件树","View event timeline")} <IconArrowRight size={16}/></Link>
        </div>
        <div className="lr-metric-strip">
          {([{number:stats.episodes,label:t("入图报道","Reports"),code:"EPISODES"},{number:stats.entities,label:t("实体节点","Entities"),code:"ENTITIES"},{number:stats.relations,label:t("事实关系","Facts"),code:"RELATIONS"}] as const).map(m => (
            <div key={m.code}><div className="lr-eyebrow">{m.code}</div><strong>{stats.status === "unavailable" ? "—" : m.number.toLocaleString("en-US")}</strong><span>{m.label}</span></div>
          ))}
        </div>
      </header>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-ink">{t("关系探索工作台","Relationship Explorer")}</h2>
          <p className="mt-1 text-[12.5px] text-ink-4">{t("最近形成的部分关系 · 搜索筛选当前可见网络，不会发起模型调用","Recent relationship sample · Search filters this view only")}</p>
        </div>
        <label className="lr-knowledge-search"><IconSearch size={17}/><span className="sr-only">{t("筛选实体或关系","Filter entities or relationships")}</span><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder={t("筛选公司、人物、技术、关系…","Filter entities, companies, people, facts…")} /></label>
      </div>
      <div className="mt-5"><KnowledgeExplorer graph={filtered}/></div>
      <div className="lr-research-note mt-7">
        <IconHistory size={19}/>
        <div><strong>{t("不是“出现同一篇报道”就画线。","Co-occurrence is not a relationship.")}</strong><p>{t("这里的连线代表模型从报道材料中提取的关系事实，并保留时间和原始出处。AI 提取可能出现错误，重要结论应点击来源核实。未发现关系的实体不会被强行连接。","Connections are extracted from source material and keep timestamps and provenance. AI can make mistakes: verify consequential claims against their original sources. Entities are not joined without evidence.")}</p></div>
      </div>
    </div>
  );
}
