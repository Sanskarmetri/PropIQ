/**
 * Heading and footnote for one analytics chart.
 *
 * The card surface itself is supplied by the caller, which wraps this in a
 * `Reveal` carrying the `analytics-card` class, so the panel animates in and the
 * chart is never nested inside a second padded card.
 *
 * Charts are drawn as plain SVG so the dashboard keeps the PropIQ look without a
 * charting dependency, and each one renders its own numbers as a visually hidden
 * table, because a picture is not an accessible answer on its own.
 */
export function ChartCard({ eyebrow, title, note, meta, children }) {
  return (
    <>
      <div className="dashboard-card-heading">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
        </div>
        {meta ? <span className="select-like">{meta}</span> : null}
      </div>
      {children}
      {note ? <p className="analytics-card-note">{note}</p> : null}
    </>
  );
}

/**
 * The same figures as the chart, as a real table. Visually hidden by default and
 * revealed when the reader is asked to show it.
 */
export function ChartDataTable({ caption, columns, rows }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.label}</th>
            {row.values.map((value, index) => (
              <td key={`${row.key}-${columns[index + 1]}`}>{value}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ChartEmptyState({ children = 'No data for this filter yet.' }) {
  return (
    <p className="analytics-chart-empty" role="status">
      {children}
    </p>
  );
}
