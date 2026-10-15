import { useId, useMemo, useState } from "react";
import { Link } from "react-router";
import { useText, useUiLanguage } from "./LanguageSwitch";
const hasHan=(s:string)=>/[\u3400-\u9fff]/u.test(s);
const englishEntity=(name:string,key:string)=>hasHan(name)?"Entity "+key.slice(0,8):name;
import { IconArrowUpRight, IconClock, IconExternal } from "./icons";

export interface KnowledgeEdge {
  id: string;
  subject: { key: string; name: string; kind: string };
  predicate: string;
  object: { key: string; name: string; kind: string };
  fact: string;
  validAt: string | null;
  invalidAt: string | null;
  evidence: Array<{ articleId: string; url: string; source: string; quote: string; publishedAt: string | null }>;
}
export interface KnowledgeGraph {
  entities: number;
  edges: KnowledgeEdge[];
  status?: string;
}
export interface KnowledgeStats {
  episodes: number; entities: number; relations: number; status?: string;
}

function layout(edges: KnowledgeEdge[]) {
  const weights = new Map<string, { name: string; key: string; degree: number }>();
  for (const edge of edges) for (const node of [edge.subject, edge.object]) {
    const old = weights.get(node.key);
    weights.set(node.key, { key: node.key, name: node.name, degree: (old?.degree ?? 0) + 1 });
  }
  const nodes = [...weights.values()].sort((a, b) => b.degree - a.degree || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).slice(0, 15);
  const coords = new Map(nodes.map((node, i) => {
    const orbit = i === 0 ? 0 : i < 6 ? 1 : 2;
    const index = orbit === 1 ? i - 1 : i - 6;
    const count = orbit === 1 ? Math.min(5, nodes.length - 1) : Math.max(1, nodes.length - 6);
    const angle = -Math.PI / 2 + 2 * Math.PI * index / count + (orbit === 2 ? 0.19 : 0);
    const radiusX = orbit === 1 ? 160 : orbit === 2 ? 320 : 0;
    const radiusY = orbit === 1 ? 112 : orbit === 2 ? 176 : 0;
    return [node.key, { x: 390 + Math.cos(angle) * radiusX, y: 225 + Math.sin(angle) * radiusY }] as const;
  }));
  return { nodes, coords, visibleEdges: edges.filter(e => coords.has(e.subject.key) && coords.has(e.object.key)).slice(0, 30) };
}

function shortName(value: string) {
  return value.length > 19 ? value.slice(0, 18) + "…" : value;
}

/** The drawn area: the nodes' bounds plus room for rings and labels, so a small story graph fills its frame. */
function viewBox(points: Array<{ x: number; y: number }>) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  let x0 = Math.min(...xs) - 110, x1 = Math.max(...xs) + 110;
  const y0 = Math.min(...ys) - 58, y1 = Math.max(...ys) + 72;
  if (x1 - x0 < 460) { const c = (x0 + x1) / 2; x0 = c - 230; x1 = c + 230; }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function KnowledgeCanvas({ edges, activeId, compact = false }: {
  edges: KnowledgeEdge[]; activeId?: string; compact?: boolean;
}) {
  const gridId = `lr-grid-${useId().replaceAll(":", "")}`;
  const { nodes, coords, visibleEdges } = useMemo(() => layout(edges), [edges]);
  const t=useText();
  const lang=useUiLanguage();
  if (!nodes.length) return (
    <div className="lr-graph-empty">
      <span className="lr-graph-empty-mark">◎</span>
      <span>{t("图谱正在积累第一批关系","Relationships are being indexed")}</span>
      <small>{t("只有有事实依据的关系才会出现在这里","Only supported connections are shown")}</small>
    </div>
  );
  const active = edges.find(e => e.id === activeId);
  const related = new Set(active ? [active.subject.key, active.object.key] : []);
  const box = viewBox([...coords.values()]);
  const grid = gridId;
  return (
    <div className={`lr-graph-canvas ${compact ? "lr-graph-compact" : ""}`}>
      <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} role="img" aria-label={lang==="en"?`Knowledge network with ${nodes.length} entities and ${visibleEdges.length} relationships`:`知识关系网络，包含 ${nodes.length} 个可见实体、${visibleEdges.length} 条可见关系`}>
        <defs>
          <pattern id={grid} width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.75" fill="currentColor" opacity="0.14" />
          </pattern>
        </defs>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={`url(#${grid})`} />
        {visibleEdges.map((edge) => {
          const a = coords.get(edge.subject.key)!; const b = coords.get(edge.object.key)!;
          const emphasized = activeId === edge.id;
          return (
            <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              className={`lr-g-edge ${emphasized ? "is-on" : activeId ? "is-dim" : ""}`} />
          );
        })}
        {nodes.map((node, i) => {
          const pt = coords.get(node.key)!;
          const focus = related.has(node.key), dim = activeId && !focus;
          const r = i === 0 ? 30 : node.degree > 2 ? 21 : 16;
          return (
            <a key={node.key} href={`/knowledge/entity/${encodeURIComponent(node.key)}`} aria-label={`${lang==="en"?englishEntity(node.name,node.key):node.name} · ${t("查看实体关系","Explore entity")}`}
              className={`lr-g-node ${i === 0 ? "is-hub" : ""} ${focus ? "is-focus" : ""} ${dim ? "is-dim" : ""}`}>
              <circle cx={pt.x} cy={pt.y} r={r + 8} className="lr-g-halo" />
              <circle cx={pt.x} cy={pt.y} r={r} className="lr-g-dot" />
              {i === 0 && <circle cx={pt.x} cy={pt.y} r="6" className="lr-g-core" />}
              <text x={pt.x} y={pt.y + r + 19} textAnchor="middle" className="lr-g-label" fontSize={i === 0 ? 15 : 12.5}
                fontWeight={i === 0 ? 700 : 500}>{shortName(lang==="en"?englishEntity(node.name,node.key):node.name)}</text>
            </a>
          );
        })}
      </svg>
      <span className="lr-graph-legend"><i className="lr-legend-dot" /> {t("实体节点","Entities")} <i className="lr-legend-line" /> {t("有来源的关系","Sourced relations")}</span>
    </div>
  );
}

function formatDate(date: string | null) {
  if (!date) return null;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : new Intl.DateTimeFormat("en-CA", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" }).format(parsed);
}

export function RelationEvidence({ edge }: { edge: KnowledgeEdge }) {
  const t=useText();
  const lang=useUiLanguage();
  return (
    <article className="lr-evidence">
      <div className="lr-eyebrow">RELATION / {lang==="en"&&hasHan(edge.predicate)?"RELATED TO":edge.predicate.replaceAll("_", " ")}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[15px] font-semibold">
        <Link to={`/knowledge/entity/${encodeURIComponent(edge.subject.key)}`} className="lr-entity-pill">{lang==="en"?englishEntity(edge.subject.name,edge.subject.key):edge.subject.name} <IconArrowUpRight size={12}/></Link>
        <span className="text-ink-4">→</span>
        <Link to={`/knowledge/entity/${encodeURIComponent(edge.object.key)}`} className="lr-entity-pill">{lang==="en"?englishEntity(edge.object.name,edge.object.key):edge.object.name} <IconArrowUpRight size={12}/></Link>
      </div>
      <p className="mt-3 text-[14px] leading-[1.75] text-ink-2">{lang==="en"&&hasHan(edge.fact)?"Relationship recorded from original-language evidence; consult the publisher source for the original wording.":edge.fact}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11.5px] text-ink-4">
        <span className="inline-flex items-center gap-1"><IconClock size={13}/> {formatDate(edge.validAt)??t("时间未确定","Date unknown")} {t("起","since")}</span>
        {edge.invalidAt && <span className="text-hot">{t("关系已失效：","Expired: ")}{formatDate(edge.invalidAt)}</span>}
        <span>{edge.evidence.length} {t("条来源记录","source references")}</span>
      </div>
      <div className="mt-4 border-t border-line-soft pt-3">
        <div className="lr-eyebrow mb-2">SOURCE TRAIL / {t("证据来源","EVIDENCE")}</div>
        {edge.evidence.length ? edge.evidence.slice(0, 5).map((source, i) => (
          <div key={source.articleId + i} className="flex items-start justify-between gap-2 py-2">
            <div>
              <div className="text-[13px] font-medium text-ink">{lang==="en" ? (source.source&&!hasHan(source.source)?source.source:"Publisher") : (source.source||"未命名来源")}</div>
              <div className="mt-1 text-[11.5px] text-ink-4">{formatDate(source.publishedAt)??t("时间未确定","Date unknown")} · {t("Graphiti 提取的关系事实，非原文逐字引述","Graphiti-extracted fact, not a verbatim quote")}</div>
            </div>
            {/^https?:\/\//i.test(source.url) ? (
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="lr-source-link" aria-label={t(`打开${source.source}原文`,`Open original report from ${source.source&&hasHan(source.source)?"publisher":source.source}`)}><IconExternal size={14}/></a>
            ) : <Link to={`/items/${source.articleId}`} className="lr-source-link">{t("查看","View")}</Link>}
          </div>
        )) : <p className="text-[12px] text-ink-4">{t("暂无可展示的来源记录","No source records available")}</p>}
      </div>
    </article>
  );
}

export function KnowledgeExplorer({ graph, compact = false }: { graph: KnowledgeGraph; compact?: boolean }) {
  const lang=useUiLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const t=useText();
  const edges = graph.edges;
  const active = edges.find(e => e.id === selected) ?? edges[0];
  return (
    <div className="lr-explorer-grid">
      <div className="lr-graph-frame">
        <div className="lr-graph-topline"><span><span className="lr-pulse" /> KNOWLEDGE MAP</span><span>GRAPHITI / NEO4J</span></div>
        <KnowledgeCanvas edges={edges} activeId={active?.id} compact={compact}/>
        <div className="lr-graph-bottomline">{t("节点可打开实体档案 · 点击右侧关系切换高亮","Open a node for its profile · Select a relation to highlight it")}</div>
      </div>
      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between">
          <span className="lr-eyebrow">RELATION INDEX / {t("关系索引","RELATIONSHIPS")}</span>
          <span className="mono text-[12px] text-ink-4">{edges.length} LINKS</span>
        </div>
        {edges.length > 0 ? (
          <>
            <div className="lr-relation-list">
              {edges.slice(0, compact ? 8 : 24).map(edge=> (
                <button key={edge.id} type="button" aria-pressed={edge.id === active?.id}
                  onClick={()=>setSelected(edge.id)} className={`lr-relation-row ${edge.id === active?.id ? "is-active" : ""}`}>
                  <span className="min-w-0">
                    <strong>{lang==="en"?englishEntity(edge.subject.name,edge.subject.key):edge.subject.name}</strong><span className="block truncate text-[11px] font-normal text-ink-4">{edge.predicate.replaceAll("_", " ")} → {lang==="en"?englishEntity(edge.object.name,edge.object.key):edge.object.name}</span>
                  </span>
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
            {active && <div className="mt-4"><RelationEvidence edge={active}/></div>}
          </>
        ) : <div className="rounded-panel border border-line p-5 text-[13px] leading-relaxed text-ink-4">
          {graph.status === "unavailable" ? t("知识服务暂时不可用，事件新闻仍可正常阅读。","Knowledge graph temporarily unavailable; news remains accessible.") : t("当前筛选范围暂未发现明确关系。共同出现在新闻中不代表实体有直接关系。","No supported relationships in this view. Co-occurrence is not a factual connection.")}
        </div>}
      </div>
    </div>
  );
}
