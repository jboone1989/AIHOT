import { useEffect, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router";

/** The reading preference is client-only. The canonical server-rendered site stays Chinese.
 * This avoids shared-cache language leaks and duplicate unqualified SEO pages.
 */
export type UiLanguage = "zh" | "en";
const KEY = "livingruntime-language";
const listeners = new Set<() => void>();
let selected: UiLanguage = "zh";
let initialized = false;
function read(): UiLanguage {
  if (!initialized && typeof window !== "undefined") {
    initialized = true;
    try { selected = window.localStorage.getItem(KEY) === "en" ? "en" : "zh"; } catch {}
  }
  return selected;
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      selected = e.newValue === "en" ? "en" : "zh";
      listeners.forEach(f => f());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(fn); window.removeEventListener("storage", onStorage); };
}
export function useUiLanguage(): UiLanguage {
  const lang = useSyncExternalStore<UiLanguage>(subscribe, read, () => "zh");
  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    document.documentElement.dataset.language = lang;
  }, [lang]);
  return lang;
}
export function setUiLanguage(lang: UiLanguage) {
  selected = lang;
  initialized = true;
  try { window.localStorage.setItem(KEY, lang); } catch {}
  listeners.forEach(f => f());
}
export function useText() {
  const lang = useUiLanguage();
  return (zh: string, en: string) => lang === "en" ? en : zh;
}

/** Shared browser preference. On article pages use the existing original-language endpoint.
 * A Chinese-original article remains Chinese; it must never be mislabeled as translated English.
 */
export function LanguageSwitch({compact=false}: {compact?:boolean}) {
  const lang = useUiLanguage();
  const {pathname} = useLocation();
  const navigate=useNavigate();
  const choose=(next: UiLanguage) => {
    if(next===lang) return;
    setUiLanguage(next);
    const match=/^\/items\/([a-zA-Z0-9_-]{1,80})(?:\/original)?$/.exec(pathname);
    if(match) void navigate(`/items/${match[1]}${next==="en"?"/original":""}`,{replace:true});
  };
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-1 ${compact?"text-[11px]":"text-[12px]"}`} role="group" aria-label="Language / 语言">
      <button type="button" onClick={()=>choose("en")} aria-pressed={lang==="en"}
        className={`rounded-md px-2 py-1.5 font-semibold transition-colors ${lang==="en"?"bg-accent text-white":"text-ink-3 hover:bg-bg-sunk"}`}>EN</button>
      <button type="button" onClick={()=>choose("zh")} aria-pressed={lang==="zh"}
        className={`rounded-md px-2 py-1.5 font-semibold transition-colors ${lang==="zh"?"bg-accent text-white":"text-ink-3 hover:bg-bg-sunk"}`}>中文</button>
    </div>
  );
}
