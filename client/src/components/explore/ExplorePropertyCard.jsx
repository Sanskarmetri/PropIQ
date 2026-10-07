import { ArrowUpRight, Bath, BedDouble, MapPin, Ruler } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusPill } from '../StatusPill.jsx';
import { morphPropertyToDetail } from '../../utils/propertyMorph.js';
import {
  formatArea,
  formatCurrency,
  formatPropertyType,
  getPricePerSqft,
} from '../../utils/formatters.js';
import { fallbackPropertyImage } from '../../data/properties.js';

/**
 * A single listing in the collection grid, ordered the way the eye wants it:
 * price, title, location, the facts, then the unit rate.
 */
export function ExplorePropertyCard({ property, priority = false }) {
  return (
    <article className="explore-card">
      <Link
        to={`/properties/${property.id}`}
        className="explore-card-link"
        data-morph-card
        aria-label={`View ${property.title}`}
        onClick={morphPropertyToDetail}
      >
        <div className="explore-card-media" data-morph-media>
          <img
            className="explore-card-image"
            src={property.images?.[0] || fallbackPropertyImage}
            alt={property.title}
            loading={priority ? 'eager' : 'lazy'}
          />
          <span className="explore-card-shade" aria-hidden="true" />
          <div className="explore-card-chips morph-chips">
            <StatusPill status={property.status} compact />
            <span className="property-type-badge">{formatPropertyType(property.propertyType)}</span>
          </div>
          <span className="explore-card-open" aria-hidden="true">
            <ArrowUpRight size={16} />
          </span>
        </div>

        <div className="explore-card-body" data-morph-body>
          <p className="explore-card-price">{formatCurrency(property.askingPrice)}</p>
          <h3 className="explore-card-title">{property.title}</h3>
          <p className="explore-card-location">
            <MapPin size={14} /> {property.locality}, {property.city}
          </p>

          <div className="explore-card-details">
            <span>
              <BedDouble size={15} /> {property.bedrooms} bed
            </span>
            <span>
              <Bath size={15} /> {property.bathrooms} bath
            </span>
            <span>
              <Ruler size={15} /> {formatArea(property.builtUpArea)}
            </span>
          </div>

          <div className="explore-card-rate">
            <span>Price / sq.ft.</span>
            <strong>{formatCurrency(getPricePerSqft(property))}</strong>
          </div>
        </div>
      </Link>
    </article>
  );
}

export default ExplorePropertyCard;
