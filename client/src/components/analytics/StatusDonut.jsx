import { ChartDataTable, ChartEmptyState } from './ChartCard.jsx';
import { formatNumber } from '../../utils/formatters.js';

/* -------------------------------------------------------------------------- */
/* Palette                                                                     */
/* -------------------------------------------------------------------------- */

// Each slice is coloured with a CSS custom property defined in `analytics.css`,
// so the chart follows the PropIQ palette instead of hard-coded hex values.
const SLICE_COLOURS = {
  active: 'var(--analytics-active)',
  sold: 'var(--analytics-sold)',
  inactive: 'var(--analytics-inactive)',
};

const SLICE_LABELS = {
  active: 'Active',
  sold: 'Sold',
  inactive: 'Inactive',
};

const RADIUS = 54;
const STROKE = 18;

const polarToCartesian = (percent, radius) => {
  const angle = (percent / 100) * 360 - 90;
  const radians = (angle * Math.PI) / 180;
  return { x: 60 + radius * Math.cos(radians), y: 60 + radius * Math.sin(radians) };
};

/**
 * Donut of the listing status split.
 *
 * The arcs are real SVG paths built from the server's listing counts, and the
 * segments are also listed as text underneath so the split never depends on
 * being able to see the graphic.
 */
export function StatusDonut({ breakdown, total }) {
  const rows = (breakdown?.breakdown ?? []).filter((row) => row.listings > 0);

  if (total === 0 || rows.length === 0) {
    return <ChartEmptyState>No listings match these filters, so there is no status split to draw.</ChartEmptyState>;
  }

  let offset = 0;
  const segments = rows.map((row) => {
    const percent = (row.listings / total) * 100;
    const start = polarToCartesian(offset, RADIUS);
    const end = polarToCartesian(offset + percent, RADIUS);
    const largeArc = percent > 50 ? 1 : 0;
    offset += percent;

    return {
      ...row,
      percent: Math.round(percent * 10) / 10,
      path: [
        `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
        `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
      ].join(' '),
    };
  });

  return (
    <>
      <div className="analytics-donut-wrap">
        <svg
          className="analytics-donut"
          viewBox="0 0 120 120"
          role="img"
          aria-label={`Listing status split: ${segments
            .map((segment) => `${segment.status} ${segment.listings}`)
            .join(', ')}`}
        >
          <circle className="analytics-donut-track" cx="60" cy="60" r={RADIUS} strokeWidth={STROKE} />
          {segments.map((segment) => (
            <path
              key={segment.status}
              d={`${segment.path} L 60 60 Z`}
              fill={SLICE_COLOURS[segment.status] ?? 'var(--analytics-inactive)'}
            />
          ))}
          <text className="analytics-donut-value" x="60" y="58" textAnchor="middle">
            {formatNumber(total)}
          </text>
          <text className="analytics-donut-label" x="60" y="72" textAnchor="middle">
            listings
          </text>
        </svg>

        <ul className="analytics-legend">
          {segments.map((segment) => (
            <li key={segment.status}>
              <span className="legend-dot" style={{ background: SLICE_COLOURS[segment.status] }} aria-hidden="true" />
              <span className="analytics-legend-name">{SLICE_LABELS[segment.status] ?? segment.status}</span>
              <strong>{formatNumber(segment.listings)}</strong>
              <span className="analytics-legend-share">{segment.percent}%</span>
            </li>
          ))}
        </ul>
      </div>

      <ChartDataTable
        caption="Listing status split"
        columns={['Status', 'Listings', 'Share']}
        rows={segments.map((segment) => ({
          key: segment.status,
          label: SLICE_LABELS[segment.status] ?? segment.status,
          values: [formatNumber(segment.listings), `${segment.percent}%`],
        }))}
      />
    </>
  );
}
