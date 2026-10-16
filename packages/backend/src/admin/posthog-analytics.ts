import { cachedReport, providerJson, ProviderError, type Report } from "./external-report.ts";

type Counts = { pageViews: number; sessions: number; events: number };
export type PosthogData = Counts & {
  daily: Array<{ day: string; pageViews: number; sessions: number }>;
  behaviors: Array<{ name: string; count: number; sessions: number }>;
};
const cached = cachedReport<PosthogData>();
const count = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new ProviderError("PostHog 返回了无效指标。");
  return n;
};

export async function posthogReport(): Promise<Report<PosthogData>> {
  const token = process.env.POSTHOG_PERSONAL_API_KEY;
  const project = process.env.POSTHOG_PROJECT_ID;
  if (!token || !project) return { state: "unconfigured", data: null, refreshedAt: null,
    message: "PostHog 报表尚未授权：需要 Project ID 和仅有 query:read 权限的 Personal API Key；公开 Project Token 只能采集事件。" };
  const host = process.env.POSTHOG_REGION === "eu" ? "https://eu.posthog.com" : "https://us.posthog.com";
  const site = process.env.SITE_URL ?? "";
  return cached(JSON.stringify([token, project, host, site]), async () => {
    if (!/^\d+$/.test(project)) throw new ProviderError("PostHog Project ID 必须为数字。");
    let hostname: string;
    try { hostname = new URL(site).hostname; } catch { throw new ProviderError("请配置有效的 SITE_URL，以隔离开发和生产统计。"); }
    // Only query this site's allowlisted events; do not retrieve people or raw event properties.
    const filter = `timestamp >= now() - INTERVAL 30 DAY AND properties.source = 'eventgraph' AND properties.site_host = '${hostname.replaceAll("'", "''")}'`;
    async function query(sql: string) {
      const body = await providerJson<{ results?: unknown[][] }>("PostHog", `${host}/api/projects/${project}/query/`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql }, name: "EventGraph admin analytics", refresh: "blocking" }),
      });
      if (!Array.isArray(body.results)) throw new ProviderError("PostHog 尚未返回完整报表。");
      return body.results;
    }
    const [totals, daily, behaviors] = await Promise.all([
      query(`SELECT countIf(event = '$pageview'), uniqExactIf(distinct_id, event = '$pageview'), count() FROM events WHERE ${filter}`),
      query(`SELECT toString(toDate(timestamp)), countIf(event = '$pageview'), uniqExactIf(distinct_id, event = '$pageview') FROM events WHERE ${filter} GROUP BY 1 ORDER BY 1 LIMIT 31`),
      query(`SELECT event, count(), uniqExact(distinct_id) FROM events WHERE ${filter} GROUP BY event ORDER BY count() DESC LIMIT 20`),
    ]);
    if (!totals[0] || totals[0].length < 3) throw new ProviderError("PostHog 汇总数据不完整。");
    return {
      pageViews: count(totals[0][0]), sessions: count(totals[0][1]), events: count(totals[0][2]),
      daily: daily.map(r => ({ day: String(r[0]).slice(0, 10), pageViews: count(r[1]), sessions: count(r[2]) })),
      behaviors: behaviors.map(r => ({ name: String(r[0]), count: count(r[1]), sessions: count(r[2]) })),
    };
  }, data => data.events === 0);
}
