/**
 * Olive sprigs drawn from numbers only, as SVG markup: the motif of the
 * wedding's stationery, shared by the welcome envelope and the guest hub.
 * Everything is `currentColor` except the olives, which take `berry`.
 */

type Point = { x: number; y: number; angle: number };

/** Points spread along a quadratic stem, with the stem's direction at each. */
function along(x0: number, y0: number, x1: number, y1: number, n: number, bend: number): Point[] {
  const cx = (x0 + x1) / 2 + bend;
  const cy = (y0 + y1) / 2 - bend;
  const points: Point[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 0.4);
    const u = 1 - t;
    points.push({
      x: u * u * x0 + 2 * u * t * cx + t * t * x1,
      y: u * u * y0 + 2 * u * t * cy + t * t * y1,
      angle: (Math.atan2(2 * u * (cy - y0) + 2 * t * (y1 - cy), 2 * u * (cx - x0) + 2 * t * (x1 - cx)) * 180) / Math.PI,
    });
  }
  return points;
}

/** Olive sprig: leaves placed along a curved stem. */
export function sprig(x0: number, y0: number, x1: number, y1: number, n: number, len: number, bend: number) {
  const cx = (x0 + x1) / 2 + bend;
  const cy = (y0 + y1) / 2 - bend;
  let s = `<path d="M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}" fill="none" stroke="currentColor" stroke-width="${len * 0.07}" stroke-linecap="round"/>`;
  along(x0, y0, x1, y1, n, bend).forEach(({ x, y, angle }, k) => {
    const t = (k + 1) / (n + 0.4);
    const side = (k + 1) % 2 ? 1 : -1;
    const l = len * (1 - t * 0.35);
    const a = angle + side * 42;
    s += `<ellipse cx="${l * 0.5}" cy="0" rx="${l * 0.5}" ry="${l * 0.16}" fill="currentColor" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(1)})"/>`;
  });
  return s;
}

/**
 * A line-drawn olive branch as on the invitation: outlined leaves along the
 * stem and a few olives hanging off it, filled with `berry` (a CSS colour,
 * usually a var()).
 */
export function oliveBranch(berry: string) {
  const [x0, y0, x1, y1, n, len, bend] = [8, 34, 152, 14, 9, 22, 10];
  const cx = (x0 + x1) / 2 + bend;
  const cy = (y0 + y1) / 2 - bend;
  let s = `<path d="M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>`;
  along(x0, y0, x1, y1, n, bend).forEach(({ x, y, angle }, k) => {
    const t = (k + 1) / (n + 0.4);
    const side = (k + 1) % 2 ? 1 : -1;
    const l = len * (1 - t * 0.4);
    const a = angle + side * 38;
    const at = `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(1)})`;
    s += `<path d="M0 0 Q${(l * 0.5).toFixed(1)} ${(-l * 0.2).toFixed(1)} ${l.toFixed(1)} 0 Q${(l * 0.5).toFixed(1)} ${(l * 0.2).toFixed(1)} 0 0Z M${(l * 0.15).toFixed(1)} 0 L${(l * 0.8).toFixed(1)} 0" fill="none" stroke="currentColor" stroke-width=".8" stroke-linejoin="round" transform="${at}"/>`;
    if (k === 1 || k === 4 || k === 6) {
      const r = 3.6 - k * 0.2;
      const bx = x + Math.cos(((angle - side * 70) * Math.PI) / 180) * 7;
      const by = y + Math.sin(((angle - side * 70) * Math.PI) / 180) * 7;
      s += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} L${bx.toFixed(1)} ${by.toFixed(1)}" stroke="currentColor" stroke-width=".7"/>`;
      s += `<ellipse cx="${bx.toFixed(1)}" cy="${(by + r * 0.6).toFixed(1)}" rx="${(r * 0.85).toFixed(1)}" ry="${r.toFixed(1)}" fill="${berry}" stroke="currentColor" stroke-width=".6"/>`;
    }
  });
  return s;
}
