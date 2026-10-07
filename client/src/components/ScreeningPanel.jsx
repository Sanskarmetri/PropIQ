import { Check, CircleAlert, Loader2, ShieldCheck } from 'lucide-react';
import { SCREENING_RULE_ICON, SCREENING_RULE_MATTERS, SCREENING_STATUS_LABEL, screeningFact } from '../utils/screening.js';

/**
 * Deterministic listing screening for a single property. Loading and failure are
 * handled here so a screening problem never hides the listing or the estimate.
 */
export function ScreeningPanel({ screening }) {
  return (
    <div className="screening-panel">
      <div className="screening-panel-header">
        <div>
          <p className="eyebrow">PropIQ screening</p>
          <h3>Listing integrity checks</h3>
        </div>
        {screening.status === 'ready' ? (
          <span className={`screening-badge screening-badge-${screening.data.status}`}>
            {screening.data.status === 'clear' ? <Check size={14} /> : <CircleAlert size={14} />}
            {SCREENING_STATUS_LABEL[screening.data.status]}
          </span>
        ) : null}
      </div>

      {screening.status === 'loading' ? (
        <div className="screening-panel-note">
          <Loader2 size={15} className="spin" />
          <span>Running the deterministic listing checks…</span>
        </div>
      ) : null}

      {screening.status === 'unavailable' ? (
        <div className="screening-panel-note">
          <CircleAlert size={15} />
          <span>Screening could not run for this listing. {screening.message}</span>
        </div>
      ) : null}

      {screening.status === 'ready' ? (
        <>
          <p className="screening-summary">{screening.data.summary}</p>

          <div className="screening-rules">
            {screening.data.flags.map((flag) => {
              const Icon = SCREENING_RULE_ICON[flag.type] ?? ShieldCheck;
              return (
                <div className={`screening-rule screening-rule-${flag.triggered ? 'flagged' : 'clear'}`} key={flag.type}>
                  <div className="screening-rule-top">
                    <span className="screening-rule-name">
                      <Icon size={15} />
                      {flag.title}
                    </span>
                    <span className="screening-rule-state">
                      {!flag.evaluated ? 'Skipped' : flag.triggered ? 'Flagged' : 'Passed'}
                    </span>
                  </div>
                  <p className="screening-rule-message">{flag.message}</p>
                  <p className="screening-rule-fact">{screeningFact(flag)}</p>
                  {flag.triggered ? <p className="screening-rule-matter">{SCREENING_RULE_MATTERS[flag.type]}</p> : null}
                </div>
              );
            })}
          </div>

          {screening.data.partial ? (
            <p className="screening-panel-note screening-panel-note-inline">
              <CircleAlert size={15} />
              <span>Partial result: some checks could not run for this listing.</span>
            </p>
          ) : null}

          <p className="screening-disclaimer">{screening.data.disclaimer}</p>

          {screening.data.limitations?.length ? (
            <details className="screening-limitations">
              <summary>What this screening cannot tell you</summary>
              <ul>
                {screening.data.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
