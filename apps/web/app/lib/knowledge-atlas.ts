export interface AtlasNode { key: string; name: string; degree: number }
export interface AtlasLink { id: string; source: string; target: string; predicate: string; invalidAt: string | null }
export interface AtlasNetwork { nodes: AtlasNode[]; links: AtlasLink[]; truncated: boolean; status?: string }

/** Undirected exploration keeps the original directed facts; no inferred edges are added. */
export function neighborhood(network: AtlasNetwork, key: string | null, hops: number): AtlasNetwork {
  if (!key || hops === 0) return network;
  const keys = new Set([key]);
  for (let i = 0; i < hops; i++) {
    const next = new Set(keys);
    for (const link of network.links) {
      if (keys.has(link.source)) next.add(link.target);
      if (keys.has(link.target)) next.add(link.source);
    }
    for (const k of next) keys.add(k);
  }
  return { ...network, nodes: network.nodes.filter(n => keys.has(n.key)), links: network.links.filter(l => keys.has(l.source) && keys.has(l.target)) };
}

export function findEntities(nodes: AtlasNode[], query: string) {
  const q = query.trim().toLocaleLowerCase();
  return nodes.filter(n => !q || n.name.toLocaleLowerCase().includes(q))
    .sort((a, b) => b.degree - a.degree || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

/** Repeated focused queries grow one factual graph; selection never discards known edges. */
export function mergeAtlasNetworks(previous: AtlasNetwork, incoming: AtlasNetwork): AtlasNetwork {
  const nodes = new Map(previous.nodes.map(n => [n.key, n]));
  for (const node of incoming.nodes) nodes.set(node.key, node);
  const links = new Map(previous.links.map(l => [l.id, l]));
  for (const link of incoming.links) links.set(link.id, link);
  return { nodes: [...nodes.values()], links: [...links.values()], truncated: false, status: incoming.status };
}
