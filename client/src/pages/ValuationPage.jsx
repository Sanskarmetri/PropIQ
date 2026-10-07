import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, CircleAlert, Gauge, Info, Loader2, LockKeyhole, Sparkles, WandSparkles } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button.jsx';
import { FormMessage } from '../components/FormMessage.jsx';
import { PageIntro } from '../components/PageIntro.jsx';
import { Reveal } from '../components/Reveal.jsx';
import { createValuation } from '../services/api.js';
import { formatArea, formatCompactCurrency, formatCurrency, formatPropertyType, formatSignedPercent } from '../utils/formatters.js';

const PROPERTY_TYPE_OPTIONS = ['apartment', 'villa', 'house', 'plot'];

const initialForm = {
  locality: 'Indiranagar',
  city: 'Bengaluru',
  propertyType: 'apartment',
  area: '1840',
  propertyAge: '4',
  amenities: 'Private balcony, Covered parking, Clubhouse',
  askingPrice: '24500000',
};

const isStoredPropertyId = (value) => /^[a-f\d]{24}$/i.test(value || '');

const parseAmenities = (value) =>
  value
    .split(',')
    .map((amenity) => amenity.trim())
    .filter(Boolean)
    .slice(0, 20);

export function ValuationPage() {
  const [searchParams] = useSearchParams();
  const requestedProperty = searchParams.get('property');
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [valuation, setValuation] = useState(null);
  const [failure, setFailure] = useState(null);
  const [storedPropertyId, setStoredPropertyId] = useState(
    isStoredPropertyId(requestedProperty) ? requestedProperty : null,
  );

  const runValuation = useCallback(async (payload) => {
    setStatus('loading');
    setFailure(null);

    try {
      const response = await createValuation(payload);
      const result = response.data.valuation;
      setValuation(result);
      setStatus('done');

      // Keep the (locked) form honest when a stored listing was valued: show the
      // details the estimate was actually calculated from.
      if (result.source === 'property') {
        setForm((current) => ({
          ...current,
          locality: result.property.locality || current.locality,
          city: result.property.city || current.city,
          propertyType: result.property.propertyType || current.propertyType,
          area: String(result.property.builtUpArea ?? current.area),
          propertyAge: String(result.property.propertyAge ?? 0),
          amenities: (result.property.amenities || []).join(', '),
          askingPrice: String(result.property.askingPrice ?? current.askingPrice),
        }));
      }
    } catch (error) {
      setValuation(null);
      setFailure({
        message:
          error.status === 0 || error.code === undefined
            ? 'The valuation service is unreachable right now. Please try again shortly.'
            : error.message,
        code: error.code,
        details: error.details,
        offline: error.status === 0,
      });
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (storedPropertyId) runValuation({ propertyId: storedPropertyId });
  }, [runValuation, storedPropertyId]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.locality.trim()) nextErrors.locality = 'Tell us the locality to continue.';
    if (!form.city.trim()) nextErrors.city = 'Tell us the city to continue.';
    if (!form.propertyType) nextErrors.propertyType = 'Choose a property type.';
    if (!form.area || Number(form.area) <= 0) nextErrors.area = 'Enter an area greater than zero.';
    if (form.propertyAge !== '' && (!Number.isInteger(Number(form.propertyAge)) || Number(form.propertyAge) < 0)) {
      nextErrors.propertyAge = 'Enter a whole number of years, or 0 for a new build.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (storedPropertyId) {
      runValuation({ propertyId: storedPropertyId });
      return;
    }

    if (!validate()) return;

    runValuation({
      locality: form.locality.trim(),
      city: form.city.trim(),
      propertyType: form.propertyType,
      builtUpArea: Number(form.area),
      propertyAge: form.propertyAge === '' ? 0 : Number(form.propertyAge),
      amenities: parseAmenities(form.amenities),
    });
  };

  const askForStoredProperty = storedPropertyId !== null;
  const askingPrice = askForStoredProperty
    ? Number(valuation?.property?.askingPrice || 0)
    : Number(form.askingPrice || 0);

  return (
    <div className="valuation-page">
      <PageIntro eyebrow="A clearer number starts here" title="What is this property really worth?" description="Give us a few details and PropIQ values the property from locality benchmarks, amenity credits, and property age, then shows its working.">
        <div className="page-intro-meta"><span><LockKeyhole size={14} /> No account needed to value a property</span><span><span className="live-indicator" /> Development sample data</span></div>
      </PageIntro>

      <section className="section valuation-workspace-section">
        <div className="container valuation-workspace-grid">
          <Reveal className="valuation-form-panel">
            <div className="panel-heading-row"><div><p className="eyebrow">Property snapshot</p><h2>Start with the essentials.</h2></div><span className="step-badge">01 <span>/ 01</span></span></div>
            <p className="panel-intro">These details create the estimate. Nothing is saved, and the calculation is recalculated every time you submit.</p>
            {askForStoredProperty && (
              <div className="valuation-context-note">
                <Info size={15} />
                <span>Valuing your saved listing. Use “Adjust details” to value different characteristics instead.</span>
                <Button variant="text" size="sm" onClick={() => { setStoredPropertyId(null); setStatus('idle'); }}>Adjust details</Button>
              </div>
            )}
            <form className="valuation-form" onSubmit={handleSubmit} noValidate>
              <div className="form-field"><label htmlFor="locality">Locality</label><input id="locality" name="locality" value={form.locality} onChange={updateField} placeholder="e.g. Indiranagar" disabled={askForStoredProperty} aria-invalid={Boolean(errors.locality)} aria-describedby={errors.locality ? 'locality-error' : undefined} />{errors.locality && <span className="field-error" id="locality-error">{errors.locality}</span>}</div>
              <div className="form-field"><label htmlFor="city">City</label><input id="city" name="city" value={form.city} onChange={updateField} placeholder="e.g. Bengaluru" disabled={askForStoredProperty} aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? 'city-error' : undefined} />{errors.city && <span className="field-error" id="city-error">{errors.city}</span>}</div>
              <div className="form-field"><label htmlFor="propertyType">Property type</label><select id="propertyType" name="propertyType" value={form.propertyType} onChange={updateField} disabled={askForStoredProperty} aria-invalid={Boolean(errors.propertyType)} aria-describedby={errors.propertyType ? 'propertyType-error' : undefined}>{PROPERTY_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{formatPropertyType(option)}</option>)}</select>{errors.propertyType && <span className="field-error" id="propertyType-error">{errors.propertyType}</span>}</div>
              <div className="form-field"><label htmlFor="area">Built-up area <span>(sq.ft.)</span></label><input id="area" name="area" type="number" min="1" inputMode="decimal" value={form.area} onChange={updateField} placeholder="1800" disabled={askForStoredProperty} aria-invalid={Boolean(errors.area)} aria-describedby={errors.area ? 'area-error' : undefined} />{errors.area && <span className="field-error" id="area-error">{errors.area}</span>}</div>
              <div className="form-field"><label htmlFor="propertyAge">Property age <span>(years, 0 for new)</span></label><input id="propertyAge" name="propertyAge" type="number" min="0" step="1" inputMode="numeric" value={form.propertyAge} onChange={updateField} placeholder="4" disabled={askForStoredProperty} aria-invalid={Boolean(errors.propertyAge)} aria-describedby={errors.propertyAge ? 'propertyAge-error' : undefined} />{errors.propertyAge && <span className="field-error" id="propertyAge-error">{errors.propertyAge}</span>}</div>
              <div className="form-field form-field-wide"><label htmlFor="amenities">Amenities <span>(comma separated)</span></label><input id="amenities" name="amenities" value={form.amenities} onChange={updateField} placeholder="Covered parking, Private garden" disabled={askForStoredProperty} /></div>
              <div className="form-field form-field-wide"><label htmlFor="askingPrice">Asking price <span>(INR, for comparison)</span></label><div className="input-prefix-wrap"><span>₹</span><input id="askingPrice" name="askingPrice" type="number" min="1" inputMode="decimal" value={form.askingPrice} onChange={updateField} placeholder="24500000" disabled={askForStoredProperty} aria-invalid={Boolean(errors.askingPrice)} aria-describedby={errors.askingPrice ? 'askingPrice-error' : undefined} /></div>{errors.askingPrice && <span className="field-error" id="askingPrice-error">{errors.askingPrice}</span>}</div>
              <div className="form-submit-row"><Button type="submit" size="lg" disabled={status === 'loading'}>{status === 'loading' ? 'Valuing…' : askForStoredProperty ? 'Refresh valuation' : 'Value this property'} <WandSparkles size={17} /></Button><span><Info size={14} /> Estimate is calculated on demand</span></div>
              {failure && <FormMessage>{failure.message}</FormMessage>}
              {failure?.details && <FailureDetails failure={failure} />}
            </form>
          </Reveal>

          <Reveal className="valuation-result-panel" delay={0.12}>
            {status === 'loading' && (
              <div className="valuation-empty-result" role="status" aria-live="polite">
                <div className="empty-result-orbit"><span /><span /><span /><Loader2 size={22} className="spin" /></div>
                <p className="eyebrow">Working through the numbers</p>
                <h2>Matching a locality benchmark.</h2>
                <p>PropIQ is looking for a comparable rate, then applying amenity and age adjustments.</p>
              </div>
            )}

            {status === 'error' && !valuation && (
              <div className="valuation-empty-result">
                <div className="empty-result-orbit"><span /><span /><span /><CircleAlert size={22} /></div>
                <p className="eyebrow">No estimate produced</p>
                <h2>{failure?.code === 'INSUFFICIENT_MARKET_DATA' ? 'We have no benchmark for this location yet.' : 'Something interrupted the calculation.'}</h2>
                <p>{failure?.code === 'INSUFFICIENT_MARKET_DATA' ? 'PropIQ values a property from locality and city benchmarks. This combination is not in the current development dataset, so it would rather stay quiet than guess.' : 'Nothing was estimated. Adjust the details and try again.'}</p>
              </div>
            )}

            {valuation && (
              <motion.div className="valuation-result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="result-preview-label"><span><Sparkles size={14} /> PropIQ estimate</span><span>Not a market guarantee</span></div>
                <div className="result-property-heading">
                  <div>
                    <p className="eyebrow">Valued context</p>
                    <h2>{valuation.property.title || `${valuation.property.locality}, ${valuation.property.city}`}</h2>
                    <p>{valuation.property.locality ? `${valuation.property.locality}, ` : ''}{valuation.property.city} · {formatPropertyType(valuation.property.propertyType)}</p>
                  </div>
                </div>
                <div className="result-main-value"><span>PropIQ estimated value</span><strong>{formatCompactCurrency(valuation.estimatedValue)}</strong><small>{formatCurrency(valuation.estimatedValue)} · {formatCurrency(valuation.estimatedPricePerSqFt)}/sq.ft.</small></div>
                <div className="result-comparison">
                  <div className="result-comparison-row"><span>Asking price</span><strong>{askingPrice ? formatCompactCurrency(askingPrice) : 'Not provided'}</strong></div>
                  <div className="result-comparison-row result-comparison-estimate"><span>PropIQ estimate</span><strong>{formatCompactCurrency(valuation.estimatedValue)}</strong></div>
                  {askingPrice > 0 && <><div className="result-comparison-line" /><div className="result-difference"><span>Difference</span><strong>{askingPrice > valuation.estimatedValue ? '+' : '−'}{formatCompactCurrency(Math.abs(askingPrice - valuation.estimatedValue))}</strong></div></>}
                </div>
                <div className="result-breakdown">
                  <div className="result-breakdown-heading"><span>How we got there</span><span>{valuation.marketData.matchedLevelLabel}</span></div>
                  <div className="result-breakdown-row"><span>Benchmark rate</span><strong>{formatCurrency(valuation.benchmarkPricePerSqFt)}/sq.ft.</strong></div>
                  <div className="result-breakdown-row"><span>Built-up area</span><strong>{formatArea(valuation.property.builtUpArea)}</strong></div>
                  <div className="result-breakdown-row"><span>Base value</span><strong>{formatCurrency(valuation.baseValue)}</strong></div>
                  <div className="result-breakdown-row"><span>Amenity credit{valuation.amenityAdjustment.capped ? ' (capped)' : ''}</span><strong>{formatSignedPercent(valuation.amenityAdjustment.total)}</strong></div>
                  <div className="result-breakdown-row"><span>Property age · {valuation.ageAdjustment.band}</span><strong>{formatSignedPercent(valuation.ageAdjustment.percentage)}</strong></div>
                  <div className="result-breakdown-row result-breakdown-total"><span>Estimated value</span><strong>{formatCurrency(valuation.estimatedValue)}</strong></div>
                </div>
                {valuation.amenityAdjustment.recognized.length > 0 && (
                  <ul className="result-tag-list">
                    {valuation.amenityAdjustment.recognized.map((amenity) => <li key={amenity.id}><Check size={13} /> {amenity.label} {formatSignedPercent(amenity.percentage)}</li>)}
                  </ul>
                )}
                {valuation.amenityAdjustment.unrecognized.length > 0 && (
                  <p className="result-note result-note-quiet"><Info size={15} /><span>Not priced by the current model: {valuation.amenityAdjustment.unrecognized.join(', ')}.</span></p>
                )}
                <div className="result-facts">
                  <span><Gauge size={16} /> {valuation.confidence.label}: {valuation.confidence.level} ({valuation.confidence.score}/100)</span>
                  <span><span className="inline-sqft-icon" aria-hidden="true">⌗</span> {valuation.marketData.sampleSize} comparables</span>
                </div>
                <p className="result-explanation">{valuation.explanation}</p>
                <div className="result-note"><CircleAlert size={15} /><span>{valuation.disclaimer}</span></div>              </motion.div>
            )}

            {status === 'idle' && (
              <div className="valuation-empty-result"><div className="empty-result-orbit"><span /><span /><span /><Sparkles size={23} /></div><p className="eyebrow">Your result will appear here</p><h2>A little context changes everything.</h2><p>Submit the property snapshot to see the benchmark, the adjustments, and the estimate sit side by side.</p><div className="empty-result-points"><span><Check size={14} /> Locality benchmark match</span><span><Check size={14} /> Line-by-line adjustments</span><span><Check size={14} /> Data-quality confidence</span></div></div>
            )}
          </Reveal>
        </div>
      </section>

      <section className="section valuation-how-section"><div className="container"><Reveal><div className="section-heading-row"><SectionHeadingMini title="Designed to be explainable." description="Every number on this page can be traced back to a benchmark, a rule, and a published assumption." /><span className="preview-chip"><span className="status-dot" /> Development sample data</span></div></Reveal><div className="how-grid"><HowStep number="01" icon={<Sparkles size={18} />} title="Describe the property" body="Locality, city, type, area, age, and the amenities you actually have." /><HowStep number="02" icon={<Gauge size={18} />} title="Read the working" body="The benchmark rate, each adjustment, and the resulting estimate." /><HowStep number="03" icon={<ArrowRight size={18} />} title="Decide with context" body="Compare it against the asking price and judge the data quality yourself." /></div></div></section>
    </div>
  );
}

function FailureDetails({ failure }) {
  const searched = failure.details?.searched;
  const fields = failure.details
    ? Object.entries(failure.details).filter(([key]) => key !== 'searched' && key !== 'fallbackAttempts')
    : [];

  return (
    <div className="valuation-failure-details">
      {fields.length > 0 && <ul>{fields.map(([field, message]) => <li key={field}><strong>{field}</strong>: {message}</li>)}</ul>}
      {searched && <p>We looked for a benchmark in:</p>}
      {searched && <ul>{searched.map((entry) => <li key={`${entry.locality}-${entry.city}-${entry.propertyType}`}>{entry.locality || 'All localities'}, {entry.city} · {entry.propertyType}</li>)}</ul>}
    </div>
  );
}

function SectionHeadingMini({ title, description }) {
  return <div className="section-heading"><h2>{title}</h2><p className="section-heading-description">{description}</p></div>;
}

function HowStep({ number, icon, title, body }) {
  return <div className="how-step"><span className="how-step-number">{number}</span><span className="how-step-icon">{icon}</span><h3>{title}</h3><p>{body}</p></div>;
}
