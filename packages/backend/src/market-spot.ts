// Canonical read-only exchange quotes, separate from editorial news.
export const SPOT_ASSETS = ["BTC", "ETH", "SOL", "XRP", "BNB"] as const;
export type SpotAsset = typeof SPOT_ASSETS[number];
export type SpotQuote = {
  exchange: "Binance" | "OKX";
  symbol: string;
  pair: string;
  priceUsdt: number;
  change24hPercent: number;
  quoteVolume24hUsdt: number;
  exchangeAt: string;
  sourceUrl: string;
};
type Getter = (url: string, init?: RequestInit) => Promise<Response>;
const finite = (value: unknown): number => {
  if (value === null || value === undefined || value === "") throw Error("missing exchange number");
  const n = Number(value);
  if (!Number.isFinite(n)) throw Error("invalid exchange number");
  return n;
};
const instant = (ms: unknown): string => {
  const date = new Date(finite(ms));
  if (Number.isNaN(date.getTime())) throw Error("invalid exchange timestamp");
  return date.toISOString();
};
const json = async (url: string, getter: Getter): Promise<unknown> => {
  const res = await getter(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw Error("exchange HTTP " + res.status);
  return res.json();
};
export async function readBinanceSpot(asset: SpotAsset, getter: Getter = fetch): Promise<SpotQuote> {
  const pair = asset + "USDT";
  const url = "https://data-api.binance.vision/api/v3/ticker/24hr?symbol=" + pair;
  const raw = await json(url, getter) as Record<string, unknown>;
  if (raw.symbol !== pair) throw Error("unexpected Binance symbol");
  const price = finite(raw.lastPrice);
  if (price <= 0) throw Error("invalid Binance price");
  return { exchange: "Binance", symbol: asset, pair, priceUsdt: price,
    change24hPercent: finite(raw.priceChangePercent),
    quoteVolume24hUsdt: Math.max(0, finite(raw.quoteVolume)),
    exchangeAt: instant(raw.closeTime), sourceUrl: url };
}
export async function readOkxSpot(asset: SpotAsset, getter: Getter = fetch): Promise<SpotQuote> {
  const pair = asset + "-USDT";
  const url = "https://www.okx.com/api/v5/market/ticker?instId=" + pair;
  const raw = await json(url, getter) as { code?: string; data?: Array<Record<string, unknown>> };
  if (raw.code !== "0" || !Array.isArray(raw.data)) throw Error("unexpected OKX response");
  const quote = raw.data.find(r => r.instId === pair);
  if (!quote) throw Error("missing OKX pair");
  const price = finite(quote.last), open24h = finite(quote.open24h);
  if (price <= 0 || open24h <= 0) throw Error("invalid OKX prices");
  return { exchange: "OKX", symbol: asset, pair, priceUsdt: price,
    change24hPercent: Number(((price / open24h - 1) * 100).toFixed(6)),
    quoteVolume24hUsdt: Math.max(0, finite(quote.volCcy24h)),
    exchangeAt: instant(quote.ts), sourceUrl: url };
}
export async function loadSpot(asset: SpotAsset, getter: Getter = fetch) {
  const observedAt = new Date().toISOString();
  const results = await Promise.allSettled([readBinanceSpot(asset, getter), readOkxSpot(asset, getter)]);
  const observations: SpotQuote[] = [];
  const errors: Array<{ exchange: string; error: string }> = [];
  results.forEach((r, i) => {
    const exchange = i === 0 ? "Binance" : "OKX";
    if (r.status === "fulfilled") observations.push(r.value);
    else errors.push({ exchange, error: "upstream_unavailable" });
  });
  return { schemaVersion: 1 as const, asset, quote: "USDT" as const, observedAt, observations, errors };
}
const cache = new Map<SpotAsset, { until: number; result: ReturnType<typeof loadSpot> }>();
export function getSpot(asset: SpotAsset) {
  const now = Date.now(), prior = cache.get(asset);
  if (prior && prior.until > now) return prior.result;
  const promise = loadSpot(asset);
  cache.set(asset, { until: now + 60_000, result: promise });
  return promise;
}
