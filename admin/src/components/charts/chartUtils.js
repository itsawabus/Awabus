import { useEffect, useRef, useState } from 'react';

/** Width of an element, kept up to date as it resizes. */
export function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Round axis ticks: 0 / 5 / 10 ..., never more than ~5 of them. */
export function niceTicks(max, count = 4) {
  if (!max || max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export const fmtNumber = (n) => {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString('en-US');
};

export const fmtPct = (n) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(n % 1 ? 1 : 0)}%`);

export const fmtDay = (day, opts = { day: 'numeric', month: 'short' }) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });

/** SVG path for a bar with rounded corners only at its data end. */
export function barPath(x, y, w, h, { r = 4, end = 'top' } = {}) {
  if (w <= 0 || h <= 0) return '';
  const rr = Math.min(r, end === 'top' ? w / 2 : h / 2, end === 'top' ? h : w);
  if (end === 'top') {
    return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
  }
  // rounded on the right (horizontal bars grow left -> right)
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}
