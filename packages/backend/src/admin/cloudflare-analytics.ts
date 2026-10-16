// Server-only read-only Cloudflare RUM reporting. Never expose API credentials in HTML.
type Row = { count: number; dimensions: { date: string } };
export type CloudflareReport = {
  state: "unconfigured" | "ready" | "empty" | "error";
  pageViews: number | null;
  daily: Array<{ day: string; pageViews: number }>;
  refreshedAt: string | null;
  message?: string;
};
let cache: { key: string; expires: number; report: CloudflareReport } | null = null;

export async function cloudflareReport(): Promise<CloudflareReport> {
  const token = process.env.CLOUDFLARE_ANALYTICS_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const site = process.env.CLOUDFLARE_WEB_ANALYTICS_SITE_TAG;
  if (!token || !account || !site) return {
    state: "unconfigured", pageViews: null, daily: [], refreshedAt: null,
    message: "Cloudflare 的历史流量读取尚未授权。需要 Account ID、Web Analytics Site Tag、只读 API Token。",
  };
  const key = JSON.stringify([token, account, site]);
  if (cache?.key === key && cache.expires > Date.now()) return cache.report;
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 86400000);
  let report: CloudflareReport;
  try {
    if (!/^[a-f0-9]{32}$/i.test(account) || !/^[a-f0-9]{32}$/i.test(site))
      throw new Error("Cloudflare Account ID / Site Tag 格式无效");
    const query = `query($account: string!, $site: string!, $from: Time!, $to: Time!) {
      viewer { accounts(filter: {accountTag: $account}) {
        rumPageloadEventsAdaptiveGroups(
          limit: 1000,
          filter: {siteTag: $site, datetime_geq: $from, datetime_lt: $to}
        ) { count dimensions { date } }
      } }
    }`;
    const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST", headers: {Authorization: "Bearer " + token, "Content-Type": "application/json"},
      body: JSON.stringify({query, variables: {account, site, from: start.toISOString(), to: end.toISOString()}}),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Cloudflare HTTP " + response.status);
    const body = await response.json() as {
      errors?: Array<{message: string}>;
      data?: {viewer?: {accounts?: Array<{rumPageloadEventsAdaptiveGroups?: Row[]}>}};
    };
    if (body.errors?.length) throw new Error("Cloudflare GraphQL 查询失败，请检查 Account Analytics:Read 权限与 Site Tag");
    const rows = body.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups;
    if (!rows) throw new Error("Cloudflare RUM 数据集不可用");
    const byDate = new Map<string, number>();
    for (const row of rows) {
      if (!Number.isFinite(row.count) || row.count < 0) throw new Error("Cloudflare 返回无效指标");
      byDate.set(row.dimensions.date, (byDate.get(row.dimensions.date) ?? 0) + row.count);
    }
    const daily = [...byDate].sort((a,b)=>a[0].localeCompare(b[0])).map(([day,pageViews])=>({day,pageViews}));
    report = {state:daily.length ? "ready" : "empty", pageViews:daily.reduce((n,r)=>n+r.pageViews,0), daily, refreshedAt:end.toISOString()};
  } catch (e) {
    report = {state:"error", pageViews:null, daily:[], refreshedAt:null,
      message:e instanceof Error && e.message.startsWith("Cloudflare") ? e.message : "Cloudflare 查询失败，请检查网络和 API 配置"};
  }
  cache={key,expires:Date.now()+(report.state==="error"?60000:300000),report};
  return report;
}
