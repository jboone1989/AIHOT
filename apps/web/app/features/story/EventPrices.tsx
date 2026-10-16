import { useText } from "../../components/LanguageSwitch";
import { monthDayTime } from "../../lib/format";

export interface StoryMarket {
  eventAt: string;
  assets: Array<{
    asset: string;
    before: { priceUsdt: number; at: string; exchange: string };
    after: { priceUsdt: number; at: string; exchange: string; latest: boolean };
    changePercent: number;
  }>;
}

const price = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n >= 100 ? 0 : n >= 1 ? 2 : 4 });

/** Prices of the assets an event names, just before its first report and a day later. Side by side only. */
export function EventPrices({ market }: { market: StoryMarket | null }) {
  const t = useText();
  if (!market || market.assets.length === 0) return null;
  return (
    <section className="card p-5 lg:p-[22px]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[14px] font-[650] text-ink">{t("事件前后的价格", "Prices around the event")}</h2>
        <span className="font-mono text-[10.5px] text-ink-4">USDT</span>
      </div>
      <ul className="mt-2 divide-y divide-line-soft">
        {market.assets.map((a) => (
          <li key={a.asset} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-baseline gap-2 py-2.5">
            <b className="font-mono text-[12px] text-ink">{a.asset}</b>
            <span className="num text-[12.5px] text-ink-3">
              {price(a.before.priceUsdt)} → {price(a.after.priceUsdt)}
              <span className="block text-[11px] text-ink-4">{a.after.latest ? t("事件前 → 最新", "Before → latest") : t("事件前 → 24 小时后", "Before → 24h later")}</span>
            </span>
            <span className={`numeral text-[17px] ${a.changePercent >= 0 ? "text-ok" : "text-down"}`}>{a.changePercent > 0 ? "+" : ""}{a.changePercent.toFixed(2)}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11.5px] leading-relaxed text-ink-4">
        {t(`以最早报道（${monthDayTime(market.eventAt)}）为界的 Binance/OKX 现货价格快照，只作并列参考，不表示事件造成了价格变化。`,
          `Binance/OKX spot snapshots around the first report (${monthDayTime(market.eventAt)}), shown side by side for reference. They don’t imply the event moved the price.`)}
      </p>
    </section>
  );
}
