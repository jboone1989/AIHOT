import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { GoogleAuth } from "google-auth-library";
import { posthogReport } from "../packages/backend/src/admin/posthog-analytics.ts";
import { searchConsoleReport } from "../packages/backend/src/admin/search-console-analytics.ts";
import { cloudflareReport } from "../packages/backend/src/admin/cloudflare-analytics.ts";

const keys = ["POSTHOG_PROJECT_ID", "POSTHOG_PERSONAL_API_KEY", "POSTHOG_REGION", "SITE_URL",
  "GOOGLE_SEARCH_CONSOLE_PROPERTY", "GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON",
  "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_WEB_ANALYTICS_SITE_TAG", "CLOUDFLARE_ANALYTICS_API_TOKEN"];
function environment(t: TestContext, values: Record<string, string>) {
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, values);
  t.after(() => { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
}
test("missing reporting credentials do not make requests or display zero metrics", async t => {
  environment(t, {});
  t.mock.method(globalThis, "fetch", () => { throw new Error("must not call upstream"); });
  for (const report of [await posthogReport(), await searchConsoleReport()]) {
    assert.equal(report.state, "unconfigured"); assert.equal(report.data, null);
  }
  assert.equal((await cloudflareReport()).data, null);
});
test("PostHog reads scoped aggregates, preserves whole-window distinct counts and caches", async t => {
  environment(t, { POSTHOG_PROJECT_ID: "667893", POSTHOG_PERSONAL_API_KEY: "test-key",
    POSTHOG_REGION: "eu", SITE_URL: "https://dev.example.com" });
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://eu.posthog.com/api/projects/667893/query/");
    const query = JSON.parse(String(init.body)).query.query as string;
    assert.ok(query.includes("properties.site_host = 'dev.example.com'"));
    assert.ok(query.includes("properties.source = 'eventgraph'"));
    calls.push(query);
    return Response.json({ results: query.startsWith("SELECT countIf") ? [[12, 3, 21]] :
      query.includes("toDate") ? [["2026-10-15", 6, 3], ["2026-10-16", 6, 3]] : [["$pageview", 12, 3]] });
  });
  const report = await posthogReport();
  assert.equal(report.state, "ready"); assert.equal(report.data?.sessions, 3);
  assert.equal(report.data?.daily.length, 2); assert.equal(report.data?.events, 21);
  assert.deepEqual(await posthogReport(), report); assert.equal(calls.length, 3);
});
test("PostHog unauthorized responses remain errors and do not leak upstream bodies", async t => {
  environment(t, { POSTHOG_PROJECT_ID: "667894", POSTHOG_PERSONAL_API_KEY: "private-key", SITE_URL: "https://example.com" });
  t.mock.method(globalThis, "fetch", async () => new Response("private-key raw body", { status: 403 }));
  const report = await posthogReport();
  assert.equal(report.state, "error"); assert.equal(report.data, null);
  assert.equal(JSON.stringify(report).includes("private-key"), false);
});
test("Search Console uses independent totals, domain encoding, Pacific dates and read-only scope", async t => {
  environment(t, { GOOGLE_SEARCH_CONSOLE_PROPERTY: "sc-domain:example.com",
    GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON: JSON.stringify({type:"service_account",client_email:"reader@example.com",private_key:"mocked"}) });
  t.mock.method(GoogleAuth.prototype, "getAccessToken", async function (this: GoogleAuth) {
    assert.deepEqual((this as unknown as {scopes: string[]}).scopes, ["https://www.googleapis.com/auth/webmasters.readonly"]);
    return "mock-access-token";
  });
  const dimensions: string[][] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.ok(url.includes("sc-domain%3Aexample.com/searchAnalytics/query"));
    const body = JSON.parse(String(init.body)); dimensions.push(body.dimensions);
    assert.equal(body.dataState, "final");
    assert.equal(Date.parse(body.endDate) - Date.parse(body.startDate), 29 * 86400000);
    return Response.json({ rows: body.dimensions.length ? [{ keys:["2026-10-15"],clicks:1,impressions:10,ctr:0.1,position:5 }] :
      [{ clicks:10,impressions:100,ctr:0.1,position:7 }] });
  });
  const report = await searchConsoleReport();
  assert.equal(report.state, "ready"); assert.equal(report.data?.clicks, 10);
  assert.equal(report.data?.position, 7); assert.equal(dimensions.length, 4);
});
test("Search Console authorized empty data is distinct from missing authorization", async t => {
  environment(t, { GOOGLE_SEARCH_CONSOLE_PROPERTY: "sc-domain:empty.example.com",
    GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON: JSON.stringify({type:"service_account",client_email:"reader@example.com",private_key:"mocked"}) });
  t.mock.method(GoogleAuth.prototype, "getAccessToken", async () => "mock-token");
  t.mock.method(globalThis, "fetch", async () => Response.json({}));
  const report = await searchConsoleReport();
  assert.equal(report.state, "empty"); assert.equal(report.data?.position, null);
  assert.ok(report.refreshedAt);
});
test("Cloudflare variables are bounded identifiers and GraphQL errors never become zero PV", async t => {
  environment(t, { CLOUDFLARE_ACCOUNT_ID: "a".repeat(32), CLOUDFLARE_WEB_ANALYTICS_SITE_TAG: "b".repeat(32), CLOUDFLARE_ANALYTICS_API_TOKEN: "cf-private" });
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    assert.equal(body.variables.site, "b".repeat(32));
    assert.ok(body.query.includes("siteTag: $site"));
    return Response.json({errors:[{message:"cf-private"}]});
  });
  const report = await cloudflareReport();
  assert.equal(report.state, "error"); assert.equal(report.data, null);
  assert.equal(JSON.stringify(report).includes("cf-private"), false);
});
