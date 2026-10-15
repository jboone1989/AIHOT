import { SITE } from "../site.ts";

/** Unique LivingRuntime constellation mark, independent of the upstream engine's trademarks. */
export function NetworkMark({ className = "", spinning = false, size }: { className?: string; spinning?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 512 512" className={className} style={size ? { width: size, height: size } : undefined} aria-hidden="true" focusable="false">
      <rect width="512" height="512" rx="115" fill="#102b34" />
      <g style={spinning ? { transformOrigin: "256px 256px", animation: "spin-slow 1.1s linear infinite" } : undefined}>
        <g stroke="#63b0af" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M125 141 292 97 392 246 264 394 108 338 125 141" />
          <path d="M125 141 264 394 292 97" />
        </g>
        <circle cx="125" cy="141" r="23" fill="#a8f0d6" />
        <circle cx="292" cy="97" r="18" fill="#d3ffee" />
        <circle cx="392" cy="246" r="27" fill="#eab372" />
        <circle cx="264" cy="394" r="32" fill="#a2ead3" />
        <circle cx="108" cy="338" r="18" fill="#72cbc4" />
      </g>
    </svg>
  );
}

/** Stable public brand wordmark. Internal package names do not appear in the UI. */
export function Wordmark({ size = 24, className = "", title = SITE.name }: { size?: number; className?: string; title?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-extrabold leading-none tracking-[-0.035em] ${className}`} aria-label={title} role="img">
      <NetworkMark size={size} className="shrink-0 rounded-[6px]" />
      <span aria-hidden="true" style={{ fontSize: Math.round(size * 0.79) }}>{SITE.name}</span>
    </span>
  );
}

/** Keep compatibility with the existing skeleton and loading components. */
export function RingMark({ className = "", spinning = false }: { className?: string; spinning?: boolean }) {
  return <NetworkMark className={className} spinning={spinning} />;
}
