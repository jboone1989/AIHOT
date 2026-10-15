import { Link, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import type { TimelineResponse } from "@aihot/contracts/site";
import { cachedPage, loadOr404, apiGet } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { filterParams, hasFeedFilters, itemListLd, listPath, pageMeta, readFilters, siteLd } from "../lib/seo";
import { inNav } from "../components/shell/nav";
import type { Screen } from "../components/shell/screens";
import { Timeline } from "../features/feed/Timeline";
import { HotTopics } from "../features/feed/HotTopics";
import { ActiveFilters, CategoryTabs, FeedBar, SearchField } from "../features/feed/Filters";
import { IconArrowRight, IconArrowUpRight, IconGrid, IconHistory } from "../components/icons";
import { KnowledgeCanvas, type KnowledgeGraph, type KnowledgeStats } from "../components/KnowledgeNetwork";
import { useText, useUiLanguage } from "../components/LanguageSwitch";

const EMPTY_GRAPH: KnowledgeGraph = { entities: 0, edges: [], status: "unavailable" };
const EMPTY_STATS: KnowledgeStats = { entities: 0, relations: 0, episodes: 0, status: "unavailable" };
export const handle: Screen = { tab: "featured", name: "观察" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  if (q && q.trim()) throw redirect(`/all${url.search}`);
  const filters = readFilters(url.searchParams);
  const upstream = new Headers();
  const [data, graph, stats] = await Promise.all([
    loadOr404<TimelineResponse>(listPath("/api/site/timeline", filterParams(filters)), { responseHeaders: upstream, signal: request.signal }),
    apiGet<KnowledgeGraph>("/api/site/knowledge/overview", { signal: request.signal }).catch(() => EMPTY_GRAPH),
    apiGet<KnowledgeStats>("/api/site/knowledge/stats", { signal: request.signal }).catch(() => EMPTY_STATS),
  ]);
  return cachedPage(60, { data, filters, graph, stats }, upstream);
}

export function meta({ loaderData }: Route.MetaArgs) {
  const path = listPath("/", loaderData ? filterParams(loaderData.filters) : {});
  const titles = loaderData?.data.cards.map(c => c.item.title) ?? [];
  return pageMeta({
    title: "事件观察 · LivingRuntime",
    description: "实时追踪 AI、加密与金融事件，沿报道时间线深入长期知识关系与原始证据。",
    path, noindex: hasFeedFilters(loaderData?.filters),
    jsonLd: path === "/" ? [...siteLd(), itemListLd("/", "事件观察", titles)] : undefined,
  });
}

function KnowledgeTeaser({graph}: {graph: KnowledgeGraph}) {
  const highlight = graph.edges[0];
  const lang=useUiLanguage();
  const visibleEntity=(name:string)=>lang==="en"&&/[\u3400-\u9fff]/u.test(name)?"Source entity":name;
  const t=useText();
  return (
    <Link to="/knowledge" className="lr-intel-teaser group">
      <div className="lr-eyebrow text-[#9bd3c7]">02 / KNOWLEDGE MEMORY</div>
      <div className="mt-4 flex items-center justify-between">
        <h3 className="text-[21px] font-semibold text-white">{t("知识不止于单条新闻","Knowledge lasts beyond the news")}</h3>
        <IconArrowUpRight size={19} className="text-[#bcf0db] transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"/>
      </div>
      <p className="mt-2 text-[13px] leading-[1.8] text-[#acc8c7]">{t("人物、公司、技术与市场之间有依据的联系，在新报道到来后持续积累。","Evidence-backed connections between people, companies, technology and markets grow with every report.")}</p>
      <div className="mt-5 border-t border-white/10 pt-4 text-[12.5px] text-[#c5e5dd]">
        {highlight ? <><span className="font-semibold text-white">{visibleEntity(highlight.subject.name)}</span> <span className="mx-1 opacity-50">→</span> {visibleEntity(highlight.object.name)}</> : t("打开知识网络 · 浏览已核实的关系","Explore sourced relationships")}
      </div>
    </Link>
  );
}

function HomeHero({ graph, stats }: { graph: KnowledgeGraph; stats: KnowledgeStats }) {
  const t=useText();
  return (
    <>
      <section className="lr-home-hero" aria-labelledby="home-headline">
        <div className="lr-hero-copy">
          <div className="lr-eyebrow text-[#a2d8ce]"><span className="lr-pulse"/> LIVINGRUNTIME / INTELLIGENCE DESK</div>
          <h1 id="home-headline" className="lr-hero-title">{t("看见事件。","Follow events.")}<br/><em>{t("连接事实。","Connect the facts.")}</em></h1>
          <p className="lr-hero-lead">{t("新闻会滚动消失，关系却值得长期追踪。我们将公开报道组织成事件，再把其中有依据的实体关系沉淀为持续更新的知识网络。","Headlines fade. Connections endure. We organize reporting into evolving events and retain evidence-backed relationships in a living knowledge graph.")}</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link to="/knowledge" className="lr-button-primary">{t("探索知识网络","Explore Knowledge")} <IconArrowUpRight size={16}/></Link>
            <Link to="/hot" className="lr-button-quiet">{t("浏览事件树","Explore Events")} <IconArrowRight size={16}/></Link>
          </div>
          <div className="lr-hero-stats" aria-label={t("实时图谱规模","Live knowledge graph metrics")}>
            <div><strong>{stats.status === "unavailable" ? "—" : stats.episodes.toLocaleString("en-US")}</strong><span>{t("已入图报道","Reports indexed")}</span></div>
            <div><strong>{stats.status === "unavailable" ? "—" : stats.entities.toLocaleString("en-US")}</strong><span>{t("识别实体","Entities")}</span></div>
            <div><strong>{stats.status === "unavailable" ? "—" : stats.relations.toLocaleString("en-US")}</strong><span>{t("事实关系","Relationships")}</span></div>
          </div>
        </div>
        <div className="lr-hero-visual">
          <div className="lr-hero-visual-title"><span>ENTITY CONSTELLATION</span><span>LIVE GRAPH ↗</span></div>
          <KnowledgeCanvas edges={graph.edges} compact />
          <Link to="/knowledge" className="lr-hero-visual-footer">{t("基于真实新闻来源的关系网络","Relations grounded in published sources")} <IconArrowRight size={15}/></Link>
        </div>
      </section>
      <div className="lr-feature-rail">
        <Link to="/hot" className="lr-feature-link">
          <span className="lr-eyebrow">01 / EVENT STREAM</span>
          <strong><IconHistory size={18}/> {t("沿时间理解变化","Follow events through time")}</strong>
          <small>{t("同一事件的不同来源、后续进展与热点变化","Multiple sources, developments and emerging patterns")}</small>
        </Link>
        <KnowledgeTeaser graph={graph}/>
        <Link to="/knowledge" className="lr-feature-link">
          <span className="lr-eyebrow">03 / EVIDENCE TRAIL</span>
          <strong><IconGrid size={18}/> {t("每段关系有迹可循","Trace every connection")}</strong>
          <small>{t("从关系事实返回来源、报道时间与原文","Source reports, timestamps and original evidence")}</small>
        </Link>
      </div>
    </>
  );
}

export default function Home() {
  const { data, filters, graph, stats } = useLoaderData<typeof loader>();
  const t=useText();
  const lang=useUiLanguage();
  const filtered = Boolean(filters.tag || filters.category || (filters.channel !== "all"));
  return (
    <div className="pb-6 lr-home">
      <FeedBar base="/" category={filters.category} channel={filters.channel} />
      <ActiveFilters base="/" category={filters.category} channel={filters.channel} tag={filters.tag} />
      {!filtered && <HomeHero graph={graph} stats={stats} />}
      <div className="lr-feed-heading">
        <div>
          <div className="lr-eyebrow">THE OBSERVATION / {t("实时信息流","NEWS STREAM")}</div>
          <h2>{filters.tag ? `#${filters.tag}` : filtered ? t("筛选后的动态","Filtered news") : t("正在发生的事","What’s happening now")}</h2>
          <p>{t("先看事件，再追踪事实背后的关系。","Explore the event, then follow the evidence.")}</p>
        </div>
        <Link to="/all" className="lr-inline-link">{t("全部动态","All news")} <IconArrowRight size={16}/></Link>
      </div>
      <div className="hidden lg:block">
        <div className="mb-5 flex items-center justify-between gap-4">
          <CategoryTabs base="/" category={filters.category} channel={filters.channel} layoutId="home-cat-desk" className="min-w-0" />
          <SearchField keep={{category: filters.category}}/>
        </div>
      </div>
      {lang==="zh" && data.hot && inNav("/hot") && <HotTopics entries={data.hot}/>}
      <Timeline initial={data} filters={data.filters}/>
    </div>
  );
}
