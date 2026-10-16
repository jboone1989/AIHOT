import { GoogleAuth } from "google-auth-library";
import { cachedReport, providerJson, ProviderError, type Report } from "./external-report.ts";

type Row = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };
export type SearchConsoleData = {
  property: string; startDate: string; endDate: string;
  clicks: number; impressions: number; ctr: number; position: number | null;
  daily: Array<Row & { day: string }>;
  queries: Array<Row & { query: string }>;
  pages: Array<Row & { page: string }>;
};
const cached = cachedReport<SearchConsoleData>();

export async function searchConsoleReport(): Promise<Report<SearchConsoleData>> {
  const property = process.env.GOOGLE_SEARCH_CONSOLE_PROPERTY;
  const credentials = process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON;
  if (!property || !credentials) return { state: "unconfigured", data: null, refreshedAt: null,
    message: "Search Console 报表尚未授权：需要网域资源和只读服务账号凭据。DNS 验证不等于 API 授权。" };
  return cached(JSON.stringify([property, credentials]), async () => {
    const parsed = JSON.parse(credentials);
    if (parsed.type !== "service_account" || !parsed.client_email || !parsed.private_key)
      throw new ProviderError("Search Console 需要有效的服务账号 JSON 凭据。");
    const auth = new GoogleAuth({ credentials: parsed, scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
      clientOptions: { transporterOptions: { timeout: 8000, retry: false } } });
    const accessToken = await auth.getAccessToken();
    if (!accessToken) throw new ProviderError("Google 未返回访问令牌。");
    // Search Console dates use Pacific time. Request the last 30 completed dates, final data only.
    const endDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" })
      .format(new Date(Date.now() - 86400000));
    const startDate = new Date(Date.parse(endDate + "T12:00:00Z") - 29 * 86400000).toISOString().slice(0, 10);
    async function query(dimensions: string[]) {
      const result = await providerJson<{ rows?: Row[] }>("Search Console",
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property!)}/searchAnalytics/query`, {
          method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ startDate, endDate, dimensions, type: "web", dataState: "final",
            rowLimit: dimensions.length ? (dimensions[0] === "date" ? 31 : 10) : 1 }),
        });
      if (result.rows !== undefined && !Array.isArray(result.rows)) throw new ProviderError("Search Console 报表格式无效。");
      if (result.rows?.some(r => !r || ![r.clicks, r.impressions, r.ctr, r.position].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0)))
        throw new ProviderError("Search Console 返回了无效指标。");
      return result.rows ?? [];
    }
    // Totals come from their own query: anonymized search queries are omitted from keyword rows.
    const [totals, daily, queries, pages] = await Promise.all([query([]), query(["date"]), query(["query"]), query(["page"])]);
    const total = totals[0];
    return { property, startDate, endDate, clicks: total?.clicks ?? 0, impressions: total?.impressions ?? 0,
      ctr: total?.ctr ?? 0, position: total?.impressions ? total.position : null,
      daily: daily.map(r => ({ ...r, day: r.keys?.[0] ?? "" })).sort((a, b) => a.day.localeCompare(b.day)),
      queries: queries.map(r => ({ ...r, query: r.keys?.[0] ?? "" })),
      pages: pages.map(r => ({ ...r, page: r.keys?.[0] ?? "" })),
    };
  }, data => data.impressions === 0);
}
