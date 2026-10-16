/**
 * Optional live-data regression for cn-dev. Run from project root:
 *   node scripts/check-atlas-camera.mjs
 * The seeded cn-dev graph must contain Omi -> MSCI -> Strategy.
 */
import { chromium } from "@playwright/test";

const origin = process.env.AIHOT_ATLAS_TEST_ORIGIN ?? "http://127.0.0.1:3000";
const omi = "37d059b4-e30a-4378-bee9-9be0c71ff372";
const url = new URL("/knowledge/entity/" + omi, origin);
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.locator(".lr-atlas-connection button").filter({ hasText: "MSCI" }).first().waitFor({ timeout: 15000 });
  await page.evaluate(() => {
    const root = document.querySelector(".lr-atlas-canvas");
    const cy = root?._cyreg?.cy;
    if (!cy) throw Error("Cytoscape instance unavailable");
    window.__atlasProbe = { root, cy, animations: 0, fits: 0, centers: 0, layouts: 0,
      initialZoom: cy.zoom(), positions: new Map(cy.nodes().map(n => [n.id(), n.position()])) };
    const probe = window.__atlasProbe;
    for (const [method, key] of [["animate", "animations"], ["fit", "fits"], ["center", "centers"], ["layout", "layouts"]]) {
      const original = cy[method];
      cy[method] = function (...args) { probe[key] += 1; return original.apply(this, args); };
    }
  });
  await page.locator(".lr-atlas-connection button").filter({ hasText: "MSCI" }).first().click();
  await page.waitForFunction(() => document.querySelector(".lr-atlas-entity h3")?.textContent === "MSCI");
  await page.waitForFunction(() => document.querySelectorAll(".lr-atlas-connection").length >= 19);
  await page.waitForTimeout(850);
  const result = await page.evaluate(() => {
    const p = window.__atlasProbe;
    const now = document.querySelector(".lr-atlas-canvas")?._cyreg?.cy;
    const moved = [...p.positions.entries()].filter(([id, pos]) => {
      const n = now.getElementById(id);
      return !n.length || Math.abs(n.position().x - pos.x) > 0.01 || Math.abs(n.position().y - pos.y) > 0.01;
    }).map(([id]) => id);
    return { sameCanvas: document.querySelector(".lr-atlas-canvas") === p.root, sameInstance: now === p.cy,
      animations: p.animations, fits: p.fits, centers: p.centers, layouts: p.layouts,
      moved, oldNodeCount: p.positions.size, totalNodes: now.nodes().length, totalEdges: now.edges().length,
      zoomDelta: Math.abs(p.initialZoom - now.zoom()),
      pathname: location.pathname };
  });
  console.log(JSON.stringify(result));
  if (!result.sameCanvas || !result.sameInstance || result.moved.length ||
      result.animations !== 1 || result.fits !== 0 || result.centers !== 0 ||
      result.layouts !== 0 || result.zoomDelta > 0.0001 ||
      result.totalEdges < 19 || result.pathname !== url.pathname)
    throw Error("Atlas camera/coordinate continuity regression: " + JSON.stringify(result));
  const second = await page.locator(".lr-atlas-connection button").filter({ hasText: "Strategy" }).first();
  await second.click();
  await page.waitForFunction(() => document.querySelector(".lr-atlas-entity h3")?.textContent === "Strategy");
  await page.waitForTimeout(850);
  const afterSecond = await page.evaluate(() => {
    const p = window.__atlasProbe;
    const cy = document.querySelector(".lr-atlas-canvas")?._cyreg?.cy;
    return { animations: p.animations, fits: p.fits, centers: p.centers, layouts: p.layouts,
      allPreserved: [...p.positions.entries()].every(([id, pos]) => {
        const node = cy.getElementById(id);
        return node.length && Math.abs(node.position().x - pos.x) < 0.01 && Math.abs(node.position().y - pos.y) < 0.01;
      }), sameInstance: cy === p.cy, edges: cy.edges().length, zoomDelta: Math.abs(p.initialZoom - cy.zoom()) };
  });
  console.log("SECOND_CLICK", JSON.stringify(afterSecond));
  if (afterSecond.animations !== 2 || afterSecond.fits !== 0 || afterSecond.centers !== 0 ||
      afterSecond.layouts !== 0 || !afterSecond.allPreserved || !afterSecond.sameInstance ||
      afterSecond.edges < 19 || afterSecond.zoomDelta > 0.0001)
    throw Error("Repeated selection continuity regression: " + JSON.stringify(afterSecond));
  console.log("PASS: two selections, exactly one pan per click, zero relayouts, coordinates stable");
} finally {
  await browser.close();
}
