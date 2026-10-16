import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { KnowledgeAtlasCanvas } from "./KnowledgeAtlasCanvas";
import { RelationEvidence, type KnowledgeEdge } from "./KnowledgeNetwork";
import { useText } from "./LanguageSwitch";
import { IconSearch } from "./icons";
import { findEntities, neighborhood, type AtlasNetwork } from "../lib/knowledge-atlas";
import { trackAnalytics } from "../lib/analytics.client";

export function KnowledgeAtlas() {
  const [network, setNetwork] = useState<AtlasNetwork | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [hops, setHops] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [count, setCount] = useState(40);
  const [relationId, setRelationId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<KnowledgeEdge | null>(null);
  const [evidenceError, setEvidenceError] = useState(false);
  const t = useText();
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch("/api/site/knowledge/network", { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error("network unavailable");
      const value: AtlasNetwork = await r.json();
      if (value.status === "unavailable" || value.status === "disabled") throw new Error("network unavailable");
      setNetwork(value);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    setEvidence(null); setEvidenceError(false);
    if (!relationId) return;
    const controller = new AbortController();
    fetch(`/api/site/knowledge/relations/${encodeURIComponent(relationId)}`, { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error("evidence unavailable");
      const value: { edges: KnowledgeEdge[] } = await r.json();
      setEvidence(value.edges[0] ?? null);
      if (!value.edges.length) setEvidenceError(true);
    }).catch(() => { if (!controller.signal.aborted) setEvidenceError(true); });
    return () => controller.abort();
  }, [relationId]);
  useEffect(() => {
    if (!expanded) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    document.addEventListener("keydown", close);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", close); document.body.style.overflow = previous; };
  }, [expanded]);
  const view = useMemo(() => network && neighborhood(network, selected, hops), [network, selected, hops]);
  const matches = useMemo(() => findEntities(network?.nodes ?? [], query), [network, query]);
  const names = useMemo(() => new Map(network?.nodes.map(n => [n.key, n.name]) ?? []), [network]);
  const node = network?.nodes.find(n => n.key === selected);
  const relations = useMemo(() => network?.links.filter(l => l.source === selected || l.target === selected) ?? [], [network, selected]);
  const selectNode = (key: string) => { setSelected(key); setHops(1); setQuery(""); setCount(40); setRelationId(null); trackAnalytics("graph_node_select"); };
  const selectRelation = (key: string) => { setRelationId(key); trackAnalytics("graph_relation_select"); };
  return <section className={`lr-atlas ${expanded ? "is-expanded" : ""}`} aria-label={t("关系探索工作台", "Relationship Explorer")}>
    <div className="lr-atlas-toolbar">
      <div><span className="lr-pulse" /> <strong>KNOWLEDGE ATLAS</strong><span className="lr-atlas-count" role="status">{view ? t(`${view.nodes.length.toLocaleString()} 个实体 · ${view.links.length.toLocaleString()} 条关系`, `${view.nodes.length.toLocaleString()} entities · ${view.links.length.toLocaleString()} relations`) : t("读取网络…", "Loading network…")}</span></div>
      <div className="lr-atlas-actions">
        <button type="button" aria-pressed={hops === 0} onClick={() => { setHops(0); setSelected(null); setRelationId(null); setCount(40); }}>{t("全库总览", "Full network")}</button>
        {node && <><button type="button" aria-pressed={hops === 1} onClick={() => setHops(1)}>{t("直接联系", "Direct links")}</button><button type="button" aria-pressed={hops === 2} onClick={() => setHops(2)}>{t("展开两层", "Expand 2 hops")}</button></>}
        <button type="button" aria-pressed={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? t("退出大图", "Close expanded view") : t("大图浏览", "Expand view")}</button>
      </div>
    </div>
    <div className="lr-atlas-body">
      <div className="lr-atlas-main">
        {error ? <div className="lr-atlas-state" role="alert"><p>{t("暂时无法读取知识网络。", "The knowledge network is temporarily unavailable.")}</p><button type="button" onClick={() => setAttempt(v => v + 1)}>{t("重新加载", "Retry")}</button></div>
          : view?.nodes.length ? <KnowledgeAtlasCanvas network={view} selectedKey={selected} onNode={selectNode} onRelation={selectRelation}/>
          : <div className="lr-atlas-state" role="status">{network ? t("暂无公开的实体网络", "No public entity network yet") : t("正在读取完整网络…", "Loading the full network…")}</div>}
        <div className="lr-atlas-caption">{t("当前显示", "Showing")} {view?.nodes.length.toLocaleString() ?? "—"} / {network?.nodes.length.toLocaleString() ?? "—"} {t("个可公开实体", "public entities")}<span>{t("节点越大，直接关系越多 · 虚线为已失效关系", "Larger nodes have more direct relations · Dashed links have expired")}</span></div>
      </div>
      <aside className="lr-atlas-sidebar" aria-label={t("实体目录与关系", "Entity directory and relations")}>
        <label className="lr-knowledge-search"><IconSearch size={17}/><span className="sr-only">{t("搜索全库实体", "Search all entities")}</span><input value={query} onChange={e => { setQuery(e.target.value); setCount(40); }} placeholder={t("搜索全部实体…", "Search all entities…")}/></label>
        {node && !query ? <>
          <div className="lr-atlas-entity"><span className="lr-eyebrow">{t("正在探索", "EXPLORING")}</span><h3>{node.name}</h3><p>{node.degree} {t("条直接关系", "direct relations")}</p><Link to={`/knowledge/entity/${encodeURIComponent(node.key)}`} className="lr-inline-link">{t("打开实体档案", "Open entity profile")} ↗</Link><button type="button" onClick={() => { setSelected(null); setHops(0); setRelationId(null); setCount(40); }}>{t("返回实体目录", "Back to directory")}</button></div>
          <div className="lr-atlas-list-heading">{t("沿关系继续探索", "FOLLOW THE CONNECTIONS")} <span>{relations.length}</span></div>
          <div className="lr-atlas-list">{relations.slice(0, count).map(l => {
            const other = l.source === selected ? l.target : l.source;
            return <div className={`lr-atlas-connection ${relationId === l.id ? "is-active" : ""}`} key={l.id}>
              <button type="button" onClick={() => selectNode(other)} aria-label={t(`探索 ${names.get(other)}`, `Explore ${names.get(other)}`)}><strong>{names.get(other)}</strong><span>{l.source === selected ? "→ " : "← "}{l.predicate.replaceAll("_", " ")}</span></button>
              <button type="button" onClick={() => selectRelation(l.id)} aria-label={t(`查看关系证据 ${l.predicate}`, `View evidence ${l.predicate}`)}>{t("证据", "Evidence")} ↗</button>
            </div>;
          })}{!relations.length && <p className="lr-atlas-hint">{t("这个实体已有报道提及，暂未形成可公开的关系。", "This entity has public mentions but no public relationships yet.")}</p>}</div>
          {relations.length > count && <button className="lr-atlas-more" type="button" onClick={() => setCount(v => v + 40)}>{t("显示更多关系", "Show more relations")}</button>}
        </> : <>
          <div className="lr-atlas-list-heading">{query ? t("全库搜索结果", "SEARCH RESULTS") : t("实体目录 · 按关联数排序", "ENTITY DIRECTORY · MOST CONNECTED")}<span>{matches.length.toLocaleString()}</span></div>
          <div className="lr-atlas-list">{matches.slice(0, count).map(n => <button type="button" className="lr-atlas-node-row" key={n.key} onClick={() => selectNode(n.key)}><strong>{n.name}</strong><span>{n.degree} ↗</span></button>)}{!matches.length && network && <p className="lr-atlas-hint">{t("没有找到匹配实体，试试其他名称。", "No matching entities. Try another name.")}</p>}</div>
          {matches.length > count && <button className="lr-atlas-more" type="button" onClick={() => setCount(v => v + 40)}>{t(`加载更多（${Math.min(count, matches.length)} / ${matches.length}）`, `Show more (${Math.min(count, matches.length)} / ${matches.length})`)}</button>}
        </>}
      </aside>
    </div>
    {network?.truncated && <p className="lr-atlas-hint" role="status">{t("网络超过单次加载上限（10,000 个实体、20,000 条关系），当前并非全库。", "The network exceeds the load limit (10,000 entities / 20,000 relations); this is a partial view.")}</p>}
    {relationId && <div className="lr-atlas-evidence" aria-live="polite"><div className="lr-atlas-list-heading">{t("关系证据", "RELATION EVIDENCE")}<button type="button" onClick={() => setRelationId(null)}>{t("关闭证据", "Close evidence")} ×</button></div>{evidence?.id === relationId ? <RelationEvidence edge={evidence}/> : <p className="lr-atlas-hint">{evidenceError ? t("这条关系的公开证据暂不可用，请重新选择。", "Public evidence is unavailable. Please select another relation.") : t("正在读取来源证据…", "Loading source evidence…")}</p>}</div>}
  </section>;
}
