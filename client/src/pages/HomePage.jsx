import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  Fingerprint,
  Gauge,
  Layers3,
  MapPinned,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { ButtonLink } from '../components/Button.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { PropertyCard } from '../components/PropertyCard.jsx';
import { Reveal } from '../components/Reveal.jsx';
import { SectionHeading } from '../components/SectionHeading.jsx';
import { analytics, properties } from '../data/properties.js';
import { getProperties } from '../services/api.js';
import { formatCompactCurrency, formatCurrency, formatNumber } from '../utils/formatters.js';

const assistantAnswers = {
  value: {
    label: 'Why this value?',
    title: 'The estimate follows the market around it.',
    body: 'PropIQ would weigh comparable homes, locality momentum, floor-level context, and the property’s recent condition to explain the range.',
  },
  pricing: {
    label: 'Is it fairly priced?',
    title: 'This listing sits close to the market signal.',
    body: 'A future PropIQ report would separate the asking price from the estimated value and show the evidence behind every adjustment.',
  },
  fraud: {
    label: 'Any fraud signals?',
    title: 'A second look can prevent an expensive mistake.',
    body: 'The future risk layer will surface unusual price deviations and repeated listing details in a simple review queue.',
  },
};

const chartBars = [42, 58, 49, 68, 61, 76, 72, 88, 80, 94, 86, 98];

/**
 * PropertyCard is written against the live API shape (`askingPrice`,
 * `builtUpArea`, lowercase `propertyType`). The local demo dataset still uses
 * `price`/`area` and title-cased types, so both shapes are normalised here
 * instead of the card carrying two contracts.
 */
const toCardProperty = (property) => ({
  ...property,
  askingPrice: property.askingPrice ?? property.price ?? 0,
  builtUpArea: property.builtUpArea ?? property.area ?? 0,
  propertyType: typeof property.propertyType === 'string' ? property.propertyType.toLowerCase() : property.propertyType,
});

export function HomePage() {
  const [assistantTopic, setAssistantTopic] = useState('value');
  const [featured, setFeatured] = useState(() => properties.slice(0, 3).map(toCardProperty));
  const activeAnswer = assistantAnswers[assistantTopic];
  const reduceMotion = useReducedMotion();

  // The three cards link to /properties/:id, so they have to carry real ids:
  // the demo dataset's `prop-001` style ids are not valid in the API.
  useEffect(() => {
    let mounted = true;
    getProperties({ limit: 3 })
      .then((payload) => {
        const listings = payload?.data?.properties;
        if (mounted && Array.isArray(listings) && listings.length > 0) {
          setFeatured(listings.map(toCardProperty));
        }
      })
      .catch(() => {
        // Keep the normalised local fallback so the section never renders empty.
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="container hero-grid">
          <Reveal className="hero-copy">
            <div className="hero-kicker"><span className="live-indicator" /> Intelligence for the property market</div>
            <h1>Know the real <span>value</span> of every property.</h1>
            <p className="hero-description">PropIQ brings asking prices, local market context, and listing signals into one clear view—so you can buy, sell, and invest with conviction.</p>
            <div className="hero-actions">
              <ButtonLink to="/explore" size="lg">Explore properties <ArrowUpRight size={17} strokeWidth={1.8} /></ButtonLink>
              <ButtonLink to="/valuation" variant="secondary" size="lg">Get a valuation <ArrowRight size={17} strokeWidth={1.8} /></ButtonLink>
            </div>
            <div className="hero-proof">
              <div className="avatar-stack" aria-hidden="true">
                <span>AM</span><span>RK</span><span>NS</span>
              </div>
              <p><strong>Built for confident decisions</strong><br />A clearer view of what the price really means.</p>
            </div>
          </Reveal>
          <Reveal className="hero-visual" delay={0.12}>
            <div className="hero-image-frame">
              <img src={properties[0].images[0]} alt="Bright contemporary living room" />
              <div className="hero-image-overlay" />
              <div className="hero-image-label"><MapPinned size={15} /> Indiranagar, Bengaluru</div>
              <div className="hero-image-caption"><span>Featured home</span><strong>{formatCompactCurrency(properties[0].price)}</strong></div>
            </div>
            <div className="hero-float-card hero-float-card-top">
              <span className="float-icon"><Gauge size={17} /></span>
              <div><small>PropIQ estimate</small><strong>{formatCompactCurrency(properties[0].estimatedValue)}</strong></div>
              <span className="float-up"><ArrowUpRight size={13} /> 2.8%</span>
            </div>
            <div className="hero-float-card hero-float-card-bottom">
              <span className="float-icon float-icon-lime"><ShieldCheck size={17} /></span>
              <div><small>Listing confidence</small><strong>High · 94%</strong></div>
              <span className="float-check"><Check size={14} /></span>
            </div>
          </Reveal>
        </div>
        <div className="container hero-footnote"><span>01</span><span className="hero-footnote-line" /><span>Clearer signals for a more human property market</span></div>
      </section>

      <section className="section section-discovery" id="discover">
        <div className="container">
          <div className="section-heading-row">
            <Reveal><SectionHeading eyebrow="A smarter starting point" title="Find a property with context." description="Explore the details behind the listing, not just the number on the page." /></Reveal>
            <Reveal delay={0.08}><ButtonLink to="/explore" variant="text">View all properties <ArrowRight size={16} /></ButtonLink></Reveal>
          </div>
          <div className="property-grid">
            {featured.map((property, index) => (
              <Reveal key={property.id} delay={index * 0.08}><PropertyCard property={property} featured={index === 0} /></Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-dark valuation-showcase">
        <div className="container valuation-showcase-grid">
          <Reveal className="valuation-showcase-copy">
            <SectionHeading eyebrow="The intelligence layer" title="See the gap between a price and a value." description="PropIQ is designed to make the reasoning visible. Start with a simple comparison today; connect the live valuation engine when the model is ready." />
            <div className="valuation-callout"><span className="callout-line" /><p><strong>Not just a number.</strong> Every future estimate will come with a readable, evidence-backed explanation.</p></div>
            <ButtonLink to="/valuation" variant="secondary">Try the valuation preview <ArrowUpRight size={16} /></ButtonLink>
          </Reveal>
          <Reveal className="valuation-visual" delay={0.12}>
            <div className="comparison-panel">
              <div className="comparison-panel-header"><div><span className="panel-kicker">Live comparison · preview</span><h3>Sunlit Courtyard Residence</h3></div><span className="panel-location">Indiranagar <span>·</span> 1,840 sq.ft.</span></div>
              <div className="comparison-values"><div><span>Asking price</span><strong>{formatCompactCurrency(properties[0].price)}</strong></div><div><span>PropIQ estimate</span><strong>{formatCompactCurrency(properties[0].estimatedValue)}</strong></div><div className="difference-value"><span>Difference</span><strong>+{formatCompactCurrency(properties[0].priceDifference)}</strong></div></div>
              <div className="valuation-bars" aria-label="Asking price and estimated value comparison">
                <div className="bar-row"><div className="bar-label"><span>Asking price</span><strong>{formatCompactCurrency(properties[0].price)}</strong></div><div className="bar-track"><motion.div className="bar-fill bar-fill-asking" initial={{ width: 0 }} whileInView={{ width: '91%' }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.2 }} /></div></div>
                <div className="bar-row"><div className="bar-label"><span>PropIQ estimate</span><strong>{formatCompactCurrency(properties[0].estimatedValue)}</strong></div><div className="bar-track"><motion.div className="bar-fill bar-fill-estimate" initial={{ width: 0 }} whileInView={{ width: '94%' }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.32 }} /></div></div>
                <div className="market-range"><span>Local market range</span><div className="range-line"><i /><i /><i /></div><strong>₹2.31 Cr — ₹2.68 Cr</strong></div>
              </div>
              <div className="comparison-footer"><span><span className="confidence-ring">94</span> confidence score</span><span className="comparison-updated">Updated moments ago <span className="status-dot" /></span></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section section-fraud">
        <div className="container fraud-grid">
          <Reveal className="fraud-visual">
            <div className="signal-card">
              <div className="signal-card-top"><div><span className="panel-kicker">Listing integrity</span><h3>One listing, checked from every angle.</h3></div><span className="signal-shield"><ShieldCheck size={20} /></span></div>
              <div className="signal-list">
                <div className="signal-row signal-row-clear"><span className="signal-icon"><TrendingUp size={16} /></span><div><strong>Price deviation</strong><span>Within expected range</span></div><span className="signal-result">Clear</span></div>
                <div className="signal-row signal-row-clear"><span className="signal-icon"><Layers3 size={16} /></span><div><strong>Listing details</strong><span>No duplicates found</span></div><span className="signal-result">Clear</span></div>
                <div className="signal-row signal-row-review"><span className="signal-icon"><CircleAlert size={16} /></span><div><strong>Image consistency</strong><span>Ready for a closer look</span></div><span className="signal-result">Review</span></div>
              </div>
              <div className="signal-card-footer"><span><Fingerprint size={15} /> Pattern checks are on</span><span className="preview-label">Preview</span></div>
            </div>
          </Reveal>
          <Reveal className="fraud-copy" delay={0.12}>
            <SectionHeading eyebrow="A second set of eyes" title="Catch the signals a listing doesn’t mention." description="PropIQ’s fraud layer will look for the details that tend to get missed in a fast-moving market—without turning due diligence into a spreadsheet." />
            <div className="feature-list">
              <div className="feature-list-item"><span className="feature-number">01</span><div><h3>Unusual price deviations</h3><p>Surface listings that sit meaningfully outside the local pattern.</p></div></div>
              <div className="feature-list-item"><span className="feature-number">02</span><div><h3>Duplicate listing details</h3><p>Compare the language, images, and structure behind each property card.</p></div></div>
              <div className="feature-list-item"><span className="feature-number">03</span><div><h3>Review before regret</h3><p>Turn a complex risk check into a simple, human-readable next step.</p></div></div>
            </div>
            <ButtonLink to="/dashboard" variant="text">See the insights preview <ArrowRight size={16} /></ButtonLink>
          </Reveal>
        </div>
      </section>

      <section className="section section-ai">
        <div className="container ai-showcase-grid">
          <Reveal className="ai-copy">
            <SectionHeading eyebrow="An assistant for the in-between" title="Ask better questions about a property." description="PropIQ’s future assistant will translate complex market signals into a conversation you can actually use." />
            <div className="ai-promise"><Sparkles size={18} /><span>Plain-language insights, grounded in property context.</span></div>
            <ButtonLink to="/valuation" variant="text">Explore the preview <ArrowRight size={16} /></ButtonLink>
          </Reveal>
          <Reveal className="assistant-window" delay={0.12}>
            <div className="assistant-window-bar"><div className="assistant-window-title"><span className="assistant-avatar"><Bot size={16} /></span><div><strong>PropIQ Assistant</strong><span>Listing intelligence · preview</span></div></div><span className="window-status"><span className="status-dot" /> Ready</span></div>
            <div className="assistant-body">
              <div className="assistant-question"><span>You</span><p>What should I know before I shortlist this home?</p></div>
              <motion.div key={assistantTopic} className="assistant-answer" initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}><span className="assistant-avatar assistant-avatar-small"><Sparkles size={14} /></span><div><strong>{activeAnswer.title}</strong><p>{activeAnswer.body}</p></div></motion.div>
              <div className="assistant-topics" role="tablist" aria-label="Assistant preview topics">
                {Object.entries(assistantAnswers).map(([key, item]) => <button key={key} type="button" role="tab" aria-selected={assistantTopic === key} className={assistantTopic === key ? 'assistant-topic-active' : ''} onClick={() => setAssistantTopic(key)}>{item.label}</button>)}
              </div>
            </div>
            <div className="assistant-disclaimer"><Zap size={14} /> UI preview only · no language model is connected yet</div>
          </Reveal>
        </div>
      </section>

      <section className="section section-analytics">
        <div className="container analytics-panel-wrap">
          <Reveal>
            <div className="analytics-panel">
              <div className="analytics-panel-header"><div><p className="eyebrow eyebrow-light">The wider picture</p><h2>Market clarity, in a single view.</h2><p>Understand the movement around a property before you make the next move.</p></div><div className="analytics-date"><BarChart3 size={15} /> Last 12 months <span>⌄</span></div></div>
              <div className="metrics-grid">
                <MetricCard label="Average property price" value={formatCompactCurrency(analytics.averagePrice)} change={analytics.change.averagePrice} icon={BarChart3} tone="positive" />
                <MetricCard label="Average price / sq.ft." value={formatCurrency(analytics.averagePricePerSqft)} change={analytics.change.averagePricePerSqft} icon={Gauge} tone="positive" />
                <MetricCard label="Listing volume" value={formatNumber(analytics.listingVolume)} change={analytics.change.listingVolume} icon={Layers3} tone="positive" />
                <MetricCard label="Flagged listings" value={formatNumber(analytics.flaggedListings)} change={analytics.change.flaggedListings} icon={CircleAlert} tone="positive" />
              </div>
              <div className="analytics-lower-grid">
                <div className="chart-panel"><div className="chart-panel-heading"><div><span>Market activity</span><strong>Listings are moving steadily upward</strong></div><span className="chart-legend"><i /> Listings indexed</span></div><div className="bar-chart" aria-label="Illustrative market activity chart">{chartBars.map((height, index) => <span key={`${height}-${index}`} style={{ height: `${height}%` }} />)}</div><div className="chart-axis"><span>Jan</span><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span><span>Nov</span></div></div>
                <div className="insight-panel"><span className="panel-kicker">A useful observation</span><div className="insight-icon"><ScanSearch size={19} /></div><p>Listings with complete context are <strong>32% more likely</strong> to be shortlisted.</p><span className="insight-note">Illustrative insight · analytics engine coming next</span><ButtonLink to="/dashboard" variant="text">Open insights <ChevronRight size={15} /></ButtonLink></div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section final-cta-section">
        <div className="container final-cta-wrap">
          <Reveal className="final-cta">
            <div className="final-cta-mark" aria-hidden="true"><span>✦</span></div>
            <p className="eyebrow">Your next decision starts here</p>
            <h2>Make the number<br /><span>mean more.</span></h2>
            <p>Explore a clearer property experience with PropIQ. The intelligence layer is just getting started.</p>
            <div className="hero-actions"><ButtonLink to="/explore" size="lg">Explore properties <ArrowUpRight size={17} /></ButtonLink><ButtonLink to="/valuation" variant="secondary" size="lg">See a valuation <ArrowRight size={17} /></ButtonLink></div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
