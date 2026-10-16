import { useEffect, useRef, useState } from "react";
import type { Core, StylesheetJson } from "cytoscape";
import type { AtlasNetwork } from "../lib/knowledge-atlas";
import { useText } from "./LanguageSwitch";

function createStyles(): StylesheetJson {
  return [
    { selector: "node", style: { label: "data(name)", width: "data(size)", height: "data(size)", "background-color": "data(color)", color: "#e6edf5", "font-size": 11, "min-zoomed-font-size": 8, "text-valign": "bottom", "text-margin-y": 5, "text-outline-color": "#111c2d", "text-outline-width": 2, "text-wrap": "ellipsis", "text-max-width": "140px" } },
    { selector: "edge", style: { width: 0.7, "line-color": "#698a9c", opacity: 0.3, "curve-style": "haystack" } },
    { selector: "edge[?expired]", style: { "line-style": "dashed", opacity: 0.15 } },
    { selector: "node[?hub]", style: { "font-size": 22, "min-zoomed-font-size": 0, "font-weight": "bold", color: "#f3f6ff" } },
    { selector: ".chosen", style: { "background-color": "#fff1af", "border-width": 3, "border-color": "#ffffff", "font-size": 16, "font-weight": "bold", "z-index": 10 } },
    { selector: "edge:selected", style: { width: 3, "line-color": "#fff1af", opacity: 1 } },
  ];
}

export function KnowledgeAtlasCanvas({ network, selectedKey, onNode, onRelation }: {
  network: AtlasNetwork; selectedKey: string | null; onNode: (key: string) => void; onRelation: (key: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const callbacks = useRef({ onNode, onRelation });
  callbacks.current = { onNode, onRelation };
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = useText();
  useEffect(() => {
    let disposed = false;
    let resize: ResizeObserver | undefined;
    setReady(false); setFailed(false);
    import("cytoscape").then(({ default: cytoscape }) => {
      if (disposed || !container.current) return;
      const instance = cytoscape({
        container: container.current, style: createStyles(), pixelRatio: 1,
        minZoom: 0.03, maxZoom: 5, wheelSensitivity: 0.2,
        elements: [
          ...network.nodes.map(n => ({ data: { id: n.key, name: n.name, hub: n.degree >= 25, size: Math.min(48, 8 + Math.sqrt(n.degree) * 3), color: n.degree >= 25 ? "#d5a4f0" : n.degree >= 8 ? "#8baff8" : "#69d8c2" } })),
          ...network.links.map(l => ({ data: { id: "r:" + l.id, key: l.id, source: l.source, target: l.target, expired: !!l.invalidAt } })),
        ],
        layout: { name: "preset" },
      });
      cy.current = instance;
      instance.one("layoutstop", () => { if (!disposed) { instance.fit(undefined, 35); setReady(true); } });
      instance.layout({ name: "cose", animate: true, randomize: true, refresh: 15, numIter: 160, initialTemp: 120, coolingFactor: 0.97, componentSpacing: 70, nodeRepulsion: 6000, idealEdgeLength: 65, padding: 35 }).run();
      instance.on("tap", "node", e => callbacks.current.onNode(e.target.id()));
      instance.on("tap", "edge", e => callbacks.current.onRelation(e.target.data("key")));
      resize = new ResizeObserver(() => { instance.resize(); instance.fit(undefined, 35); });
      resize.observe(container.current);
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; resize?.disconnect(); cy.current?.destroy(); cy.current = null; };
  }, [network]);
  useEffect(() => {
    const instance = cy.current;
    if (!instance) return;
    instance.nodes().removeClass("chosen");
    if (selectedKey) instance.getElementById(selectedKey).addClass("chosen");
  }, [selectedKey, ready]);
  const zoom = (factor: number) => { const instance = cy.current; if (instance) instance.zoom({ level: instance.zoom() * factor, renderedPosition: { x: instance.width() / 2, y: instance.height() / 2 } }); };
  return <div className="lr-atlas-map">
    <div ref={container} className="lr-atlas-canvas" role="img" aria-label={t(`知识网络：${network.nodes.length} 个实体，${network.links.length} 条关系；可通过实体目录进行键盘探索`, `Knowledge network: ${network.nodes.length} entities, ${network.links.length} relations; use the entity directory for keyboard exploration`)} />
    {!ready && <div className="lr-atlas-loading" role="status">{failed ? t("绘图未能加载，请使用右侧实体目录或刷新重试。", "Map could not load. Use the entity directory or reload.") : t("正在展开知识网络…", "Opening the knowledge network…")}</div>}
    <div className="lr-atlas-zoom">
      <button type="button" aria-label={t("放大图谱", "Zoom in")} onClick={() => zoom(1.5)}>+</button>
      <button type="button" aria-label={t("缩小图谱", "Zoom out")} onClick={() => zoom(1 / 1.5)}>−</button>
      <button type="button" onClick={() => cy.current?.fit(undefined, 35)}>{t("适应画布", "Fit graph")}</button>
    </div>
    <div className="lr-atlas-map-note">{t("拖动画布 · 滚轮或双指缩放 · 点击节点探索", "Drag to pan · Scroll or pinch to zoom · Select a node")}</div>
  </div>;
}
