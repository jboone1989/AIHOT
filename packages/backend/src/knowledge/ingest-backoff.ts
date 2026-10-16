/** Per-article exponential retry delay. Avoid retrying one slow Graphiti episode every tick. */
export function graphitiRetryDelayMs(failures: number): number {
  const n = Number.isFinite(failures) ? Math.max(1, Math.min(6, Math.floor(failures))) : 1;
  return Math.min(360, 15 * 2 ** (n - 1)) * 60_000;
}
