/** Side-effect-free production routing policy. Provider failures are observations, not permission to resend. */
export interface ModelTraffic { completed: number; received: number; unknown: number; failed: number }
export const EMPTY_TRAFFIC: ModelTraffic = { completed: 0, received: 0, unknown: 0, failed: 0 };
export function modelCircuitOpen(s: ModelTraffic): boolean {
  const attempts = s.completed + s.received + s.unknown + s.failed;
  // A single failure is noise. Persistent uncertainty is not.
  return attempts >= 8 && (s.unknown + s.failed) / attempts >= 0.30;
}
export function trafficFailureRate(s: ModelTraffic): number {
  const attempts = s.completed + s.received + s.unknown + s.failed;
  return attempts ? (s.unknown + s.failed) / attempts : 0;
}


/** Bayesian smoothed risk prevents an unobserved model scoring better than 35 known successes. */
export function conservativeFailureRisk(s:ModelTraffic):number {
  const attempts=s.completed+s.received+s.unknown+s.failed;
  return (s.unknown+s.failed+1)/(attempts+4);
}

/** New paid probe identity per minute; never reuse a cached previous-minute result. */
export function probeAttemptTag(at:Date):string { return at.toISOString().slice(0,16); }
