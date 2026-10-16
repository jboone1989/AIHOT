import assert from "node:assert/strict";
import { test } from "node:test";
import { findEntities, mergeAtlasNetworks, neighborhood, type AtlasNetwork } from "../apps/web/app/lib/knowledge-atlas.ts";

const network: AtlasNetwork = {
  nodes: Array.from({ length: 2300 }, (_, i) => ({ key: String(i), name: i === 2299 ? "远处的公司 Remote Corp" : `Entity ${i}`, degree: i === 0 ? 2 : 1 })),
  links: Array.from({ length: 2298 }, (_, i) => ({ id: `e${i}`, source: String(i), target: String(i + 1), predicate: "RELATED_TO", invalidAt: null })),
  truncated: false,
};

test("atlas searches all 2,300 entities, including an isolated entity outside the recent sample", () => {
  assert.deepEqual(findEntities(network.nodes, "remote CORP").map(n => n.key), ["2299"]);
  assert.equal(findEntities(network.nodes, "远处")[0]?.key, "2299");
  assert.equal(findEntities(network.nodes, "").length, 2300);
  assert.strictEqual(neighborhood(network, null, 0), network);
  assert.equal(neighborhood(network, "0", 0).links.length, 2298);
});

test("one and two hops follow either direction without inventing connections", () => {
  assert.deepEqual(neighborhood(network, "100", 1).nodes.map(n => n.key), ["99", "100", "101"]);
  assert.deepEqual(neighborhood(network, "100", 2).nodes.map(n => n.key), ["98", "99", "100", "101", "102"]);
  assert.equal(neighborhood(network, "100", 2).links.length, 4);
  assert.deepEqual(neighborhood(network, "2299", 2).nodes.map(n => n.key), ["2299"]);
  assert.equal(neighborhood(network, "2299", 2).links.length, 0);
});

test("OMI, MSCI and Strategy keep only source-backed direct edges across exploration", () => {
  const omi = { key: "omi", name: "Omi", degree: 1 };
  const msci = { key: "msci", name: "MSCI", degree: 2 };
  const strategy = { key: "strategy", name: "Strategy", degree: 1 };
  const link = (id: string, source: string, target: string) => ({ id, source, target, predicate: "RELATES_TO", invalidAt: null });
  const first = { nodes: [omi, msci], links: [link("a", "omi", "msci")], truncated: false };
  const next = { nodes: [msci, strategy], links: [link("b", "msci", "strategy")], truncated: false };
  const result = mergeAtlasNetworks(first, next);
  assert.deepEqual(result.nodes.map(n => n.key), ["omi", "msci", "strategy"]);
  assert.deepEqual(result.links.map(l => l.id), ["a", "b"]);
  assert.equal(result.links.some(l => new Set([l.source, l.target]).has("omi") && new Set([l.source, l.target]).has("strategy")), false);
  assert.deepEqual(mergeAtlasNetworks(result, first).links.map(l => l.id), ["a", "b"]);
});

test("exploration preserves hundreds of source-backed relations without trimming or duplicating", () => {
  const one: AtlasNetwork = { nodes: network.nodes.slice(0, 101), links: network.links.slice(0, 100), truncated: false };
  const two: AtlasNetwork = { nodes: network.nodes.slice(100, 221), links: network.links.slice(100, 220), truncated: false };
  const joined = mergeAtlasNetworks(one, two);
  assert.equal(joined.nodes.length, 221);
  assert.equal(joined.links.length, 220);
  assert.equal(mergeAtlasNetworks(joined, two).links.length, 220);
});
