import assert from "node:assert/strict";
import { test } from "node:test";
import { findEntities, neighborhood, type AtlasNetwork } from "../apps/web/app/lib/knowledge-atlas.ts";

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
