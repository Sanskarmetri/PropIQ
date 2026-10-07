import { BentoShell } from './BentoShell.jsx';
import { formatNumber } from '../../utils/formatters.js';

const METRICS = [
  { key: 'total', label: 'Listings', note: 'All stored' },
  { key: 'active', label: 'Active', note: 'On the market' },
  { key: 'sold', label: 'Sold', note: 'Completed' },
  { key: 'inactive', label: 'Inactive', note: 'Off the market' },
];

const SHARE_CLASS = { active: 'snapshot-share-active', sold: 'snapshot-share-sold', inactive: 'snapshot-share-inactive' };
const STATUS_LABEL = { active: 'Active', sold: 'Sold', inactive: 'Inactive' };

/**
 * The four status totals, each one a `pagination.total` returned by the
 * listings API rather than a number held in the client. A failed request shows
 * a dash instead of a zero, because a zero here would read as a measurement.
 */
export function MarketSnapshotCard({ snapshot, delay = 0 }) {
  const { status, counts, total } = snapshot;
  const values = counts ? { ...counts, total } : null;
  const ready = status === 'ready' && values;

  return (
    <BentoShell className="bento-snapshot" delay={delay} aria-label="Market snapshot">
      <div className="bento-head">
        <p className="bento-kicker">Market snapshot</p>
        <h3 className="bento-title">The catalogue in four numbers.</h3>
      </div>

      <dl className="snapshot-grid">
        {METRICS.map((metric) => (
          <div className="snapshot-cell" key={metric.key}>
            <dt>{metric.label}</dt>
            <dd>{values ? formatNumber(values[metric.key]) : '—'}</dd>
            <span>{metric.note}</span>
          </div>
        ))}
      </dl>

      {ready && total > 0 && (
        <div className="snapshot-share" aria-hidden="true">
          {['active', 'sold', 'inactive'].map((key) => (
            <span key={key} className={SHARE_CLASS[key]} style={{ flexGrow: counts[key] }} />
          ))}
        </div>
      )}

      {ready && total > 0 && (
        <ul className="snapshot-legend">
          {['active', 'sold', 'inactive'].map((key) => (
            <li key={key}>
              <span className={`snapshot-legend-dot ${SHARE_CLASS[key]}`} aria-hidden="true" />
              <span>{STATUS_LABEL[key]}</span>
              <strong>{Math.round((counts[key] / total) * 100)}%</strong>
            </li>
          ))}
        </ul>
      )}

      <p className="bento-note">
        {status === 'error'
          ? `Counts unavailable right now${snapshot.message ? ` (${snapshot.message})` : ''}.`
          : 'Totals read from the listing API on every visit.'}
      </p>
    </BentoShell>
  );
}

export default MarketSnapshotCard;
