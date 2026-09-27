import { useState } from 'react';
import { useWidth } from './chartUtils.js';
import { Tooltip, TipRow } from './ChartParts.jsx';

const BAR = 14;
const GAP = 2;

/**
 * One 100% bar per row (e.g. each school's fleet split by status).
 * rows: [{ id, label, parts: { [key]: count } }], series: [{ key, label, color }]
 */
export default function StackedRows({ rows, series, highlightId, unit = '', onSelect, ariaLabel }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null); // { row, key }
  const compact = width > 0 && width < 480; // names above the bars on phones
  const ROW = compact ? 44 : 34;
  const labelW = compact ? 0 : Math.min(170, Math.max(96, width * 0.32));
  const totalW = 76;
  const plotW = Math.max(width - labelW - totalW, 10);

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={rows.length * ROW} role="img" aria-label={ariaLabel}>
          {rows.map((r, i) => {
            const cy = compact ? i * ROW + 30 : i * ROW + ROW / 2;
            const total = series.reduce((n, s) => n + (r.parts[s.key] || 0), 0);
            const shown = series.filter((s) => r.parts[s.key]);
            let x = labelW;
            const faded = highlightId && highlightId !== r.id;
            return (
              <g key={r.id} opacity={faded ? 0.4 : 1} onClick={() => onSelect?.(r)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
                <text
                  x={compact ? 0 : labelW - 10}
                  y={compact ? i * ROW + 12 : cy}
                  dy="0.32em"
                  textAnchor={compact ? 'start' : 'end'}
                  fontSize="12"
                  fill="var(--viz-ink-2)"
                  fontWeight={highlightId === r.id ? 700 : 500}
                >
                  {compact || r.label.length <= 22 ? r.label : `${r.label.slice(0, 21)}…`}
                </text>
                {total === 0 && <rect x={labelW} y={cy - BAR / 2} width={plotW} height={BAR} rx={4} fill="var(--viz-grid)" />}
                {shown.map((s, j) => {
                  const w = (r.parts[s.key] / total) * plotW;
                  const segX = x + (j > 0 ? GAP / 2 : 0);
                  const segW = Math.max(w - (j > 0 ? GAP / 2 : 0) - (j < shown.length - 1 ? GAP / 2 : 0), 1);
                  x += w;
                  const first = j === 0;
                  const last = j === shown.length - 1;
                  return (
                    <rect
                      key={s.key}
                      x={segX}
                      y={cy - BAR / 2}
                      width={segW}
                      height={BAR}
                      rx={first || last ? 4 : 0}
                      fill={s.color}
                      stroke={hover?.row === i && hover?.key === s.key ? 'var(--viz-ink)' : 'none'}
                      strokeWidth="1.5"
                      tabIndex={0}
                      aria-label={`${r.label}, ${s.label}: ${r.parts[s.key]} of ${total}`}
                      onMouseMove={() => setHover({ row: i, key: s.key })}
                      onFocus={() => setHover({ row: i, key: s.key })}
                      onBlur={() => setHover(null)}
                      style={{ outline: 'none' }}
                    />
                  );
                })}
                <text x={width - 4} y={cy} dy="0.32em" textAnchor="end" fontSize="12" fontWeight="600" fill="var(--viz-ink-2)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {total.toLocaleString('en-US')}{unit && ` ${unit}`}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover && rows[hover.row] && (() => {
        const r = rows[hover.row];
        const total = series.reduce((n, s) => n + (r.parts[s.key] || 0), 0);
        return (
          <Tooltip x={labelW + 20} y={hover.row * ROW + ROW} width={width}>
            <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{r.label}</p>
            {series.map((s) => (
              <TipRow
                key={s.key}
                color={s.color}
                value={`${r.parts[s.key] || 0} (${total ? Math.round(((r.parts[s.key] || 0) / total) * 100) : 0}%)`}
                label={s.label}
              />
            ))}
          </Tooltip>
        );
      })()}
    </div>
  );
}
