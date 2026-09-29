import { useState } from 'react';
import { barPath, fmtDay, fmtNumber, niceTicks, useWidth } from './chartUtils.js';
import { Tooltip, TipRow } from './ChartParts.jsx';

const PAD = { top: 8, right: 4, bottom: 24, left: 34 };
const GAP = 2; // surface gap between stacked segments

/**
 * Columns over time, each split into stacked parts (e.g. trip outcomes per day).
 * data: [{ day, [series.key]: number }], series: [{ key, label, color }]
 */
export default function StackedColumns({ data, series, height = 240, ariaLabel }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const plotW = Math.max(width - PAD.left - PAD.right, 0);
  const plotH = height - PAD.top - PAD.bottom;
  const totals = data.map((d) => series.reduce((n, s) => n + (d[s.key] || 0), 0));
  const ticks = niceTicks(Math.max(...totals, 0));
  const top = ticks[ticks.length - 1] || 1;
  const band = data.length ? plotW / data.length : 0;
  const colW = Math.max(Math.min(24, band * 0.72), 1);
  const y = (v) => PAD.top + plotH - (v / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(Math.floor(plotW / 64), 1)));

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--viz-ink-3)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmtNumber(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            let cum = 0;
            const segs = series
              .filter((s) => d[s.key])
              .map((s, j, arr) => {
                const h = (d[s.key] / top) * plotH;
                const yTop = PAD.top + plotH - cum - h;
                cum += h;
                const gap = j > 0 ? GAP : 0;
                const isTop = j === arr.length - 1;
                const hh = Math.max(h - gap, 0.5);
                return isTop ? (
                  <path key={s.key} d={barPath(cx - colW / 2, yTop, colW, hh)} fill={s.color} />
                ) : (
                  <rect key={s.key} x={cx - colW / 2} y={yTop} width={colW} height={hh} fill={s.color} />
                );
              });
            const faded = hover !== null && hover !== i;
            return (
              <g key={d.day} opacity={faded ? 0.45 : 1}>
                {segs}
                {/* hit area: the whole day's band, taller than the marks */}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  onMouseMove={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={data.length <= 31 ? 0 : -1}
                  aria-label={`${fmtDay(d.day)}: ${totals[i]} trips`}
                />
                {i % labelEvery === 0 && (
                  <text x={cx} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--viz-ink-3)">
                    {fmtDay(d.day)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={PAD.left + band * hover + band / 2} y={PAD.top} width={width}>
          <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">
            {fmtDay(data[hover].day, { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
          {[...series].reverse().map((s) => (
            <TipRow key={s.key} color={s.color} value={fmtNumber(data[hover][s.key] || 0)} label={s.label} />
          ))}
          <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-700">
            <TipRow value={fmtNumber(totals[hover])} label="trips in total" />
          </div>
        </Tooltip>
      )}
    </div>
  );
}
