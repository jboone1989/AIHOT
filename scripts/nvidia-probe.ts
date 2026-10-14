// Read-only smoke test of an NVIDIA Developer Program endpoint.
// Secrets come only from the backend environment. Never print them or model output.
const base = (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
const apiKey = process.env.NVIDIA_API_KEY;
if (!apiKey) { console.error("NVIDIA_API_KEY is not configured"); process.exit(2); }
const headers = { authorization: `Bearer ${apiKey}`, accept: "application/json" };
const ids = ["openai/gpt-oss-20b", "z-ai/glm-5.3-flash", "google/gemma-4-31b-it", "nvidia/nemotron-3-super-120b-a12b", "nvidia/nemotron-3.5-lightning-30b-a3b", "mistralai/mistral-nemotron"];
const probe = process.argv.slice(2).length ? process.argv.slice(2) : ids.slice(0, 2);
async function request(path: string, body?: Record<string, unknown>) {
  const res = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { ...headers, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(33000),
  });
  const data = await res.json().catch(() => ({})) as Record<string, any>;
  return { status: res.status, data };
}
try {
  const list = await request("/models");
  const available: string[] = Array.isArray(list.data.data) ? list.data.data.map((item: { id?: string }) => item.id || "") : [];
  console.log(JSON.stringify({ step: "catalog", http: list.status, count: available.length, available: ids.filter(id => available.includes(id)) }));
  if (list.status !== 200) process.exit(2);
  for (const model of probe) {
    if (!available.includes(model)) continue;
    try {
    const result = await request("/chat/completions", {
      model, messages: [{ role: "user", content: "Return exactly one JSON object: {\"label\":\"PASS\",\"reason\":\"clear\"}." }],
      temperature: 0, max_tokens: 600, stream: false,
    });
    const choice = result.data.choices?.[0];
    const content = choice?.message?.content || "";
    let parsed = false;
    try { const a = JSON.parse(content); parsed = a?.label === "PASS"; }
    catch { parsed = /"label"\s*:\s*"PASS"/.test(content); }
    console.log(JSON.stringify({
      step: "chat", model, http: result.status,
      responded: content.length > 0, parsed,
      finish: choice?.finish_reason || null,
      usage: result.data.usage ? {
        prompt_tokens: result.data.usage.prompt_tokens,
        completion_tokens: result.data.usage.completion_tokens,
      } : null,
      provider_error_code: result.data.error?.code || null,
    }));
    } catch (error) {
      console.log(JSON.stringify({ step: "chat", model, error: (error as Error).name }));
    }
  }
} catch (error) {
  console.error(JSON.stringify({ step: "network", type: (error as Error).name, message: (error as Error).message }));
  process.exitCode = 1;
}
