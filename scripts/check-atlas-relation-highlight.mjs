// Run on a seeded development environment to validate in-browser edge highlighting.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const origin = process.env.AIHOT_ATLAS_TEST_ORIGIN || "http://127.0.0.1:3000";
const omi = "37d059b4-e30a-4378-bee9-9be0c71ff372";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const response = await page.request.get(origin + "/api/site/knowledge/neighborhood/" + omi);
  assert.equal(response.status(), 200);
  const graph = await response.json();
  assert.ok(graph.links.length, "Omi must have a sourced relation");
  const link = graph.links[0];
  const target = link.source === omi ? link.target : link.source;

  await page.goto(origin + "/knowledge/entity/" + omi, { waitUntil: "domcontentloaded" });
  await page.locator(".lr-atlas-connection button").first().waitFor({ timeout: 12000 });
  await page.waitForFunction(() => !!document.querySelector(".lr-atlas-canvas")?._cyreg?.cy, null, { timeout: 12000 });
  await page.evaluate(() => {
    const cy = document.querySelector(".lr-atlas-canvas")?._cyreg?.cy;
    if (!cy) throw Error("Cytoscape is unavailable");
    window.__graphSnapshot = {
      instance: cy,
      nodes: new Map(cy.nodes().map(n => [n.id(), n.position()])),
      zoom: cy.zoom(),
      layoutCalls: 0,
      cameraAnimations: 0,
    };
    const snap = window.__graphSnapshot;
    const oldLayout = cy.layout, oldAnimate = cy.animate;
    cy.layout = function (...args) { snap.layoutCalls++; return oldLayout.apply(this, args); };
    cy.animate = function (...args) { snap.cameraAnimations++; return oldAnimate.apply(this, args); };
  });
  await page.locator(".lr-atlas-connection button").first().click();
  await page.waitForFunction(key => document.querySelector(".lr-atlas-entity h3") !== null &&
    document.querySelector(".lr-atlas-connection.is-active") !== null, target, { timeout: 12000 });
  await page.waitForTimeout(500);
  const state = await page.evaluate(id => {
    const snap = window.__graphSnapshot;
    const cy = document.querySelector(".lr-atlas-canvas")._cyreg.cy;
    const highlighted = cy.edges(".traversed-edge");
    return {
      sameInstance: cy === snap.instance,
      highlightedCount: highlighted.length,
      highlightedId: highlighted[0]?.id(),
      styleColor: highlighted[0]?.style("line-color"),
      selectedRows: document.querySelectorAll(".lr-atlas-connection.is-active").length,
      initialPositionsUnchanged: [...snap.nodes.entries()].every(([key, pos]) => {
        const n = cy.getElementById(key);
        return n.length && Math.abs(n.position().x - pos.x) < 0.01 &&
          Math.abs(n.position().y - pos.y) < 0.01;
      }),
      zoomUnchanged: Math.abs(cy.zoom() - snap.zoom) < 0.0001,
      layoutCalls: snap.layoutCalls,
      cameraAnimations: snap.cameraAnimations,
      routeUnchanged: location.pathname === "/knowledge/entity/37d059b4-e30a-4378-bee9-9be0c71ff372",
    };
  }, link.id);
  assert.equal(state.sameInstance, true);
  assert.equal(state.highlightedCount, 1, "only the traversed factual edge should glow");
  assert.equal(state.highlightedId, "r:" + link.id);
  assert.equal(state.styleColor.replaceAll(" ", ""), "rgb(255,226,140)");
  assert.equal(state.selectedRows, 1);
  assert.equal(state.initialPositionsUnchanged, true);
  assert.equal(state.zoomUnchanged, true);
  assert.equal(state.layoutCalls, 0);
  assert.equal(state.cameraAnimations, 1);
  assert.equal(state.routeUnchanged, true);
  console.log("EDGE_HIGHLIGHT_PASS", JSON.stringify(state));
} finally {
  await browser.close();
}
