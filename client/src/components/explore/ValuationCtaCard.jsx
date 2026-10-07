import { ArrowRight, Calculator } from 'lucide-react';
import { ButtonLink } from '../Button.jsx';
import { BentoShell } from './BentoShell.jsx';

/**
 * The one dark tile in the composition: the route into the valuation engine,
 * sized to the listings the API just reported.
 */
export function ValuationCtaCard({ total, delay = 0 }) {
  return (
    <BentoShell className="bento-cta" delay={delay} aria-label="Valuation">
      <span className="cta-icon" aria-hidden="true">
        <Calculator size={19} />
      </span>
      <p className="bento-kicker">Valuation</p>
      <h3 className="bento-title">Find out what it is really worth.</h3>
      <p className="cta-copy">
        {total
          ? `Run a PropIQ estimate against any of the ${total} stored listings.`
          : 'Run a PropIQ estimate against any listing in the catalogue.'}{' '}
        The number is derived on request and never stored.
      </p>
      <ButtonLink to="/valuation" variant="dark" className="cta-button">
        Value a property <ArrowRight size={16} />
      </ButtonLink>
    </BentoShell>
  );
}

export default ValuationCtaCard;
