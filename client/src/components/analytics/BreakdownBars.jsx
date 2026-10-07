import { ChartDataTable, ChartEmptyState } from './ChartCard.jsx';
import { formatNullableCurrency, formatNullableNumber, formatNumber } from '../../utils/formatters.js';

/**
 * Horizontal bar breakdown, used for city, locality and property type.
 *
 * Bars are sized against the largest row rather than a fixed scale, and every
 * row states its own count, share and average asking price, so the bar is a
 * summary of numbers that are already written out.
 */
export function BreakdownBars({ rows, labelKey, secondaryKey, valueLabel = 'Listings', max }) {
  if (!rows || rows.length === 0) {
    return <ChartEmptyState>No listings match these filters, so this breakdown is empty.</ChartEmptyState>;
  }

  const largest = max ?? Math.max(...rows.map((row) => row.listings));

  return (
    <>
      <ul className="analytics-bars">
        {rows.map((row) => {
          const width = largest > 0 ? Math.max((row.listings / largest) * 100, 2) : 0;

          return (
            <li key={`${row[labelKey]}-${row[secondaryKey] ?? ''}`}>
              <div className="analytics-bar-heading">
                <span className="analytics-bar-label">{row[labelKey]}</span>
                {secondaryKey ? <span className="analytics-bar-secondary">{row[secondaryKey]}</span> : null}
                <span className="analytics-bar-value">
                  {formatNumber(row.listings)} {valueLabel.toLowerCase()}
                  {row.sharePercentage !== null ? ` · ${row.sharePercentage}%` : ''}
                </span>
              </div>
              <span className="analytics-bar-track">
                <span className="analytics-bar-fill" style={{ width: `${width}%` }} />
              </span>
              <span className="analytics-bar-meta">
                Average asking price {formatNullableCurrency(row.averageAskingPrice)} ·{' '}
                {formatNullableNumber(row.averagePricePerSqFt)} per sq.ft.
              </span>
            </li>
          );
        })}
      </ul>

      <ChartDataTable
        caption={`${valueLabel} by ${labelKey}`}
        columns={[valueLabel, 'Share', 'Average asking price', 'Average per sq.ft.']}
        rows={rows.map((row) => ({
          key: `${row[labelKey]}-${row[secondaryKey] ?? ''}`,
          label: secondaryKey ? `${row[labelKey]}, ${row[secondaryKey]}` : row[labelKey],
          values: [
            formatNumber(row.listings),
            `${row.sharePercentage}%`,
            formatNullableCurrency(row.averageAskingPrice),
            formatNullableNumber(row.averagePricePerSqFt),
          ],
        }))}
      />
    </>
  );
}
