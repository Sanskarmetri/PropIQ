import { Building2, MapPinned } from 'lucide-react';
import { BentoShell } from './BentoShell.jsx';

/**
 * Where the catalogue actually sits: one row per city the API returned, plus
 * the locality count behind them.
 */
export function CityCoverageCard({ cityMix, localities, delay = 0 }) {
  return (
    <BentoShell className="bento-cities" delay={delay} aria-label="Location coverage">
      <div className="bento-head">
        <p className="bento-kicker">Location coverage</p>
        <h3 className="bento-title">Where the listings live.</h3>
      </div>

      {cityMix.length === 0 ? (
        <p className="bento-empty">Coverage arrives with the catalogue.</p>
      ) : (
        <ul className="coverage-list">
          {cityMix.map((entry) => (
            <li key={entry.key}>
              <span className="coverage-dot" aria-hidden="true" />
              <span className="coverage-city">{entry.label}</span>
              <span className="coverage-bar" aria-hidden="true">
                <span style={{ width: `${entry.share}%` }} />
              </span>
              <strong>{entry.count}</strong>
            </li>
          ))}
        </ul>
      )}

      <p className="bento-note bento-note-icons">
        {cityMix.length === 0 ? (
          'Coverage arrives with the catalogue.'
        ) : (
          <>
            <MapPinned size={14} /> {localities} {localities === 1 ? 'locality' : 'localities'}
            <Building2 size={14} /> {cityMix.length} {cityMix.length === 1 ? 'city' : 'cities'}
          </>
        )}
      </p>
    </BentoShell>
  );
}

export default CityCoverageCard;
