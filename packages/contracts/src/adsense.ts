/** AdSense site ownership verification without loading ad-serving scripts.
 * Only activate with an explicit opt-in AND a real Google publisher ID.
 */
export const ADSENSE_ID_PATTERN = /^ca-pub-[0-9]{16}$/;
export const ADSENSE_SELLER_ID = "f08c47fec0942fa0";

export function adsenseVerificationId(env: { ADSENSE_VERIFICATION_ENABLED?: string; ADSENSE_PUBLISHER_ID?: string }): string | null {
  if (env.ADSENSE_VERIFICATION_ENABLED !== "true") return null;
  const id = env.ADSENSE_PUBLISHER_ID?.trim() ?? "";
  return ADSENSE_ID_PATTERN.test(id) ? id : null;
}

export function adsenseTxt(id: string): string {
  if (!ADSENSE_ID_PATTERN.test(id)) throw new Error("Invalid AdSense publisher ID");
  return `google.com, ${id.slice(3)}, DIRECT, ${ADSENSE_SELLER_ID}\n`;
}
