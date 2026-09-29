import { useState } from 'react';
import { barPath, niceTicks, useWidth } from './chartUtils.js';
import { Tooltip, TipRow } from './ChartParts.jsx';

const BAR = 16; // bar thickness (<= 24px)

/**
 * Horizontal bars, one per row (e.g. schools), sorted by the caller.
 * rows: [{ id, label, value, display, note }]. value null = no data.
 * highlightId: emphasise one row (accent) and grey the rest.
 * average: optional reference line, e.g. the platform average.
 */
export default function HBarChart({ rows, highlightId, average, format = (v) => v, onSelect, ariaLabel, maxValue }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  // On narrow screens each name goes above its bar instead of beside it.
  const compact = width > 0 && width < 480;
  const ROW = compact ? 44 : 34;
  const labelW = compact ? 12 : Math.min(170, Math.max(96, width * 0.32)); // 12px keeps the "0" tick on screen
  const valueW = 56;
  const plotW = Math.max(width - labelW - valueW, 10);
  const values = rows.map((r) => r.value).filter((v) => v !== null && v !== undefined);
  const ticks = niceTicks(Math.max(maxValue || 0, ...values, average || 0, 0));
  const top = ticks[ticks.length - 1] || 1;
  const x = (v) => labelW + (v / top) * plotW;
  const hasAvg = average !== null && average !== undefined;
  const TP = hasAvg ? 18 : 0; // room for the average label
  const height = rows.length * ROW + 22 + TP;

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <g transform={`translate(0,${TP})`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={0} y2={rows.length * ROW} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} />
              <text x={x(t)} y={height - TP - 4} textAnchor="middle" fontSize="11" fill="var(--viz-ink-3)">{format(t)}</text>
            </g>
          ))}
          {hasAvg && (
            <g pointerEvents="none">
              <line x1={x(average)} x2={x(average)} y1={-4} y2={rows.length * ROW} stroke="var(--viz-ink-3)" strokeWidth="1.5" />
              <text x={x(average)} y={-8} textAnchor={x(average) > width - 60 ? 'end' : 'middle'} fontSize="11" fontWeight="600" fill="var(--viz-ink-3)">
                Platform avg {format(average)}
              </text>
            </g>
          )}
          {rows.map((r, i) => {
            const cy = compact ? i * ROW + 30 : i * ROW + ROW / 2;
            const has = r.value !== null && r.value !== undefined;
            const color = highlightId && r.id !== highlightId ? 'var(--viz-quiet)' : 'var(--viz-accent)';
            const w = has ? Math.max(x(r.value) - labelW, r.value > 0 ? 2 : 0) : 0;
            return (
              <g
                key={r.id}
                onMouseMove={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => onSelect?.(r)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect?.(r)}
                tabIndex={0}
                role={onSelect ? 'button' : undefined}
                aria-label={`${r.label}: ${has ? r.display ?? format(r.value) : 'no data'}`}
                style={{ cursor: onSelect ? 'pointer' : 'default', outline: 'none' }}
              >
                <rect x={0} y={i * ROW} width={width} height={ROW} fill={hover === i ? 'var(--viz-grid)' : 'transparent'} opacity={0.5} rx={6} />
                <text
                  x={compact ? labelW : labelW - 10}
                  y={compact ? i * ROW + 12 : cy}
                  dy="0.32em"
                  textAnchor={compact ? 'start' : 'end'}
                  fontSize="12"
                  fill={highlightId === r.id ? 'var(--viz-ink)' : 'var(--viz-ink-2)'}
                  fontWeight={highlightId === r.id ? 700 : 500}
                >
                  {compact || r.label.length <= 22 ? r.label : `${r.label.slice(0, 21)}…`}
                </text>
                {has && w > 0 && <path d={barPath(labelW, cy - BAR / 2, w, BAR, { end: 'right' })} fill={color} />}
                <text x={labelW + w + 6} y={cy} dy="0.32em" fontSize="12" fontWeight="600" fill="var(--viz-ink-2)" stroke="var(--viz-surface)" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {has ? r.display ?? format(r.value) : 'No data'}
                </text>
              </g>
            );
          })}
          </g>
        </svg>
      )}
      {hover !== null && rows[hover] && (
        <Tooltip x={labelW + 20} y={hover * ROW + ROW + TP} width={width}>
          <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{rows[hover].label}</p>
          <TipRow color="var(--viz-accent)" value={rows[hover].value === null || rows[hover].value === undefined ? 'No data' : rows[hover].display ?? format(rows[hover].value)} label={rows[hover].note || ''} />
          {average !== null && average !== undefined && <TipRow value={format(average)} label="platform average" />}
          {onSelect && <p className="mt-1 text-slate-400">Click to focus on this school</p>}
        </Tooltip>
      )}
    </div>
  );
}
