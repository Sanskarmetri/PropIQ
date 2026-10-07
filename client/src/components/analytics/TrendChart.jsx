import { ChartDataTable, ChartEmptyState } from './ChartCard.jsx';
import { formatNullableCurrency, formatNumber } from '../../utils/formatters.js';

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 120;
const PADDING = { top: 10, right: 6, bottom: 18, left: 26 };

const PLOT_WIDTH = VIEW_WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = VIEW_HEIGHT - PADDING.top - PADDING.bottom;

const monthLabel = (month) => {
  const [year, monthNumber] = month.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[Number(monthNumber) - 1] ?? monthNumber} ${year.slice(2)}`;
};

/**
 * Listing volume by month, drawn from the server's `createdAt` buckets.
 *
 * Only months that actually contain a listing are plotted: an empty month is a
 * gap in the data, not a zero, so the line is drawn straight across it rather
 * than dipping to the baseline. A single month is shown as a marker.
 */
export function TrendChart({ trend }) {
  const months = trend?.months ?? [];

  if (months.length === 0) {
    return <ChartEmptyState>No listings were created in this range, so there is no volume trend to draw.</ChartEmptyState>;
  }

  const highest = Math.max(...months.map((month) => month.listings));
  const step = months.length > 1 ? PLOT_WIDTH / (months.length - 1) : 0;

  const points = months.map((month, index) => ({
    ...month,
    x: PADDING.left + (months.length > 1 ? step * index : PLOT_WIDTH / 2),
    y: PADDING.top + PLOT_HEIGHT - (month.listings / highest) * PLOT_HEIGHT,
  }));

  const line = points.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' L ');
  const area = `M ${points[0].x.toFixed(2)} ${(PADDING.top + PLOT_HEIGHT).toFixed(2)} L ${line} L ${points.at(-1).x.toFixed(
    2,
  )} ${(PADDING.top + PLOT_HEIGHT).toFixed(2)} Z`;

  const gridLines = [0, 0.5, 1];

  return (
    <>
      <div className="analytics-trend-wrap">
        <svg
          className="analytics-trend"
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Listings created per month: ${months
            .map((month) => `${month.month} ${month.listings}`)
            .join(', ')}`}
        >
          {gridLines.map((fraction) => {
            const y = PADDING.top + PLOT_HEIGHT - PLOT_HEIGHT * fraction;
            return (
              <g key={fraction}>
                <line className="analytics-trend-grid" x1={PADDING.left} x2={VIEW_WIDTH - PADDING.right} y1={y} y2={y} />
                <text className="analytics-trend-axis" x={PADDING.left - 5} y={y + 3} textAnchor="end">
                  {Math.round(highest * fraction)}
                </text>
              </g>
            );
          })}

          <path className="analytics-trend-area" d={area} />
          <path className="analytics-trend-line" d={`M ${line}`} />

          {points.map((point) => (
            <circle key={point.month} className="analytics-trend-dot" cx={point.x} cy={point.y} r="2.4" />
          ))}
        </svg>

        <div className="analytics-trend-axis-row">
          <span>{monthLabel(months[0].month)}</span>
          {months.length > 2 ? <span>{monthLabel(months[Math.floor(months.length / 2)].month)}</span> : null}
          <span>{monthLabel(months.at(-1).month)}</span>
        </div>
      </div>

      <p className="analytics-trend-summary">
        <strong>{formatNumber(months.at(-1).listings)}</strong> listings created in {monthLabel(months.at(-1).month)}, the most
        recent month with new listings. Average asking price then {formatNullableCurrency(months.at(-1).averageAskingPrice)}.
      </p>

      <ChartDataTable
        caption="Listings created per month"
        columns={['Month', 'Listings', 'Average asking price']}
        rows={months.map((month) => ({
          key: month.month,
          label: monthLabel(month.month),
          values: [formatNumber(month.listings), formatNullableCurrency(month.averageAskingPrice)],
        }))}
      />
    </>
  );
}
