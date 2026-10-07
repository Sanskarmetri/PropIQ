import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BedDouble, Building2, Check, CircleAlert, Clock3, Loader2, MapPin, Maximize2, ShieldCheck, Sparkles, Waves } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ButtonLink } from '../components/Button.jsx';
import { Reveal } from '../components/Reveal.jsx';
import { ScreeningPanel } from '../components/ScreeningPanel.jsx';
import { StatusPill } from '../components/StatusPill.jsx';
import { fallbackPropertyImage } from '../data/properties.js';
import { checkPropertyScreening, getPropertyById, createValuation } from '../services/api.js';
import {
  formatArea,
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatPropertyType,
  formatSignedPercent,
  getPricePerSqft,
} from '../utils/formatters.js';

export function PropertyDetailsPage() {
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading', property: null, message: '' });
  const [valuation, setValuation] = useState({ status: 'loading', data: null, message: '' });
  const [screening, setScreening] = useState({ status: 'loading', data: null, message: '' });
  const [activeImage, setActiveImage] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    setState({ status: 'loading', property: null, message: '' });
    setActiveImage(0);

    getPropertyById(id)
      .then((payload) => {
        if (mounted) setState({ status: 'ready', property: payload.data.property, message: '' });
      })
      .catch((error) => {
        if (!mounted) return;
        setState({
          status: error.status === 404 ? 'not-found' : 'error',
          property: null,
          message: error.message,
        });
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  // The estimate is calculated on demand from the stored details and the current
  // benchmark data. A failure here must never hide the listing itself.
  useEffect(() => {
    let mounted = true;
    setValuation({ status: 'loading', data: null, message: '' });

    createValuation({ propertyId: id })
      .then((payload) => {
        if (mounted) setValuation({ status: 'ready', data: payload.data.valuation, message: '' });
      })
      .catch((error) => {
        if (!mounted) return;
        setValuation({ status: 'unavailable', data: null, message: error.message });
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  // Screening reuses the estimate above, so the two cards can never disagree.
  // It is a separate request because a screening failure must not hide either
  // the listing or the valuation.
  useEffect(() => {
    let mounted = true;
    setScreening({ status: 'loading', data: null, message: '' });

    checkPropertyScreening(id)
      .then((payload) => {
        if (mounted) setScreening({ status: 'ready', data: payload.data.screening, message: '' });
      })
      .catch((error) => {
        if (!mounted) return;
        setScreening({ status: 'unavailable', data: null, message: error.message });
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  if (state.status === 'loading') {
    return (
      <section className="section detail-not-found">
        <div className="container empty-state" role="status">
          <div className="empty-state-icon">
            <Loader2 size={22} />
          </div>
          <h1>Loading this listing…</h1>
          <p>Fetching the latest details from the PropIQ API.</p>
        </div>
      </section>
    );
  }

  if (state.status === 'not-found') {
    return (
      <section className="section detail-not-found">
        <div className="container empty-state">
          <div className="empty-state-icon">
            <Building2 size={22} />
          </div>
          <h1>We couldn’t find that property.</h1>
          <p>The listing may have been removed, or the link is no longer available.</p>
          <ButtonLink to="/explore">Back to explore <ArrowLeft size={16} /></ButtonLink>
        </div>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="section detail-not-found">
        <div className="container empty-state" role="alert">
          <div className="empty-state-icon">
            <CircleAlert size={22} />
          </div>
          <h1>We couldn’t load that property.</h1>
          <p>{state.message}</p>
          <ButtonLink to="/explore" variant="secondary">Back to explore <ArrowLeft size={16} /></ButtonLink>
        </div>
      </section>
    );
  }

  const { property } = state;
  const images = property.images?.length ? property.images : [fallbackPropertyImage];
  const pricePerSqft = getPricePerSqft(property);

  return (
    <div className="property-details-page">
      <section className="section property-detail-section">
        <div className="container">
          <div className="breadcrumb"><Link to="/explore"><ArrowLeft size={15} /> Explore properties</Link><span>/</span><span>{property.locality}</span></div>
          <div className="property-detail-grid">
            <Reveal className="detail-gallery">
              <div className="detail-main-image"><img src={images[activeImage]} alt={`${property.title} interior`} /><div className="detail-image-tag"><MapPin size={14} /> {property.locality}, {property.city}</div></div>
              <div className="detail-thumbnails" role="list" aria-label="Property images">
                {images.map((image, index) => <button type="button" role="listitem" className={activeImage === index ? 'detail-thumbnail-active' : ''} key={image} onClick={() => setActiveImage(index)} aria-label={`View image ${index + 1}`}><img src={image} alt="" /></button>)}
                <div className="gallery-count"><span>01</span> / 0{images.length}</div>
              </div>
            </Reveal>
            <Reveal className="detail-summary" delay={0.1}>
              <div className="detail-summary-top"><span className="property-type-badge">{formatPropertyType(property.propertyType)}</span><StatusPill status={property.status} compact /></div>
              <h1>{property.title}</h1>
              <p className="detail-location"><MapPin size={16} /> {property.locality}, {property.city}</p>
              <div className="detail-price-row"><div><span className="property-label">Asking price</span><strong>{formatCurrency(property.askingPrice)}</strong></div><div className="detail-estimate"><span className="property-label">Price per sq.ft.</span><strong>{formatCurrency(pricePerSqft)}</strong></div></div>
              <div className="detail-divider" />
              <div className="detail-facts-grid"><div><BedDouble size={18} /><span>Bedrooms</span><strong>{property.bedrooms}</strong></div><div><Building2 size={18} /><span>Bathrooms</span><strong>{property.bathrooms}</strong></div><div><Maximize2 size={17} /><span>Built-up area</span><strong>{formatArea(property.builtUpArea)}</strong></div><div><Clock3 size={17} /><span>Property age</span><strong>{property.propertyAge} years</strong></div></div>
              <div className="detail-actions"><ButtonLink to={`/valuation?property=${property.id}`} size="lg">Open the full working <ArrowUpRight size={17} /></ButtonLink><button type="button" className={`save-button ${saved ? 'save-button-saved' : ''}`.trim()} aria-pressed={saved} onClick={() => setSaved((current) => !current)}>{saved ? <Check size={17} /> : <Sparkles size={17} />} {saved ? 'Saved' : 'Save preview'}</button></div>
              <p className="detail-disclaimer">{saved ? 'Saved in this preview session only. Sign-in and persistence arrive in a later phase.' : valuation.status === 'ready' ? `Estimated from ${valuation.data.marketData.matchedLevelLabel.toLowerCase()} in development sample data. Recalculated on every visit and never stored.` : 'This listing is stored in the PropIQ database.'}</p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section detail-analysis-section">
        <div className="container detail-analysis-grid">
          <Reveal className="detail-description-block"><p className="eyebrow">The property</p><h2>Space that feels considered.</h2><p>{property.description}</p><div className="amenity-list">{property.amenities.map((amenity) => <span key={amenity}><Check size={14} /> {amenity}</span>)}</div></Reveal>
          <Reveal className="detail-signal-block" delay={0.1}>
            <div className="detail-signal-card">
              <div className="detail-signal-header"><div><p className="eyebrow">{valuation.status === 'ready' ? 'PropIQ valuation' : 'Listing summary'}</p><h2>{property.title}</h2></div><span className="detail-signal-icon"><ShieldCheck size={20} /></span></div>
              <div className="detail-signal-rows">
                {valuation.status === 'ready' && (
                  <>
                    <div className="detail-signal-highlight"><span>PropIQ estimated value</span><strong>{formatCompactCurrency(valuation.data.estimatedValue)}</strong></div>
                    <div><span>Estimated price per sq.ft.</span><strong>{formatCurrency(valuation.data.estimatedPricePerSqFt)}</strong></div>
                    <div><span>Benchmark rate</span><strong>{formatCurrency(valuation.data.benchmarkPricePerSqFt)}/sq.ft.</strong></div>
                    <div><span>Amenity and age effect</span><strong>{formatSignedPercent(valuation.data.amenityAdjustment.total)} · {formatSignedPercent(valuation.data.ageAdjustment.percentage)}</strong></div>
                    <div><span>Data-quality confidence</span><strong>{valuation.data.confidence.level} ({valuation.data.confidence.score}/100)</strong></div>
                  </>
                )}
                <div><span>Listing status</span><strong className="signal-inline"><StatusPill status={property.status} compact /></strong></div>
                <div><span>Price per sq.ft.</span><strong>{formatCurrency(pricePerSqft)}</strong></div>
                <div><span>Built-up area</span><strong>{formatArea(property.builtUpArea)}</strong></div>
                <div><span>Listed on</span><strong>{formatDate(property.createdAt)}</strong></div>
              </div>
              {valuation.status === 'loading' && <div className="detail-signal-note"><Loader2 size={15} className="spin" /><span>Calculating an estimate from current sample benchmarks…</span></div>}
              {valuation.status === 'unavailable' && <div className="detail-signal-note"><CircleAlert size={15} /><span>No estimate for this property right now. {valuation.message}</span></div>}
              {valuation.status === 'ready' && <p className="detail-signal-explanation">{valuation.data.explanation}</p>}
              {valuation.status === 'ready' && <div className="detail-signal-note"><CircleAlert size={15} /><span>{valuation.data.disclaimer}</span></div>}
            </div>
          </Reveal>
          <Reveal className="detail-screening-block" delay={0.15}>
            <ScreeningPanel screening={screening} />
          </Reveal>
        </div>
      </section>

      <section className="section detail-bottom-section"><div className="container detail-bottom-inner"><div className="detail-bottom-icon"><Waves size={21} /></div><div><p className="eyebrow">Keep exploring</p><h2>There is more context nearby.</h2><p>Compare this home with other live listings and start building a shortlist that makes sense.</p></div><ButtonLink to="/explore" variant="secondary">Browse more properties <ArrowUpRight size={16} strokeWidth={1.8} /></ButtonLink></div></section>
    </div>
  );
}
