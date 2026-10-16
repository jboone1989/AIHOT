import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { KnowledgeAtlasCanvas } from "./KnowledgeAtlasCanvas";
import { RelationEvidence, type KnowledgeEdge } from "./KnowledgeNetwork";
import { useText } from "./LanguageSwitch";
import { IconSearch } from "./icons";
import { mergeAtlasNetworks, type AtlasNetwork, type AtlasNode } from "../lib/knowledge-atlas";
import { trackAnalytics } from "../lib/analytics.client";

const empty: AtlasNetwork = { nodes: [], links: [], truncated: false };
export function KnowledgeAtlas({ initialKey = null }: { initialKey?: string | null }) {
  const t = useText();
  const [selected, setSelected] = useState<string | null>(initialKey);
  const [hasNetwork, setHasNetwork] = useState(false);
  const [query, setQuery] = useState("");
  const [centers, setCenters] = useState<AtlasNode[]>([]);
  const [network, setNetwork] = useState<AtlasNetwork>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [relationId, setRelationId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<KnowledgeEdge | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const current = useRef<string | null>(selected);
  current.current = selected;
  useEffect(() => {
    const sharedKey = new URLSearchParams(window.location.search).get("entity");
    if (sharedKey) setSelected(sharedKey);
  }, []);
  useEffect(() => {
    const onPop = () => setSelected(new URLSearchParams(window.location.search).get("entity") ?? initialKey);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [initialKey]);
  const choose = (key: string | null) => {
    const url = new URL(window.location.href);
    if (key) url.searchParams.set("entity", key); else url.searchParams.delete("entity");
    window.history.pushState(null, "", url);
    setSelected(key);
  };
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/site/knowledge/centers?q=" + encodeURIComponent(query.trim()), {signal:controller.signal})
        .then(r => {if(!r.ok) throw Error("search failed"); return r.json() as Promise<{nodes:AtlasNode[]}>;})
        .then(v => setCenters(v.nodes)).catch(() => {if(!controller.signal.aborted) setCenters([]);});
    }, query ? 250 : 0);
    return () => {clearTimeout(timer);controller.abort();};
  }, [query]);
  useEffect(() => {
    if(!selected) {setNetwork(empty);setHasNetwork(false);setLoading(false);setError(false);return;}
    const controller = new AbortController();
    setLoading(true);setError(false);setRelationId(null);
    fetch("/api/site/knowledge/neighborhood/" + encodeURIComponent(selected), {signal:controller.signal})
      .then(r => {if(!r.ok) throw Error("neighborhood failed");return r.json() as Promise<AtlasNetwork>;})
      .then(v => {if(!controller.signal.aborted) {setNetwork(previous => mergeAtlasNetworks(previous, v));setHasNetwork(true);}})
      .catch(() => {if(!controller.signal.aborted) setError(true);})
      .finally(() => {if(!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [selected,attempt]);
  useEffect(() => {
    setEvidence(null);
    if(!relationId) return;
    const controller = new AbortController();
    fetch("/api/site/knowledge/relations/" + encodeURIComponent(relationId), {signal:controller.signal})
      .then(r=>r.json() as Promise<{edges:KnowledgeEdge[]}>)
      .then(v=> {if(!controller.signal.aborted) setEvidence(v.edges?.[0]??null);})
      .catch(()=>{});
    return ()=>controller.abort();
  },[relationId]);
  useEffect(() => {
    if(!expanded)return;
    const close=(e:KeyboardEvent)=>{if(e.key==="Escape")setExpanded(false);};
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    document.addEventListener("keydown",close);
    return ()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",close);};
  },[expanded]);
  const focus=(key:string)=>{
    if(current.current===key)return;
    if(current.current)setHistory(v=>[...v.slice(-19),current.current!]);
    choose(key);
    setQuery("");setRelationId(null);
    trackAnalytics("graph_node_select");
  };
  const back=()=>setHistory(v=>{
    const next=[...v], key=next.pop();
    if(key)choose(key);
    return next;
  });
  const center=network.nodes.find(n=>n.key===selected);
  const relations=network.links.filter(l=>l.source===selected||l.target===selected);
  const names=new Map(network.nodes.map(n=>[n.key,n.name]));
  return <section className={`lr-atlas ${expanded?"is-expanded":""}`} aria-label={t("实体关系探索","Entity relationship explorer")}>
    <div className="lr-atlas-toolbar"><div><span className="lr-pulse"/> <strong>KNOWLEDGE ATLAS</strong>
      <span className="lr-atlas-count">{selected?t(`${network.nodes.length} 个实体 · ${network.links.length} 条关系`,`${network.nodes.length} entities · ${network.links.length} relations`):t("按实体探索","Explore by entity")}</span></div>
      <div className="lr-atlas-actions">
        {history.length>0&&<button type="button" onClick={back}>{t("返回上一实体","Previous entity")}</button>}
        {selected&&<button type="button" onClick={()=>{choose(null);setHistory([]);}}>{t("实体目录","Directory")}</button>}
        <button type="button" aria-pressed={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?t("退出大图","Close expanded view"):t("大图浏览","Expand view")}</button>
      </div>
    </div>
    <div className="lr-atlas-body">
      <div className="lr-atlas-main">
        {selected&&hasNetwork&&network.nodes.length?<><KnowledgeAtlasCanvas network={network} selectedKey={selected} onNode={focus} onRelation={id=>{setRelationId(id);trackAnalytics("graph_relation_select");}}/>
            <div className="lr-atlas-caption" role="status" aria-live="polite" style={{minHeight:"1.5em"}}>
              {error?<>{t("邻近关系读取失败","Unable to update neighbors")} <button type="button" onClick={()=>setAttempt(v=>v+1)}>{t("重试","Retry")}</button></>:loading?t("正在补充邻近关系…","Updating nearby relations…"):"\u00a0"}
            </div></>
          :error?<div className="lr-atlas-state" role="alert"><p>{t("实体关系暂时无法读取","Unable to load entity relationships")}</p><button type="button" onClick={()=>setAttempt(v=>v+1)}>{t("重试","Retry")}</button></div>
          :loading?<div className="lr-atlas-state" role="status">{t("正在读取邻近关系…","Loading nearby relationships…")}</div>
          :<div className="lr-atlas-state" role="status">{selected?t("暂无可公开的邻近关系","No public neighbors yet"):t("从右侧搜索或选择一个实体开始探索","Search or select an entity to begin")}</div>}
        <div className="lr-atlas-caption">{t("按需展开实体的全部已公开关系，保留探索过的节点与连线。","Explore all published links of a node; previously discovered relations remain visible.")}</div>
      </div>
      <aside className="lr-atlas-sidebar">
        <label className="lr-knowledge-search"><IconSearch size={17}/><span className="sr-only">{t("搜索实体","Search entities")}</span>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("搜索实体名称…","Search entity names…")}/></label>
        {selected&&!query&&center&&<div className="lr-atlas-entity"><span className="lr-eyebrow">{t("当前中心实体","FOCUS ENTITY")}</span><h3>{center.name}</h3>
          <p>{relations.length} {t("条可公开关系","public relations")}</p>
          {center.key!==initialKey&&<Link to={`/knowledge/entity/${encodeURIComponent(center.key)}`} className="lr-inline-link">{t("打开实体档案","Open entity profile")} ↗</Link>}
        </div>}
        <div className="lr-atlas-list-heading">{query||!selected?t("选择实体","CHOOSE AN ENTITY"):t("沿关系继续探索","FOLLOW CONNECTIONS")}</div>
        <div className="lr-atlas-list">
          {query||!selected?centers.map(n=><button className="lr-atlas-node-row" type="button" key={n.key} onClick={()=>focus(n.key)}><strong>{n.name}</strong><span>↗</span></button>)
          :relations.map(l=>{const other=l.source===selected?l.target:l.source;return <div className="lr-atlas-connection" key={l.id}>
            <button type="button" onClick={()=>focus(other)}><strong>{names.get(other)??other}</strong><span>{l.predicate.replaceAll("_"," ")}</span></button>
            <button type="button" onClick={()=>setRelationId(l.id)}>{t("证据","Evidence")} ↗</button>
          </div>;})}
        </div>
      </aside>
    </div>
    {relationId&&<div className="lr-atlas-evidence"><div className="lr-atlas-list-heading">{t("关系证据","RELATION EVIDENCE")}<button type="button" onClick={()=>setRelationId(null)}>{t("关闭","Close")} ×</button></div>
      {evidence?.id===relationId?<RelationEvidence edge={evidence}/>:<p className="lr-atlas-hint">{t("正在读取证据…","Loading evidence…")}</p>}
    </div>}
  </section>;
}
