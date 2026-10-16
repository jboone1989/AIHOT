import { Link } from "react-router";
import { SITE } from "@aihot/site";
import type { Route } from "./+types/analytics";
import { adminGet } from "../../lib/admin.server";
import { AdminPage, Card, Stat } from "../../features/admin/ui";
import { ExternalAnalytics, type ExternalAnalyticsData } from "../../features/admin/ExternalAnalytics";

type Metric = { name: string; count: number; sessions: number };
type Day = { day: string; page_views: number; sessions: number; graph_sessions: number };
type Overview = ExternalAnalyticsData & {
  cloudflare: {state: "unconfigured" | "ready" | "empty" | "error"; pageViews: number | null; daily: Array<{day: string; pageViews: number}>; refreshedAt: string | null; message?: string};
  periodDays: number; asOf: string; weeklyEffectiveExplorers: number;
  ingestion: {total_events: number; last_event_at: string | null};
  totals: { page_views?: number; sessions?: number; story_sessions?: number; graph_sessions?: number; source_sessions?: number; search_sessions?: number };
  daily: Day[]; events: Metric[];
  content: Array<{ page_type: string; content_id: string; count: number }>;
  languages: Array<{ language: string; page_views: number }>;
  referrers: Array<{ host: string; page_views: number }>;
  performance: { samples: number; mean_ms: number | null; p75_ms: number | null };
};
export async function loader({ request }: Route.LoaderArgs) {
  return adminGet<Overview>(request, "/api/admin/analytics");
}
export const meta: Route.MetaFunction = () => [{ title: `流量与行为 · ${SITE.name} 后台` }, { name: "robots", content: "noindex" }];
export const headers: Route.HeadersFunction = () => ({ "Cache-Control": "private, no-store" });
const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("zh-CN");
const pct = (part: number | undefined, total: number | undefined) => total ? ((100 * (part ?? 0)) / total).toFixed(1) + "%" : "—";
const names: Record<string, string> = {
  page_view: "页面浏览", story_open: "事件打开", item_open: "报道打开", graph_node_select: "Graph 节点选择",
  graph_relation_select: "关系证据选择", source_open: "来源外链", search_submit: "站内搜索",
  navigation_complete: "页面切换", agent_access_open: "Agent 接入", feedback_open: "反馈入口",
};
export default function AnalyticsAdmin({ loaderData: a }: Route.ComponentProps) {
  const totals = a.totals;
  const hasData = a.ingestion.total_events > 0;
  const metric = (value: number | null | undefined) => hasData ? n(value) : "—";
  const max = Math.max(1, ...a.daily.map(d => d.page_views));
  return (
    <AdminPage title="流量与行为" subtitle={<>最近 {a.periodDays} 天 · 更新于 {a.asOf.slice(0,16).replace("T", " ") + " UTC"} · 匿名会话统计，不等于独立访客数（UV）</>}>
      <Card className="mb-5" title="Cloudflare Web Analytics · 最近 7 天">
        {a.cloudflare.state === "ready" || a.cloudflare.state === "empty" ? <>
          <p className="num text-[24px] font-semibold">{n(a.cloudflare.pageViews)} PV</p>
          <p className="text-[12px] text-ink-3">数据源：Cloudflare RUM（独立统计口径，不与站内 PV 相加）· 更新 {a.cloudflare.refreshedAt?.slice(0,16).replace("T"," ")} UTC</p>
          {a.cloudflare.state === "empty" && <p className="text-[12px] text-ink-3">API 已连通，最近 7 天暂未返回页面浏览数据。</p>}
          <div className="mt-3 space-y-1">{a.cloudflare.daily.map(d => <div key={d.day} className="flex justify-between text-[12px]"><span>{d.day}</span><span className="num">{n(d.pageViews)} PV</span></div>)}</div>
        </> : <p className="text-[13px] text-ink-3">{a.cloudflare.message ?? "尚未取得 Cloudflare 数据"}</p>}
      </Card>
      <ExternalAnalytics posthog={a.posthog} searchConsole={a.searchConsole}/>
      <div role="status" className="mb-5 rounded-panel border border-line bg-bg-sunk p-4 text-[13px] text-ink-2">{!hasData ? "尚未收到任何真实访问事件。数据采集未得到验证，所有指标暂不显示；不会使用模拟数据。" : `已收到 ${n(a.ingestion.total_events)} 条真实入库事件。最近一次：${a.ingestion.last_event_at ?? "未知"}。访客数不等于匿名会话数。`}</div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="7 天有效知识探索" value={metric(a.weeklyEffectiveExplorers)} hint="同一匿名会话：打开事件后选择 Graph 节点或访问原文"/>
        <Stat label="页面浏览 PV" value={metric(totals.page_views)} hint="仅站内匿名事件，非 CDN 请求数"/>
        <Stat label="匿名会话" value={metric(totals.sessions)} hint="本标签页会话 ID，非 UV"/>
        <Stat label="事件打开会话" value={metric(totals.story_sessions)} hint={hasData ? pct(totals.story_sessions, totals.sessions) + " / 会话" : "尚无样本"} />
        <Stat label="Graph 使用会话" value={metric(totals.graph_sessions)} hint={hasData ? pct(totals.graph_sessions, totals.sessions) + " / 会话" : "尚无样本"} />
        <Stat label="来源跳转会话" value={metric(totals.source_sessions)} />
        <Stat label="搜索会话" value={metric(totals.search_sessions)} />
        <Stat label="页面切换耗时 P75" value={a.performance.p75_ms == null ? "—" : a.performance.p75_ms + "ms"} hint={hasData ? n(a.performance.samples) + " 次客户端样本" : "尚无样本"}/>
        <Stat label="切换平均耗时" value={a.performance.mean_ms == null ? "—" : a.performance.mean_ms + "ms"} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="按天流量（UTC，最近 30 天）">
          {a.daily.length === 0 ? <p className="text-[13px] text-ink-4">尚无统计事件。上线前的访问数据无法补录。</p> :
            <div className="space-y-2" role="list" aria-label="每天的页面浏览与会话">
              {a.daily.map(day => <div key={day.day} role="listitem" className="grid grid-cols-[90px_minmax(0,1fr)_75px] items-center gap-2 text-[12px]">
                <time dateTime={day.day} className="text-ink-3">{day.day.slice(5)}</time>
                <div className="h-3 rounded-full bg-bg-sunk"><div className="h-3 rounded-full bg-accent" style={{ width: `${100 * day.page_views / max}%` }}/></div>
                <span className="num text-right text-ink-2">{n(day.page_views)} PV</span>
              </div>)}
            </div>}
        </Card>
        <Card title="关键行为">
          {a.events.length ? <div className="space-y-2 text-[13px]">{a.events.map(e=><div key={e.name} className="flex justify-between border-b border-line-soft pb-2 last:border-0"><span className="text-ink-3">{names[e.name] ?? e.name}</span><span className="num">{n(e.count)} 次 · {n(e.sessions)} 会话</span></div>)}</div> : <p className="text-ink-4 text-[13px]">尚无数据</p>}
        </Card>
        <Card title="被打开最多的内容">
          {a.content.length ? <div className="space-y-2 text-[13px]">{a.content.map(e=><div key={e.page_type+e.content_id} className="flex justify-between gap-3"><Link className="min-w-0 truncate text-accent hover:underline" to={e.page_type === "story" ? "/story/"+encodeURIComponent(e.content_id) : "/items/"+encodeURIComponent(e.content_id)}>{e.page_type}: {e.content_id}</Link><span className="num">{n(e.count)}</span></div>)}</div> : <p className="text-ink-4 text-[13px]">暂无事件或报道打开记录</p>}
        </Card>
        <Card title="来源与语言">
          <p className="mb-3 text-[12px] text-ink-4">只保存来源域名，不存完整网址或搜索内容。</p>
          {a.languages.map(e=><div key={e.language} className="flex justify-between text-[13px]"><span>{e.language === "zh" ? "中文" : "English"}</span><span>{n(e.page_views)} PV</span></div>)}
          <div className="my-3 border-t border-line"/>
          {a.referrers.map(e=><div key={e.host} className="flex justify-between gap-3 text-[13px]"><span className="truncate">{e.host}</span><span className="num">{n(e.page_views)}</span></div>)}
          {!a.referrers.length && <p className="text-ink-4 text-[13px]">尚无外部来源域名记录</p>}
        </Card>
      </div>
      <p className="mt-5 text-[12px] text-ink-4">浏览器开启 DNT/GPC 或禁用存储时不计入。匿名事件最长保留 90 天；UV、SEO 曝光及核心 Web 指标以对应外部平台为准。</p>
    </AdminPage>
  );
}
