import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { GoogleAuth } from "google-auth-library";
import { generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";
import { config } from "../packages/backend/src/config.ts";
import { posthogReport } from "../packages/backend/src/admin/posthog-analytics.ts";
import { searchConsoleReport } from "../packages/backend/src/admin/search-console-analytics.ts";
import { cloudflareReport } from "../packages/backend/src/admin/cloudflare-analytics.ts";

const { MockAgent, getGlobalDispatcher, setGlobalDispatcher } = createRequire(new URL("../packages/backend/package.json", import.meta.url))("undici") as typeof import("undici");

const keys = ["POSTHOG_PROJECT_ID", "POSTHOG_PERSONAL_API_KEY", "POSTHOG_REGION", "SITE_URL",
  "GOOGLE_SEARCH_CONSOLE_PROPERTY", "GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON",
  "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_WEB_ANALYTICS_SITE_TAG", "CLOUDFLARE_ANALYTICS_API_TOKEN"];
function environment(t: TestContext, values: Record<string, string>) {
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, values);
  t.after(() => { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
}
type SearchQuery = { dimensions: string[]; startDate: string; endDate: string; dataState: string };
function googleNetwork(t: TestContext, property: string, reply: (query: SearchQuery) => unknown) {
  const previous = { dispatcher: getGlobalDispatcher(), proxy: config.egressProxyUrl, private: config.allowPrivateNetworkFetch };
  const network = new MockAgent(); network.disableNetConnect(); setGlobalDispatcher(network);
  config.egressProxyUrl = null; config.allowPrivateNetworkFetch = true;
  network.get("https://www.googleapis.com").intercept({
    path: `/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, method: "POST",
  }).reply(200, options => JSON.stringify(reply(JSON.parse(String(options.body)))), {
    headers: { "content-type": "application/json" },
  }).persist();
  t.after(async () => {
    setGlobalDispatcher(previous.dispatcher); config.egressProxyUrl = previous.proxy; config.allowPrivateNetworkFetch = previous.private;
    await network.close();
  });
  return network;
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
  googleNetwork(t, "sc-domain:example.com", body => {
    dimensions.push(body.dimensions);
    assert.equal(body.dataState, "final");
    assert.equal(Date.parse(body.endDate) - Date.parse(body.startDate), 29 * 86400000);
    return { rows: body.dimensions.length ? [{ keys:["2026-10-15"],clicks:1,impressions:10,ctr:0.1,position:5 }] :
      [{ clicks:10,impressions:100,ctr:0.1,position:7 }] };
  });
  const report = await searchConsoleReport();
  assert.equal(report.state, "ready"); assert.equal(report.data?.clicks, 10);
  assert.equal(report.data?.position, 7); assert.equal(dimensions.length, 4);
});
test("Search Console authorized empty data is distinct from missing authorization", async t => {
  environment(t, { GOOGLE_SEARCH_CONSOLE_PROPERTY: "sc-domain:empty.example.com",
    GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON: JSON.stringify({type:"service_account",client_email:"reader@example.com",private_key:"mocked"}) });
  t.mock.method(GoogleAuth.prototype, "getAccessToken", async () => "mock-token");
  googleNetwork(t, "sc-domain:empty.example.com", () => ({}));
  const report = await searchConsoleReport();
  assert.equal(report.state, "empty"); assert.equal(report.data?.position, null);
  assert.ok(report.refreshedAt);
});
test("Search Console exchanges a real signed JWT and reads all reports through the configured HTTP transport", async t => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  environment(t, { GOOGLE_SEARCH_CONSOLE_PROPERTY: "sc-domain:transport.example.com",
    GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON: JSON.stringify({ type: "service_account", client_email: "reader@example.com",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }) }) });
  let queries = 0, tokens = 0;
  const network = googleNetwork(t, "sc-domain:transport.example.com", () => { queries++; return {}; });
  network.get("https://oauth2.googleapis.com").intercept({ path: "/token", method: "POST" }).reply(200, options => {
    const body = new URLSearchParams(String(options.body));
    assert.equal(body.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
    const claims = JSON.parse(Buffer.from(body.get("assertion")!.split(".")[1]!, "base64url").toString());
    assert.equal(claims.scope, "https://www.googleapis.com/auth/webmasters.readonly");
    tokens++;
    return JSON.stringify({ access_token: "transport-test-token", token_type: "Bearer", expires_in: 3600 });
  }, { headers: { "content-type": "application/json" } });
  t.mock.method(globalThis, "fetch", () => { throw new Error("native fetch must not bypass egress"); });
  assert.equal((await searchConsoleReport()).state, "empty");
  assert.equal(tokens, 1); assert.equal(queries, 4);
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
