// Prices around an event: the assets its public reports name, priced from stored snapshots just before
// its first report and a day later; snapshots come from the exchanges through a local stub here.
import './setup.ts';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { sql, closeDb } from '@aihot/backend/db';
import { snapshotMarkets } from '@aihot/backend/market-snapshots';
import { assetsNamed, storyMarket } from '@aihot/backend/publication/market';

after(closeDb);

test('assets are named by symbol or name, whole words only, most mentions first', () => {
  assert.deepEqual(assetsNamed(['以太坊 ETF 获批', 'Ethereum ETF flows', 'BTC dips']), ['ETH', 'BTC']);
  assert.deepEqual(assetsNamed(['SOLID results', 'Solar power']), [], 'SOL inside another word is not Solana');
});

test('snapshots store one price per asset, Binance first, and skip an asset with no quote', async () => {
  const getter = async (url: string) => {
    if (url.includes('XRP')) return new Response('down', { status: 503 });
    if (url.includes('binance.vision')) {
      const symbol = new URL(url).searchParams.get('symbol')!;
      return new Response(JSON.stringify({ symbol, lastPrice: '100', priceChangePercent: '1', quoteVolume: '5', closeTime: 1791940000000 }));
    }
    return new Response('down', { status: 503 });
  };
  assert.deepEqual(await snapshotMarkets(getter), { saved: 4 });
  const rows = await sql<{ asset: string; exchange: string }[]>`SELECT asset, exchange FROM market_snapshots WHERE observed_at = to_timestamp(1791940000)`;
  assert.deepEqual(rows.map((r) => r.asset).sort(), ['BNB', 'BTC', 'ETH', 'SOL']);
  assert.ok(rows.every((r) => r.exchange === 'Binance'));
});

test('an event is priced before its first public report and a day later', async () => {
  await sql`INSERT INTO sources (id,name,kind,tier,participation_mode,next_fetch_at) VALUES ('prices','Price Wire','rss','T2','editorial','2100-01-01')`;
  const [story] = await sql<{ id: number }[]>`INSERT INTO stories (public_id,title) VALUES (${randomUUID()},'Bitcoin ETF inflows') RETURNING id`;
  const first = new Date('2026-09-01T10:00:00Z');
  for (const [id, at, hidden] of [['pr-early', new Date('2026-09-01T08:00:00Z'), true], ['pr-first', first, false]] as const) {
    await sql`INSERT INTO articles (id,source_id,identity_key,url,title,discovered_at,timeline_at) VALUES (${id},'prices',${id},${'https://example.org/' + id},${id},${at},${at})`;
    await sql`INSERT INTO publications (article_id,source_id,title,url,timeline_at,discovered_at,sort_at,body_mode,eligible,channel,story_id)
      VALUES (${id},'prices','比特币 ETF 资金流入',${'https://example.org/' + id},${at},${at},${at},'summary',true,'news',${story!.id})`;
    if (hidden) await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = ${id}`;
  }
  for (const [at, price] of [['2026-09-01T07:45:00Z', 50000], ['2026-09-01T09:45:00Z', 60000], ['2026-09-02T10:00:00Z', 63000], ['2026-09-03T00:00:00Z', 70000]] as const) {
    await sql`INSERT INTO market_snapshots (asset,observed_at,price_usdt,exchange) VALUES ('BTC',${at},${price},'Binance')`;
  }
  const market = (await storyMarket(story!.id, new Date('2026-09-05T00:00:00Z')))!;
  assert.equal(market.eventAt, first.toISOString(), 'the withdrawn earlier report does not set the event time');
  assert.deepEqual(market.assets.map((a) => [a.asset, a.before.priceUsdt, a.after.priceUsdt, a.after.latest, a.changePercent]), [['BTC', 60000, 63000, false, 5]]);
  const early = (await storyMarket(story!.id, new Date('2026-09-01T20:00:00Z')))!;
  assert.equal(early.assets[0]!.after.latest, true, 'before the day is over, the latest snapshot stands in');
});
