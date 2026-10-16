// Server-only read-only Cloudflare RUM reporting. Never expose API credentials in HTML.
type Row = { count: number; dimensions: { date: string } };
export type CloudflareReport = {
  state: "unconfigured" | "ready" | "error";
  pageViews: number | null;
  daily: Array<{ day: string; pageViews: number }>;
  refreshedAt: string | null;
  message?: string;
};
let cache: { expires: number; report: CloudflareReport } | null = null;

export async function cloudflareReport(): Promise<CloudflareReport> {
  const token = process.env.CLOUDFLARE_ANALYTICS_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const site = process.env.CLOUDFLARE_WEB_ANALYTICS_SITE_TAG;
  if (!token || !account || !site) return {
    state: "unconfigured", pageViews: null, daily: [], refreshedAt: null,
    message: "Cloudflare 的历史流量读取尚未授权。需要 Account ID、Web Analytics Site Tag、只读 API Token。",
  };
  if (cache && cache.expires > Date.now()) return cache.report;
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 86400000);
  let report: CloudflareReport;
  try {
    const query = `query($account: string!, $from: Time!, $to: Time!) {
      viewer { accounts(filter: {accountTag: $account}) {
        rumPageloadEventsAdaptiveGroups(
          limit: 1000,
          filter: {siteTag: "${site}", datetime_geq: $from, datetime_lt: $to}
        ) { count dimensions { date } }
      } }
    }`;
    const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST", headers: {Authorization: "Bearer " + token, "Content-Type": "application/json"},
      body: JSON.stringify({query, variables: {account, from: start.toISOString(), to: end.toISOString()}}),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Cloudflare HTTP " + response.status);
    const body = await response.json() as {
      errors?: Array<{message: string}>;
      data?: {viewer?: {accounts?: Array<{rumPageloadEventsAdaptiveGroups?: Row[]}>}};
    };
    if (body.errors?.length) throw new Error(body.errors[0]?.message ?? "GraphQL error");
    const rows = body.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups;
    if (!rows) throw new Error("Cloudflare RUM 数据集不可用");
    const byDate = new Map<string, number>();
    for (const row of rows) byDate.set(row.dimensions.date, (byDate.get(row.dimensions.date) ?? 0) + row.count);
    const daily = [...byDate].sort((a,b)=>a[0].localeCompare(b[0])).map(([day,pageViews])=>({day,pageViews}));
    report = {state:"ready", pageViews:daily.reduce((n,r)=>n+r.pageViews,0), daily, refreshedAt:end.toISOString()};
  } catch (e) {
    report = {state:"error", pageViews:null, daily:[], refreshedAt:null,
      message:e instanceof Error ? e.message.slice(0,160) : "Cloudflare 查询失败"};
  }
  cache={expires:Date.now()+(report.state==="ready"?300000:60000),report};
  return report;
}
