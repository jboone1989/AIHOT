export type Report<T> = {
  state: "unconfigured" | "ready" | "empty" | "error";
  data: T | null;
  refreshedAt: string | null;
  message?: string;
};

// Each provider owns one bounded cache; failed reads must not turn into zero-valued metrics.
export function cachedReport<T>() {
  let cache: { key: string; expires: number; report: Report<T> } | undefined;
  return async (key: string, load: () => Promise<T>, empty: (data: T) => boolean): Promise<Report<T>> => {
    if (cache?.key === key && cache.expires > Date.now()) return cache.report;
    let report: Report<T>;
    try {
      const data = await load();
      report = { state: empty(data) ? "empty" : "ready", data, refreshedAt: new Date().toISOString() };
    } catch (error) {
      // Upstream response bodies may contain credentials or private account details.
      report = { state: "error", data: null, refreshedAt: null,
        message: error instanceof ProviderError ? error.message : "读取失败，请检查服务端凭据与平台权限。" };
    }
    cache = { key, expires: Date.now() + (report.state === "error" ? 60000 : 300000), report };
    return report;
  };
}

export class ProviderError extends Error {}

export async function providerJson<T>(provider: string, url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new ProviderError(`${provider} HTTP ${response.status}，请检查只读授权和 API 配置。`);
  return response.json() as Promise<T>;
}
