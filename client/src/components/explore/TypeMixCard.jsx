import { BentoShell } from './BentoShell.jsx';

/**
 * How the live catalogue splits across property types, counted from the
 * listings the API returned.
 */
export function TypeMixCard({ typeMix, total, delay = 0 }) {
  return (
    <BentoShell className="bento-types" delay={delay} aria-label="Property type distribution">
      <div className="bento-head">
        <p className="bento-kicker">Property type</p>
        <h3 className="bento-title">What the market is made of.</h3>
      </div>

      {typeMix.length === 0 ? (
        <p className="bento-empty">Type counts arrive with the catalogue.</p>
      ) : (
        <ul className="mix-bars">
          {typeMix.map((entry) => (
            <li key={entry.key}>
              <div className="mix-bar-head">
                <span>{entry.label}</span>
                <strong>{entry.count}</strong>
              </div>
              <span className="mix-bar-track">
                <span className="mix-bar-fill" style={{ width: `${entry.share}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="bento-note">
        {total ? `Counted across ${total} listings.` : 'Counted from the live catalogue.'}
      </p>
    </BentoShell>
  );
}

export default TypeMixCard;
