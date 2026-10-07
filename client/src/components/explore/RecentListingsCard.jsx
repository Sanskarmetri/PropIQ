import { ArrowUpRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BentoShell } from './BentoShell.jsx';
import { morphPropertyToDetail } from '../../utils/propertyMorph.js';
import { formatCompactCurrency, formatPropertyAge, formatPropertyType } from '../../utils/formatters.js';
import { fallbackPropertyImage } from '../../data/properties.js';

/**
 * The newest listings in the catalogue, ordered by the `createdAt` the API
 * sorted on. Each row opens the listing with the same shared-element morph.
 */
export function RecentListingsCard({ recent, delay = 0 }) {
  return (
    <BentoShell className="bento-recent" delay={delay} aria-label="Recent listings">
      <div className="bento-head">
        <p className="bento-kicker">Just listed</p>
        <h3 className="bento-title">Fresh on the market.</h3>
      </div>

      {recent.length === 0 ? (
        <p className="bento-empty">Recent listings arrive with the catalogue.</p>
      ) : (
        <ul className="recent-list">
          {recent.map((property) => (
            <li key={property.id}>
              <Link
                to={`/properties/${property.id}`}
                className="recent-row"
                data-morph-card
                aria-label={`View ${property.title}`}
                onClick={morphPropertyToDetail}
              >
                <span className="recent-thumb" data-morph-media>
                  <img src={property.images?.[0] || fallbackPropertyImage} alt="" loading="lazy" />
                </span>
                <span className="recent-main" data-morph-body>
                  <span className="recent-info">
                    <strong>{property.title}</strong>
                    <span className="recent-place">
                      <MapPin size={13} /> {property.locality}, {property.city}
                    </span>
                    <span className="recent-meta">
                      {formatPropertyType(property.propertyType)} · {formatPropertyAge(property.propertyAge)}
                    </span>
                  </span>
                  <span className="recent-price">
                    {formatCompactCurrency(property.askingPrice)}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="bento-note">Ordered by the date each listing was created.</p>
    </BentoShell>
  );
}

export default RecentListingsCard;
