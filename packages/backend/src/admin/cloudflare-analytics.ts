// Server-only read-only Cloudflare RUM reporting. Never expose API credentials in HTML.
import { cachedReport, providerJson, ProviderError, type Report } from "./external-report.ts";

type Row = { count: number; dimensions: { date: string } };
export type CloudflareData = {
  pageViews: number;
  daily: Array<{ day: string; pageViews: number }>;
};
const cached = cachedReport<CloudflareData>();

export async function cloudflareReport(): Promise<Report<CloudflareData>> {
  const token = process.env.CLOUDFLARE_ANALYTICS_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const site = process.env.CLOUDFLARE_WEB_ANALYTICS_SITE_TAG;
  if (!token || !account || !site) return { state: "unconfigured", data: null, refreshedAt: null,
    message: "Cloudflare 的历史流量读取尚未授权。需要 Account ID、Web Analytics Site Tag、只读 API Token。" };
  return cached(JSON.stringify([token, account, site]), async () => {
    if (!/^[a-f0-9]{32}$/i.test(account) || !/^[a-f0-9]{32}$/i.test(site))
      throw new ProviderError("Cloudflare Account ID / Site Tag 格式无效");
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 86400000);
    const query = `query($account: string!, $site: string!, $from: Time!, $to: Time!) {
      viewer { accounts(filter: {accountTag: $account}) {
        rumPageloadEventsAdaptiveGroups(
          limit: 1000,
          filter: {siteTag: $site, datetime_geq: $from, datetime_lt: $to}
        ) { count dimensions { date } }
      } }
    }`;
    const body = await providerJson<{
      errors?: Array<{message: string}>;
      data?: {viewer?: {accounts?: Array<{rumPageloadEventsAdaptiveGroups?: Row[]}>}};
    }>("Cloudflare", "https://api.cloudflare.com/client/v4/graphql", {
      method: "POST", headers: {Authorization: "Bearer " + token, "Content-Type": "application/json"},
      body: JSON.stringify({query, variables: {account, site, from: start.toISOString(), to: end.toISOString()}}),
    });
    if (body.errors?.length) throw new ProviderError("Cloudflare GraphQL 查询失败，请检查 Account Analytics:Read 权限与 Site Tag");
    const rows = body.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups;
    if (!rows) throw new ProviderError("Cloudflare RUM 数据集不可用");
    const byDate = new Map<string, number>();
    for (const row of rows) {
      if (!Number.isFinite(row.count) || row.count < 0) throw new ProviderError("Cloudflare 返回无效指标");
      byDate.set(row.dimensions.date, (byDate.get(row.dimensions.date) ?? 0) + row.count);
    }
    const daily = [...byDate].sort((a,b)=>a[0].localeCompare(b[0])).map(([day,pageViews])=>({day,pageViews}));
    return { pageViews: daily.reduce((n,r)=>n+r.pageViews,0), daily };
  }, data => data.daily.length === 0);
}
