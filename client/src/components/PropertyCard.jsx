import { ArrowUpRight, Bath, BedDouble, MapPin, Ruler, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusPill } from './StatusPill.jsx';
import {
  formatArea,
  formatCurrency,
  formatPropertyAge,
  formatPropertyType,
  getPricePerSqft,
} from '../utils/formatters.js';
import { fallbackPropertyImage } from '../data/properties.js';

export function PropertyCard({ property, featured = false }) {
  return (
    <article className={`property-card ${featured ? 'property-card-featured' : ''}`.trim()}>
      <Link
        to={`/properties/${property.id}`}
        className="property-card-link"
        aria-label={`View ${property.title}`}
      >
        <div className="property-image-wrap">
          <img
            className="property-image"
            src={property.images?.[0] || fallbackPropertyImage}
            alt={property.title}
            loading="lazy"
          />
          <div className="property-image-shade" />
          <div className="property-card-topline">
            <span className="property-type-badge">{formatPropertyType(property.propertyType)}</span>
            <span className="property-open-icon" aria-hidden="true">
              <ArrowUpRight size={15} />
            </span>
          </div>
          <p className="property-location-overlay">
            <MapPin size={14} />
            {property.locality}, {property.city}
          </p>
        </div>
      </Link>

      <div className="property-card-body">
        <div className="property-card-title-row">
          <h3>
            <Link to={`/properties/${property.id}`}>{property.title}</Link>
          </h3>
          <span className="property-age">{formatPropertyAge(property.propertyAge)}</span>
        </div>

        <div className="property-facts">
          <span>
            <BedDouble size={15} />
            {property.bedrooms} bed
          </span>
          <span>
            <Bath size={15} />
            {property.bathrooms} bath
          </span>
          <span>
            <Ruler size={15} />
            {formatArea(property.builtUpArea)}
          </span>
        </div>

        <StatusPill status={property.status} />

        <div className="property-price-block">
          <div>
            <span className="property-label">Asking price</span>
            <strong>{formatCurrency(property.askingPrice)}</strong>
          </div>
          <div className="property-estimate">
            <span className="property-label">
              <WalletCards size={13} /> Per sq.ft.
            </span>
            <strong>{formatCurrency(getPricePerSqft(property))}</strong>
          </div>
        </div>
      </div>
    </article>
  );
}

export default PropertyCard;
