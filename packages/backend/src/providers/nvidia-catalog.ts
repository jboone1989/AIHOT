/** Live NVIDIA catalogue is an inventory, not a list of interchangeable chat endpoints.
 * Unknown models are retained for inspection, but never sent speculative requests. */
export const NVIDIA_CAPABILITIES = ["text", "vision", "embedding", "rerank", "image", "document", "audio", "safety", "unknown"] as const;
export type NvidiaCapability = typeof NVIDIA_CAPABILITIES[number];
export interface NvidiaCatalogEntry {
  id?: string;
  type?: string;
  task?: string;
  capabilities?: string[] | Record<string, unknown>;
}
const safeId = /^[a-z0-9._-]+\/[a-z0-9._-]+$/i;
export function nvidiaCapability(entry: string | NvidiaCatalogEntry): NvidiaCapability {
  const item = typeof entry === "string" ? { id: entry } : entry;
  const id = (item.id ?? "").toLowerCase();
  if (!safeId.test(id)) return "unknown";
  const flags = Array.isArray(item.capabilities) ? item.capabilities.join(" ") : JSON.stringify(item.capabilities ?? {});
  const tag = [item.task ?? "", item.type ?? "", flags].join(" ").toLowerCase();
  const s = id + " " + tag;
  if (/safety|moderation|guard|shield|content.filter|reward.model/.test(s)) return "safety";
  if (/rerank|re-rank|retriev.*rank|ranking.model/.test(s)) return "rerank";
  if (/embed|text.embedding|vector.representation/.test(s)) return "embedding";
  if (/speech|audio|asr|tts|transcri|whisper|parakeet|canary|diariz/.test(s)) return "audio";
  if (/ocr|document|table.extract|layout.detect|paddleocr|nv-yolo/.test(s)) return "document";
  if (/diffusion|image.generation|text.to.image|flux|stable-diffusion|sana-|edify/.test(s)) return "image";
  if (/vision|multimodal|image.understanding|visual.question|image.to.text|\bvl\b|[-/]vl[-/]|-vl-|omni/.test(s) ||
      id === "z-ai/glm-5.3-flash") return "vision";
  if (/chat|completion|language.model|text.generation|text-generation/.test(tag) ||
      /gpt|nemotron|glm|gemma|llama|deepseek|mistral|qwen|kimi|granite|phi-|command-|olmo|yi-|internlm|falcon|starcoder|coder/.test(id)) return "text";
  return "unknown";
}
export function nvidiaInventory(items: NvidiaCatalogEntry[]): Record<NvidiaCapability, string[]> {
  const pools = Object.fromEntries(NVIDIA_CAPABILITIES.map(k=>[k,[]])) as unknown as Record<NvidiaCapability,string[]>;
  for (const item of items) {
    const id=item.id ?? "";
    const kind=nvidiaCapability(item);
    if (id && !pools[kind].includes(id)) pools[kind].push(id);
  }
  for (const ids of Object.values(pools)) ids.sort();
  return pools;
}
