/** Tiny trend line for tiles and table rows; the last point is marked. */
export default function Sparkline({ values = [], width = 96, height = 28, label }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const x = (i) => 2 + (values.length > 1 ? (i / (values.length - 1)) * (width - 6) : 0);
  const y = (v) => height - 3 - (v / max) * (height - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = values.length - 1;
  return (
    <svg width={width} height={height} role="img" aria-label={label} className="viz overflow-visible">
      <path d={d} fill="none" stroke="var(--viz-accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
      <circle cx={x(last)} cy={y(values[last])} r="2.5" fill="var(--viz-accent)" />
    </svg>
  );
}
