import type { HotEntryView } from "@aihot/contracts/site";
import { useText } from "../../components/LanguageSwitch";

/** Change against six hours before the ranking: up in the hot tone, down quiet, new stories marked new, none while sources are behind. */
export function Delta({ trend, pct, className = "" }: { trend: HotEntryView["trend"]; pct: number | null; className?: string }) {
  const t=useText();
  const base = `inline-flex h-[22px] shrink-0 items-center gap-0.5 rounded-full px-2 text-[11.5px] font-medium tabular-nums ${className}`;
  if (trend === "unknown") return <span className={`${base} bg-bg-sunk text-ink-4 dark:bg-bg-muted/60`} title={t("部分信源的采集暂时落后，先不和 6 小时前比较","Some sources are delayed; no 6-hour comparison available")}>{t("暂不比较","Not comparable")}</span>;
  if (trend === "new" || pct === null) return <span className={`${base} bg-accent-soft text-accent`}>{t("新上榜","New")}</span>;
  if (trend === "flat") return <span className={`${base} bg-bg-sunk text-ink-4 dark:bg-bg-muted/60`} title={t("较 6 小时前","Compared with 6h ago")}>{t("持平","Stable")}</span>;
  const up = trend === "up";
  return (
    <span className={`${base} ${up ? "bg-hot-soft text-hot" : "bg-bg-sunk text-ink-4 dark:bg-bg-muted/60"}`} title={t("较 6 小时前","Compared with 6h ago")}>
      {up ? "↑" : "↓"} {Math.abs(Math.round(pct))}%
    </span>
  );
}
