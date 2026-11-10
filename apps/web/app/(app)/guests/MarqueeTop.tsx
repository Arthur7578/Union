import React, { useId } from "react";
import { M, alpha } from "@/lib/theme";

/**
 * The top of a Garden marquee page: the striped canopy and its scalloped
 * valance, a string of festoon lights under it, and the tent's shaded inside,
 * where the page's title sits. Edge to edge of the content area.
 */
export function MarqueeTop({ slim, children }: { slim?: boolean; children: React.ReactNode }) {
  return (
    <div className="mq-tent">
      <div className={slim ? "mq-canopy is-slim" : "mq-canopy"} aria-hidden />
      {!slim && <Festoon />}
      <div className="mq-tent-inner">{children}</div>
    </div>
  );
}

/** One swag of wire every 84px, two bulbs hanging from each. */
function Festoon() {
  const id = useId().replace(/:/g, "");
  const bulbs = [25.2, 58.8].map((x) => ({ x, y: 10.7 }));
  return (
    <svg className="mq-festoon" width="100%" height="30" aria-hidden focusable="false">
      <defs>
        <pattern id={`fe-${id}`} width="84" height="30" patternUnits="userSpaceOnUse">
          <path d="M0 4 Q42 20 84 4" stroke={alpha(M.ink, 0.35)} strokeWidth="1.5" fill="none" />
          {bulbs.map((b) => (
            <g key={b.x}>
              <rect x={b.x - 2} y={b.y - 1} width="4" height="4" rx="1" fill={M.ink2} />
              <circle cx={b.x} cy={b.y + 8} r="5" fill={M.maybe} />
              <circle cx={b.x - 1.5} cy={b.y + 6.5} r="1.6" fill={M.butter} />
            </g>
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="30" fill={`url(#fe-${id})`} />
    </svg>
  );
}

/** A short bunting strand: a drooping string carrying three pennants. */
export function Bunting() {
  return (
    <svg width="40" height="18" viewBox="0 0 40 18" aria-hidden focusable="false" style={{ flexShrink: 0 }}>
      <path d="M1 3 Q20 9 39 3" stroke={alpha(M.ink, 0.45)} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M4 4.1 L12 6.4 L7.2 15 Z" fill={M.leaf} />
      <path d="M15.6 6.9 L24.4 6.9 L20 16.5 Z" fill={M.maybe} />
      <path d="M28 6.4 L36 4.1 L32.8 15 Z" fill={M.cant} />
    </svg>
  );
}
