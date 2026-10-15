import { beijingDate, beijingTime, beijingWeekday } from "@aihot/contracts/time";

/** "9月28日" of a calendar date (YYYY-MM-DD). */
export function monthDay(date: string): string {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
}

/** "周六" of a calendar date (YYYY-MM-DD). */
export function weekdayShort(date: string): string {
  return beijingWeekday(date).replace("星期", "周");
}

export function relativeTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "刚刚";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} 分钟前`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} 天前`;
  return beijingDate(iso);
}

export function fullDateTime(iso: string): string {
  return `${beijingDate(iso)} ${beijingTime(iso)}`;
}

/** "9月24日 10:51" (Beijing), for lists that span days. */
export function monthDayTime(iso: string): string {
  return `${monthDay(beijingDate(iso))} ${beijingTime(iso)}`;
}

export function sourceInitial(name: string): string {
  const s = name.replace(/^[^\p{L}\p{N}]+/u, "");
  return (s[0] ?? "A").toUpperCase();
}

/** Display locale is passed explicitly so server and client never share language state. */
export type DisplayLanguage = "zh" | "en";
export function localizedMonthDay(date: string, language: DisplayLanguage) {
  return language === "zh" ? monthDay(date) : new Intl.DateTimeFormat("en-US", {month:"short",day:"numeric",timeZone:"Asia/Shanghai"}).format(new Date(date+"T12:00:00+08:00"));
}
export function localizedWeekday(date: string, language: DisplayLanguage) {
  return language === "zh" ? beijingWeekday(date) : new Intl.DateTimeFormat("en-US", {weekday:"long",timeZone:"Asia/Shanghai"}).format(new Date(date+"T12:00:00+08:00"));
}
export function localizedMonthDayTime(iso: string, language: DisplayLanguage) {
  return language === "zh" ? monthDayTime(iso) : new Intl.DateTimeFormat("en-US", {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZone:"Asia/Shanghai"}).format(new Date(iso));
}
export function localizedDateTime(iso: string, language: DisplayLanguage) {
  return language === "zh" ? fullDateTime(iso) : new Intl.DateTimeFormat("en-US", {year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZone:"Asia/Shanghai"}).format(new Date(iso));
}
export function localizedRelativeTime(iso: string, language: DisplayLanguage, now = Date.now()) {
  if (language === "zh") return relativeTime(iso, now);
  const seconds=Math.max(0,Math.round((now-Date.parse(iso))/1000));
  if(seconds<60)return "Just now";
  const minutes=Math.round(seconds/60);
  if(minutes<60)return minutes+"m ago";
  const hours=Math.round(minutes/60);
  if(hours<24)return hours+"h ago";
  const days=Math.round(hours/24);
  return days<30?days+"d ago":localizedDateTime(iso,language).split(",").slice(0,2).join(",");
}
