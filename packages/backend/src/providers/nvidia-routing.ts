/** Side-effect-free production routing policy. Provider failures are observations, not permission to resend. */
export interface ModelTraffic { completed: number; received: number; unknown: number; failed: number }
export const EMPTY_TRAFFIC: ModelTraffic = { completed: 0, received: 0, unknown: 0, failed: 0 };
export const VERIFIED_FALLBACKS = [
  "openai/gpt-oss-20b",
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "z-ai/glm-5.3-flash",
] as const;
export function modelCircuitOpen(s: ModelTraffic): boolean {
  const attempts = s.completed + s.received + s.unknown + s.failed;
  // A single failure is noise. Persistent uncertainty is not.
  return attempts >= 8 && (s.unknown + s.failed) / attempts >= 0.30;
}
export function trafficFailureRate(s: ModelTraffic): number {
  const attempts = s.completed + s.received + s.unknown + s.failed;
  return attempts ? (s.unknown + s.failed) / attempts : 0;
}
export function eligibleFallback(model: string, wanted: string): boolean {
  return model === wanted || VERIFIED_FALLBACKS.some(approved => model === approved);
}

/** Bayesian smoothed risk prevents an unobserved model scoring better than 35 known successes. */
export function conservativeFailureRisk(s:ModelTraffic):number {
  const attempts=s.completed+s.received+s.unknown+s.failed;
  return (s.unknown+s.failed+1)/(attempts+4);
}
