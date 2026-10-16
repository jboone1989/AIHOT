import { Card, Stat } from "./ui";

export type Report<T> = { state: "unconfigured" | "ready" | "empty" | "error"; data: T | null; refreshedAt: string | null; message?: string };
type SearchRow = { clicks: number; impressions: number; ctr: number; position: number };
export type ExternalAnalyticsData = {
  posthog: Report<{
    pageViews: number; sessions: number; events: number;
    daily: Array<{ day: string; pageViews: number; sessions: number }>;
    behaviors: Array<{ name: string; count: number; sessions: number }>;
  }>;
  searchConsole: Report<{
    property: string; startDate: string; endDate: string;
    clicks: number; impressions: number; ctr: number; position: number | null;
    daily: Array<SearchRow & { day: string }>;
    queries: Array<SearchRow & { query: string }>;
    pages: Array<SearchRow & { page: string }>;
  }>;
};
const n = (v: number) => v.toLocaleString("zh-CN");
function ReportStatus({ report }: { report: Report<unknown> }) {
  return <p role="status" className="mb-3 text-[12px] text-ink-3">
    {report.state === "unconfigured" || report.state === "error" ? report.message :
      report.state === "empty" ? "API 已连通，所选时间范围暂未返回数据。" : "已读取平台真实数据。"}
    {report.refreshedAt && ` 更新 ${report.refreshedAt.slice(0, 16).replace("T", " ")} UTC`}
  </p>;
}
export function ExternalAnalytics({ posthog: ph, searchConsole: sc }: ExternalAnalyticsData) {
  return <div className="mb-5 grid gap-5 xl:grid-cols-2">
    <Card title="Google Search Console · 最近 30 个完整日期">
      <ReportStatus report={sc}/>
      {sc.data && <>
        <p className="mb-3 text-[12px] text-ink-3">{sc.data.property} · {sc.data.startDate} — {sc.data.endDate}（太平洋时间，最终数据）</p>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="搜索点击" value={n(sc.data.clicks)}/><Stat label="搜索曝光" value={n(sc.data.impressions)}/>
          <Stat label="点击率 CTR" value={(sc.data.ctr * 100).toFixed(2) + "%"}/>
          <Stat label="平均排名" value={sc.data.position === null ? "—" : sc.data.position.toFixed(1)}/>
        </div>
        <div className="mt-3 space-y-1 text-[12px]">{sc.data.daily.map(r => <div key={r.day} className="flex justify-between"><span>{r.day}</span><span>{n(r.clicks)} 点击 / {n(r.impressions)} 曝光</span></div>)}</div>
        <h3 className="mt-4 text-[13px] font-medium">搜索词 Top 10</h3>
        <div className="space-y-1 text-[12px]">{sc.data.queries.map(r => <div key={r.query} className="flex justify-between gap-3"><span className="min-w-0 truncate">{r.query}</span><span className="shrink-0">{n(r.clicks)} 点击 / {n(r.impressions)} 曝光</span></div>)}</div>
        <h3 className="mt-4 text-[13px] font-medium">搜索落地页 Top 10</h3>
        <div className="space-y-1 text-[12px]">{sc.data.pages.map(r => <div key={r.page} className="flex justify-between gap-3"><span className="min-w-0 truncate" title={r.page}>{r.page}</span><span className="shrink-0">{n(r.clicks)} 点击 / {n(r.impressions)} 曝光</span></div>)}</div>
        <p className="mt-3 text-[12px] text-ink-4">搜索词受匿名化和排名截断影响，其合计不代表全站总量。新资源首批数据可能仍在处理。</p>
      </>}
      <a className="mt-3 inline-block text-[12px] text-accent" href="https://search.google.com/search-console/" target="_blank" rel="noopener noreferrer">打开 Search Console ↗</a>
    </Card>
    <Card title="PostHog · 最近 30 天">
      <ReportStatus report={ph}/>
      {ph.data && <>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="页面浏览 PV" value={n(ph.data.pageViews)}/><Stat label="匿名会话" value={n(ph.data.sessions)} hint="按标签页会话 ID 去重，非 UV"/>
          <Stat label="采集事件" value={n(ph.data.events)}/>
        </div>
        <div className="mt-3 space-y-1 text-[12px]">{ph.data.daily.map(r => <div key={r.day} className="flex justify-between"><span>{r.day}</span><span>{n(r.pageViews)} PV / {n(r.sessions)} 会话</span></div>)}</div>
        <h3 className="mt-4 text-[13px] font-medium">关键行为</h3>
        <div className="space-y-1 text-[12px]">{ph.data.behaviors.map(r => <div key={r.name} className="flex justify-between"><span>{r.name}</span><span>{n(r.count)} 次 / {n(r.sessions)} 会话</span></div>)}</div>
      </>}
      <p className="mt-3 text-[12px] text-ink-4">仅当前域名的 EventGraph 事件，开发与生产分开；独立平台口径，不与站内或 Cloudflare PV 相加。</p>
      <a className="mt-3 inline-block text-[12px] text-accent" href="https://us.posthog.com/" target="_blank" rel="noopener noreferrer">打开 PostHog ↗</a>
    </Card>
  </div>;
}
