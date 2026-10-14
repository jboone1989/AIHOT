// Extended source-backed archive search is not an open-ended event-causality engine.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { ITEM_WINDOWS, itemWindowStart, requiresSearchQuery } from "@aihot/backend/publication/v1";
import Fastify from "fastify";
import { registerV1, V1_OPERATIONS } from "../apps/api/src/routes/v1.ts";

test("archive windows are bounded and keep ordinary news windows unchanged", () => {
  assert.deepEqual([...ITEM_WINDOWS], ["24h", "7d", "30d", "90d", "365d"]);
  const now = new Date("2026-10-14T00:00:00Z");
  assert.equal(itemWindowStart("24h", now).toISOString(), "2026-10-13T00:00:00.000Z");
  assert.equal(itemWindowStart("7d", now).toISOString(), "2026-10-07T00:00:00.000Z");
  assert.equal(itemWindowStart("30d", now).toISOString(), "2026-09-14T00:00:00.000Z");
  assert.equal(itemWindowStart("90d", now).toISOString(), "2026-07-16T00:00:00.000Z");
  assert.equal(itemWindowStart("365d", now).toISOString(), "2025-10-14T00:00:00.000Z");
  assert.equal(requiresSearchQuery("7d"), false);
  for (const w of ["30d", "90d", "365d"] as const) assert.equal(requiresSearchQuery(w), true);
});

test("existing public v1 items operation still uses same source-aware filters", () => {
  assert.ok(V1_OPERATIONS.items.queryKeys.includes("q"));
  assert.ok(V1_OPERATIONS.items.queryKeys.includes("category"));
  assert.ok(V1_OPERATIONS.items.queryKeys.includes("cursor"));
});

test("OpenAPI documents every supported window and the source-backed research semantics", () => {
  const openapi = JSON.parse(readFileSync(new URL("../site/public/openapi-v1.json", import.meta.url), "utf8"));
  for (const path of ["/api/v1/items", "/api/v1/agent/search"]) {
    const w = openapi.paths[path].get.parameters.find((x: {name?: string}) => x.name === "window");
    assert.deepEqual(w.schema.enum, [...ITEM_WINDOWS]);
  }
  assert.match(openapi.paths["/api/v1/items"].get.description, /original source URLs/);
  assert.match(openapi.paths["/api/v1/items"].get.description, /require q/);
});

test("long-range browsing without a subject is rejected before a database query", async () => {
  const app = Fastify();
  registerV1(app);
  try {
    const rejected = await app.inject({ method: "GET", url: "/api/v1/items?mode=all&window=365d" });
    assert.equal(rejected.statusCode, 400);
    assert.match(rejected.body, /requires q/);
    const badWindow = await app.inject({ method: "GET", url: "/api/v1/items?window=10000d" });
    assert.equal(badWindow.statusCode, 400);
  } finally {
    await app.close();
  }
});
