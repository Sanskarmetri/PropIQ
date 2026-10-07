import { ArrowUpRight, Bath, BedDouble, MapPin, Maximize2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusPill } from '../StatusPill.jsx';
import { BentoShell } from './BentoShell.jsx';
import { morphPropertyToDetail } from '../../utils/propertyMorph.js';
import {
  formatArea,
  formatCurrency,
  formatDate,
  formatPropertyType,
  getPricePerSqft,
} from '../../utils/formatters.js';
import { fallbackPropertyImage } from '../../data/properties.js';

/**
 * The primary bento tile: one real listing with the image taking most of the
 * card and the essentials held in a single strip underneath.
 */
export function FeaturedPropertyCard({ property, delay = 0 }) {
  if (!property) return null;

  return (
    <BentoShell className="bento-featured" delay={delay}>
      <Link
        to={`/properties/${property.id}`}
        className="featured-card"
        data-morph-card
        aria-label={`View ${property.title}`}
        onClick={morphPropertyToDetail}
      >
        <div className="featured-media" data-morph-media>
          <img
            className="featured-image"
            src={property.images?.[0] || fallbackPropertyImage}
            alt={property.title}
          />
          <div className="featured-shade" aria-hidden="true" />
          <div className="featured-chips morph-chips">
            <StatusPill status={property.status} compact />
            <span className="property-type-badge">{formatPropertyType(property.propertyType)}</span>
          </div>
          <span className="featured-open" aria-hidden="true">
            <ArrowUpRight size={17} />
          </span>
          <p className="featured-stamp">Featured · Listed {formatDate(property.createdAt)}</p>
        </div>

        <div className="featured-body" data-morph-body>
          <div className="featured-heading">
            <h3>{property.title}</h3>
            <p className="featured-location">
              <MapPin size={15} /> {property.locality}, {property.city}
            </p>
          </div>
          <div className="featured-price">
            <span className="property-label">Asking price</span>
            <strong>{formatCurrency(property.askingPrice)}</strong>
          </div>
          <dl className="featured-facts">
            <div>
              <dt><BedDouble size={15} /> Bedrooms</dt>
              <dd>{property.bedrooms}</dd>
            </div>
            <div>
              <dt><Bath size={15} /> Bathrooms</dt>
              <dd>{property.bathrooms}</dd>
            </div>
            <div>
              <dt><Maximize2 size={15} /> Built-up</dt>
              <dd>{formatArea(property.builtUpArea)}</dd>
            </div>
            <div>
              <dt>Price / sq.ft.</dt>
              <dd>{formatCurrency(getPricePerSqft(property))}</dd>
            </div>
          </dl>
        </div>
      </Link>
    </BentoShell>
  );
}

export default FeaturedPropertyCard;
