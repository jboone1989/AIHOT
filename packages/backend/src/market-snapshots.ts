// Exchange prices kept over time (market.snapshot, which runs with collection), so event pages can set
// an event beside the prices around it. Only prices are kept; nothing here judges cause.
import { sql } from "./db.ts";
import { loadSpot, SPOT_ASSETS, type Getter } from "./market-spot.ts";

/** One price per asset: Binance's, else OKX's; an asset neither exchange answers for is skipped this time. */
export async function snapshotMarkets(getter: Getter = fetch) {
  let saved = 0;
  for (const asset of SPOT_ASSETS) {
    const quote = (await loadSpot(asset, getter)).observations[0];
    if (!quote) continue;
    await sql`INSERT INTO market_snapshots (asset, observed_at, price_usdt, exchange)
      VALUES (${asset}, ${quote.exchangeAt}, ${quote.priceUsdt}, ${quote.exchange}) ON CONFLICT DO NOTHING`;
    saved++;
  }
  return { saved };
}
