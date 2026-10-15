import { Link } from "react-router";
import type { KnowledgeEdge } from "../../components/KnowledgeNetwork";
import { useText, useUiLanguage } from "../../components/LanguageSwitch";

export interface DailyGraphChanges {
  key: string;
  windowStart: string;
  windowEnd: string;
  status: string;
  added: { count: number; edges: KnowledgeEdge[] };
  ended: { count: number; edges: KnowledgeEdge[] };
  newEntities: { count: number; items: Array<{ key: string; name: string }> };
}

const hasHan = (s: string) => /[㐀-鿿]/u.test(s);
const entityHref = (key: string) => `/knowledge/entity/${encodeURIComponent(key)}`;

function Relations({ edges, ended }: { edges: KnowledgeEdge[]; ended?: boolean }) {
  const lang = useUiLanguage();
  const name = (n: { key: string; name: string }) => (lang === "en" && hasHan(n.name) ? `Entity ${n.key.slice(0, 8)}` : n.name);
  return (
    <ul className="lr-change-list">
      {edges.map((e) => (
        <li key={e.id} className={ended ? "is-ended" : undefined}>
          <div className="lr-tl-rel">
            <Link to={entityHref(e.subject.key)}>{name(e.subject)}</Link>
            <span className="lr-proof-pred">{lang === "en" && hasHan(e.predicate) ? "RELATED TO" : e.predicate.replaceAll("_", " ")}</span>
            <Link to={entityHref(e.object.key)}>{name(e.object)}</Link>
          </div>
          {(lang === "zh" || !hasHan(e.fact)) && <p>{e.fact}</p>}
        </li>
      ))}
    </ul>
  );
}

/** A daily issue's "graph changes": counted by rule from Graphiti's records, with sourced examples. */
export function GraphChanges({ changes }: { changes: DailyGraphChanges | null }) {
  const t = useText();
  const lang = useUiLanguage();
  if (!changes || changes.status !== "ok") return null;
  const { added, ended, newEntities } = changes;
  if (added.count + ended.count + newEntities.count === 0) return null;
  const entities = lang === "en" ? newEntities.items.filter((e) => !hasHan(e.name)) : newEntities.items;
  const metrics = [
    { code: "ADDED", value: added.count, label: t("新增关系", "New relations") },
    { code: "ENDED", value: ended.count, label: t("失效关系", "Ended relations") },
    { code: "ENTITIES", value: newEntities.count, label: t("新出现的实体", "New entities") },
  ];
  return (
    <section className="lr-graph-changes" aria-labelledby="graph-changes">
      <div className="lr-eyebrow">KNOWLEDGE GRAPH / {t("图谱今日变化", "GRAPH CHANGES")}</div>
      <h2 id="graph-changes">{t("图谱今日变化", "What changed in the graph")}</h2>
      <div className="lr-metric-strip">
        {metrics.map((m) => <div key={m.code}><div className="lr-eyebrow">{m.code}</div><strong>{m.value.toLocaleString("en-US")}</strong><span>{m.label}</span></div>)}
      </div>
      <div className="lr-change-grid">
        {added.edges.length > 0 && <div><h3>{t("新增关系", "New relations")}</h3><Relations edges={added.edges} /></div>}
        {ended.edges.length > 0 && <div><h3>{t("失效关系", "Ended relations")}</h3><Relations edges={ended.edges} ended /></div>}
      </div>
      {entities.length > 0 && (
        <div className="mt-4">
          <h3>{t("新出现的实体", "New entities")}</h3>
          <div className="lr-follow-chips mt-2">
            {entities.map((e) => <Link key={e.key} to={entityHref(e.key)}>{e.name}</Link>)}
            {newEntities.count > entities.length && <span className="self-center text-[12px] text-ink-4">+{(newEntities.count - entities.length).toLocaleString("en-US")}</span>}
          </div>
        </div>
      )}
      <p className="mt-4 text-[12px] leading-[1.7] text-ink-4">
        {t("按 Graphiti 在本期时间窗口内记下的变化统计，规则生成，不经过模型改写；示例只列出有公开报道支撑的关系。",
          "Counted by rule from what Graphiti recorded during this issue’s window, with no model rewriting. Examples list only relations backed by a public report.")}
      </p>
    </section>
  );
}
