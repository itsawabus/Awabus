import { useState } from 'react';
import { fmtDay, fmtNumber, niceTicks, useWidth } from './chartUtils.js';
import { Tooltip, TipRow } from './ChartParts.jsx';

const PAD = { top: 16, right: 44, bottom: 24, left: 40 };

/** A single series over time: 2px line, 10% area wash, labelled end point, crosshair hover. */
export default function AreaTrend({ data, valueKey, label, height = 220, ariaLabel, extra }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const plotW = Math.max(width - PAD.left - PAD.right, 0);
  const plotH = height - PAD.top - PAD.bottom;
  const vals = data.map((d) => d[valueKey]);
  const ticks = niceTicks(Math.max(...vals, 0));
  const top = ticks[ticks.length - 1] || 1;
  const x = (i) => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);
  const y = (v) => PAD.top + plotH - (v / top) * plotH;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[valueKey])}`).join('');
  const area = `${line}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const last = data.length - 1;

  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left - PAD.left;
    const i = Math.round((px / plotW) * (data.length - 1));
    setHover(Math.min(Math.max(i, 0), last));
  };

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && data.length > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} onMouseMove={onMove}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--viz-ink-3)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmtNumber(t)}
              </text>
            </g>
          ))}
          <path d={area} fill="var(--viz-accent)" opacity="0.1" />
          <path d={line} fill="none" stroke="var(--viz-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) =>
            i % Math.max(1, Math.ceil(data.length / Math.max(Math.floor(plotW / 70), 1))) === 0 ? (
              <text key={d.week} x={x(i)} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--viz-ink-3)">
                {fmtDay(d.week)}
              </text>
            ) : null
          )}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} stroke="var(--viz-ink-3)" strokeWidth="1" />
          )}
          {[hover ?? last].map((i) => (
            <circle key={i} cx={x(i)} cy={y(data[i][valueKey])} r="4.5" fill="var(--viz-accent)" stroke="var(--viz-surface)" strokeWidth="2" />
          ))}
          <text x={x(last) + 8} y={y(data[last][valueKey])} dy="0.32em" fontSize="12" fontWeight="700" fill="var(--viz-ink)">
            {fmtNumber(data[last][valueKey])}
          </text>
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={x(hover)} y={PAD.top} width={width}>
          <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">Week of {fmtDay(data[hover].week)}</p>
          <TipRow color="var(--viz-accent)" value={fmtNumber(data[hover][valueKey])} label={label} />
          {extra?.(data[hover])}
        </Tooltip>
      )}
    </div>
  );
}
