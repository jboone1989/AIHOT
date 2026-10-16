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

function readableLabels(instance: Core, dense: boolean) {
  const zoom = instance.zoom();
  instance.nodes().style({ "font-size": 11 / zoom, "text-margin-y": 4 / zoom, "text-outline-width": 1.6 / zoom, "text-max-width": `${120 / zoom}px`, "min-zoomed-font-size": dense && zoom < 1.1 ? 1000 : 0 });
  instance.nodes("[?hub], .chosen, .hovered").style({ "font-size": 13 / zoom, "min-zoomed-font-size": 0 });
  instance.edges().style("width", Math.min(16, 0.55 / zoom));
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
  const focusRef = useRef(selectedKey);
  focusRef.current = selectedKey;
  // Keep one Cytoscape instance for the lifetime of the explorer. Recreating it
  // on every selection discards node coordinates, zoom and user orientation.
  useEffect(() => {
    let disposed = false;
    let resize: ResizeObserver | undefined;
    import("cytoscape").then(({ default: cytoscape }) => {
      if (disposed || !container.current) return;
      const instance = cytoscape({
        container: container.current, style: createStyles(), pixelRatio: 1,
        minZoom: 0.2, maxZoom: 5, wheelSensitivity: 0.2,
        elements: [], layout: { name: "preset" },
      });
      cy.current = instance;
      instance.on("zoom", () => readableLabels(instance, false));
      instance.on("mouseover", "node", e => { e.target.addClass("hovered"); readableLabels(instance, false); });
      instance.on("mouseout", "node", e => { e.target.removeClass("hovered"); readableLabels(instance, false); });
      instance.on("tap", "node", e => callbacks.current.onNode(e.target.id()));
      instance.on("tap", "edge", e => callbacks.current.onRelation(e.target.data("key")));
      resize = new ResizeObserver(() => instance.resize());
      resize.observe(container.current);
      setReady(true);
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; resize?.disconnect(); cy.current?.destroy(); cy.current = null; };
  }, []);
  useEffect(() => {
    const instance = cy.current;
    if (!instance || !ready) return;
    const existing = new Set(instance.nodes().map(n => n.id()));
    const desired = new Set(network.nodes.map(n => n.key));
    const centerNode = selectedKey ? instance.getElementById(selectedKey) : null;
    const anchor = centerNode && centerNode.length ? centerNode.position() : { x: 0, y: 0 };
    // Place only genuinely new neighbors. Existing nodes NEVER change coordinates.
    const newcomers = network.nodes.filter(n => !existing.has(n.key));
    const firstLoad = existing.size === 0;
    instance.batch(() => {
      for (const n of network.nodes) {
        const old = instance.getElementById(n.key);
        if (old.length) {
          old.data({ name: n.name, size: n.key === selectedKey ? 48 : Math.min(35, 14 + Math.sqrt(n.degree) * 3) });
        }
      }
      newcomers.forEach((n, i) => {
        const angle = -Math.PI / 2 + i * Math.PI * (3 - Math.sqrt(5));
        const radius = 135 + Math.floor(i / 14) * 105;
        const position = n.key === selectedKey && firstLoad ? { x: 0, y: 0 } : {
          x: anchor.x + Math.cos(angle) * radius,
          y: anchor.y + Math.sin(angle) * radius,
        };
        instance.add({ group: "nodes", data: {
          id: n.key, name: n.name, size: n.key === selectedKey ? 48 : Math.min(35, 14 + Math.sqrt(n.degree) * 3),
          color: n.degree >= 8 ? "#8baff8" : "#69d8c2",
        }, position });
      });
      const edgeIds = new Set(network.links.map(l => "r:" + l.id));
      instance.edges().filter(e => !edgeIds.has(e.id())).remove();
      for (const l of network.links) {
        const id = "r:" + l.id;
        if (!instance.getElementById(id).length && instance.getElementById(l.source).length && instance.getElementById(l.target).length) {
          instance.add({ group: "edges", data: { id, key: l.id, source: l.source, target: l.target, expired: !!l.invalidAt } });
        }
      }
      instance.nodes().filter(n => !desired.has(n.id())).remove();
    });
    instance.nodes().removeClass("chosen");
    if (selectedKey) {
      const target = instance.getElementById(selectedKey);
      target.addClass("chosen");
      if (firstLoad) instance.fit(undefined, 45);
      else if (target.length) instance.animate({ center: { eles: target }, duration: 350, easing: "ease-in-out" });
    }
    readableLabels(instance, false);
  }, [network, selectedKey, ready]);
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
