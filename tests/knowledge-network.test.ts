import "./setup.ts";
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import Fastify from "fastify";
import { sql, closeDb } from "@aihot/backend/db";
import { publicGraphNetwork } from "@aihot/backend/publication/knowledge";
import { registerKnowledge } from "../apps/api/src/routes/knowledge.ts";

let server: http.Server;
const publicNodes = Array.from({ length: 120 }, (_, i) => ({ key: `n${i}`, name: `Entity ${i}`, articleIds: ["kn-public"] }));
const publicLinks = Array.from({ length: 119 }, (_, i) => ({ id: `l${i}`, source: `n${i}`, target: `n${i + 1}`, predicate: "RELATION", invalidAt: null, articleIds: ["kn-public", "kn-hidden"] }));
before(async () => {
  server = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/network") return res.end(JSON.stringify({
      nodes: [...publicNodes, { key: "isolated", name: "Isolated", articleIds: ["kn-public"] }, { key: "hidden", name: "Hidden", articleIds: ["kn-hidden"] }],
      links: [...publicLinks, { ...publicLinks[0], id: "private-link", articleIds: ["kn-hidden"] }], truncated: false,
    }));
    res.end(JSON.stringify({ entities: 2, edges: [{
      id: "l118", subject: { key: "n118", name: "Entity 118", kind: "entity" }, object: { key: "n119", name: "Entity 119", kind: "entity" },
      predicate: "RELATION", fact: "Public fact", validAt: null, invalidAt: null,
      evidence: [{ articleId: req.url?.endsWith("hidden") ? "kn-hidden" : "kn-public", url: "https://example.org/source", source: "KN", quote: "fact", publishedAt: null }],
    }] }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  process.env.GRAPHITI_API_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  await sql`INSERT INTO sources (id,name,kind,tier,participation_mode,next_fetch_at) VALUES ('knowledge-network','KN','rss','T1','editorial','2100-01-01')`;
  for (const id of ["kn-public", "kn-hidden"]) {
    const at = new Date(Date.now() - 3600_000);
    await sql`INSERT INTO articles (id,source_id,identity_key,url,title,discovered_at,timeline_at) VALUES (${id},'knowledge-network',${id},${'https://example.org/' + id},${id},${at},${at})`;
    await sql`INSERT INTO publications (article_id,source_id,title,url,timeline_at,discovered_at,sort_at,body_mode,eligible,channel)
      VALUES (${id},'knowledge-network',${id},${'https://example.org/' + id},${at},${at},${at},'summary',true,'news')`;
  }
  await sql`UPDATE publications SET visibility='withdrawn' WHERE article_id='kn-hidden'`;
});
after(async () => { delete process.env.GRAPHITI_API_URL; server.close(); await closeDb(); });

test("public atlas exceeds the old 64-relation sample and retains publicly mentioned isolated entities", async () => {
  const result = await publicGraphNetwork(new Date());
  assert.equal(result.nodes.length, 121);
  assert.equal(result.links.length, 119);
  assert.equal(result.nodes.find(n => n.key === "isolated")?.degree, 0);
  assert.equal(result.nodes.find(n => n.key === "n1")?.degree, 2);
  assert.ok(!result.nodes.some(n => n.key === "hidden"));
  assert.ok(!result.links.some(l => l.id === "private-link"));
  assert.ok(!JSON.stringify(result).includes("kn-hidden"));
  assert.equal(result.truncated, false);
});

test("public relation evidence is addressable beyond the entity detail's 100-row limit and filters withdrawals", async () => {
  const app = Fastify(); registerKnowledge(app);
  try {
    const found = await app.inject({ method: "GET", url: "/api/site/knowledge/relations/l118" });
    assert.equal(found.statusCode, 200);
    assert.equal(found.json().edges[0].id, "l118");
    assert.equal((await app.inject({ method: "GET", url: "/api/site/knowledge/relations/hidden" })).statusCode, 404);
    assert.equal((await app.inject({ method: "GET", url: "/api/site/knowledge/relations/" + "x".repeat(181) })).statusCode, 400);
    assert.equal((await app.inject({ method: "GET", url: "/api/site/knowledge/network" })).json().nodes.length, 121);
  } finally { await app.close(); }
});
