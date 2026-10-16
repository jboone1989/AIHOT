import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Live regression: Strategy <-> MSCI has multiple sourced, directed facts.
const origin = process.env.AIHOT_ATLAS_TEST_ORIGIN ?? "http://127.0.0.1:3000";
const strategy = "5a0599a3-a329-42f1-b10c-3d1a9a26ac35";
const msci = "9c3d40eb-db88-4a9d-9cd2-f61bae3c0e1c";
const pairId = "pair:" + [strategy,msci].sort().join(":");
const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
try {
  const page = await browser.newPage();
  const response = await page.request.get(origin + "/api/site/knowledge/neighborhood/" + strategy);
  assert.equal(response.status(),200);
  const network = await response.json();
  const facts = network.links.filter(l => [l.source,l.target].includes(strategy) && [l.source,l.target].includes(msci));
  assert.ok(facts.length >= 2, "test dataset needs multiple facts for Strategy–MSCI");
  await page.goto(origin + "/knowledge/entity/" + strategy,{waitUntil:"domcontentloaded",timeout:25000});
  await page.waitForFunction(id => !!document.querySelector(".lr-atlas-canvas")?._cyreg?.cy?.getElementById(id).length,
    pairId,{timeout:15000});
  const before = await page.evaluate(() => {
    const cy = document.querySelector(".lr-atlas-canvas")._cyreg.cy;
    window.__pairProbe = {cy,positions:new Map(cy.nodes().map(n=>[n.id(),n.position()])),
      zoom:cy.zoom(),layouts:0,animations:0};
    const p=window.__pairProbe,layout=cy.layout,animate=cy.animate;
    cy.layout=function(...args){p.layouts++;return layout.apply(this,args)};
    cy.animate=function(...args){p.animations++;return animate.apply(this,args)};
    return {nodes:cy.nodes().length,edges:cy.edges().length};
  });
  const visible = await page.evaluate(id => {
    const cy=document.querySelector(".lr-atlas-canvas")._cyreg.cy;
    const edge=cy.getElementById(id);
    const related=cy.edges().filter(e=>[e.source().id(),e.target().id()].includes("5a0599a3-a329-42f1-b10c-3d1a9a26ac35") &&
      [e.source().id(),e.target().id()].includes("9c3d40eb-db88-4a9d-9cd2-f61bae3c0e1c"));
    return {count:related.length,edgeCount:edge.data("count"),label:edge.data("label")};
  },pairId);
  assert.equal(visible.count,1,"one visual edge for the entire pair");
  assert.equal(visible.edgeCount,facts.length,"edge count preserves every fact");
  assert.equal(visible.label,String(facts.length));
  await page.evaluate(id => document.querySelector(".lr-atlas-canvas")._cyreg.cy.getElementById(id).emit("tap"),pairId);
  await page.locator('[data-testid="atlas-pair-facts"] article').first().waitFor({timeout:15000});
  await page.waitForFunction(n=>document.querySelectorAll('[data-testid="atlas-pair-facts"] article').length===n,facts.length,{timeout:15000});
  const after = await page.evaluate(id => {
    const p=window.__pairProbe,cy=document.querySelector(".lr-atlas-canvas")._cyreg.cy;
    return {sameCanvas:cy===p.cy,oldNodesStable:[...p.positions.entries()].every(([key,pos])=>{
      const n=cy.getElementById(key);return !!n.length && Math.abs(n.position().x-pos.x)<0.01 && Math.abs(n.position().y-pos.y)<0.01;
    }),zoomStable:Math.abs(cy.zoom()-p.zoom)<0.0001,layouts:p.layouts,animations:p.animations,
      selectedEdges:cy.edges(".traversed-edge").map(e=>e.id()),
      cards:document.querySelectorAll('[data-testid="atlas-pair-facts"] article').length,
      sourceLinks:document.querySelectorAll('[data-testid="atlas-pair-facts"] a[data-analytics-event="source_open"]').length,
      directions:[...document.querySelectorAll('[data-testid="atlas-pair-facts"] article')].map(x=>x.textContent.slice(0,160))};
  },pairId);
  assert.equal(after.sameCanvas,true);
  assert.equal(after.oldNodesStable,true);
  assert.equal(after.zoomStable,true);
  assert.equal(after.layouts,0);
  assert.equal(after.animations,0);
  assert.deepEqual(after.selectedEdges,[pairId]);
  assert.equal(after.cards,facts.length);
  assert.ok(after.sourceLinks>=facts.length,"every fact must expose its source");
  console.log("PAIR_FACTS_PASS",JSON.stringify({before,visible,after}));
} finally { await browser.close(); }
