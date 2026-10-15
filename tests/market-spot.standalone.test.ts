import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSpot, readBinanceSpot, readOkxSpot } from "@aihot/backend/market-spot";

const mock = async (url: string) => {
  if (url.includes("binance.vision")) return new Response(JSON.stringify({
    symbol: "BTCUSDT", lastPrice: "67250.00", priceChangePercent: "1.25",
    quoteVolume: "9920000", closeTime: 1791940000000,
  }), { status: 200 });
  return new Response(JSON.stringify({ code: "0", data: [{
    instId: "BTC-USDT", last: "67230.10", open24h: "66200",
    volCcy24h: "8543000", ts: "1791940005000",
  }] }), { status: 200 });
};
test("exchange observations preserve prices, units, timestamps and original API attribution", async () => {
  const a = await readBinanceSpot("BTC", mock);
  const b = await readOkxSpot("BTC", mock);
  assert.equal(a.priceUsdt, 67250);
  assert.equal(a.change24hPercent, 1.25);
  assert.equal(a.quoteVolume24hUsdt, 9920000);
  assert.equal(b.priceUsdt, 67230.10);
  assert.ok(b.change24hPercent > 1.5 && b.change24hPercent < 1.6);
  assert.equal(b.quoteVolume24hUsdt, 8543000);
  assert.match(a.sourceUrl, /binance\.vision/);
  assert.match(b.sourceUrl, /okx\.com/);
});
test("one exchange outage is reported as partial data, not invented values", async () => {
  const partial = await loadSpot("BTC", async url => url.includes("okx")
    ? new Response("down", { status: 503 }) : mock(url));
  assert.equal(partial.observations.length, 1);
  assert.equal(partial.errors.length, 1);
  assert.equal(partial.errors[0]?.exchange, "OKX");
});
test("unknown pairs and invalid quote data do not become public observations", async () => {
  const invalid = await loadSpot("BTC", async () => new Response(JSON.stringify({ code: "0", data: [] })));
  assert.equal(invalid.observations.length, 0);
  assert.equal(invalid.errors.length, 2);
});
