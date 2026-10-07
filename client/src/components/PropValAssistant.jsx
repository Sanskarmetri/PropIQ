import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  CircleAlert,
  Gauge,
  Loader2,
  MessageSquareText,
  Scale,
  Sparkles,
  X,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { usePropValPage } from '../context/PropValContext.js';
import { askPropVal } from '../services/api.js';
import { formatCompactCurrency, formatCurrency, formatNullableCurrency, formatNullableNumber, formatNumber } from '../utils/formatters.js';
import { SCREENING_STATUS_LABEL, screeningFact } from '../utils/screening.js';
import { PropertyCard } from './PropertyCard.jsx';

/* -------------------------------------------------------------------------- */
/* Answer pieces                                                               */
/* -------------------------------------------------------------------------- */

const QUICK_ACTIONS = [
  { label: 'Find a property', message: 'Find me a 3BHK in Whitefield under 1 crore' },
  { label: 'Estimate this property', message: 'What is this property worth?' },
  { label: 'Check pricing', message: 'Is this overpriced?' },
  { label: 'Show similar', message: 'Show similar properties' },
];

const INTENT_LABEL = {
  GREETING: 'Greeting',
  HELP: 'Capabilities',
  PROPERTY_SEARCH: 'Property search',
  PROPERTY_DETAILS: 'Property details',
  VALUATION: 'Valuation',
  PRICE_ANALYSIS: 'Pricing comparison',
  FRAUD_EXPLANATION: 'Screening explanation',
  SIMILAR_PROPERTIES: 'Similar properties',
  MARKET_ANALYTICS: 'Listing analytics',
  UNKNOWN: 'Unsupported request',
};

function ValuationCard({ valuation, property }) {
  return (
    <div className="propval-card">
      <p className="propval-card-label">
        <Gauge size={14} />
        PropIQ estimate
      </p>
      <p className="propval-valuation-value">{formatCompactCurrency(valuation.estimatedValue)}</p>
      <dl className="propval-card-rows">
        <div>
          <dt>Per sq.ft.</dt>
          <dd>{formatCurrency(valuation.estimatedPricePerSqFt)}</dd>
        </div>
        <div>
          <dt>Benchmark</dt>
          <dd>{formatCurrency(valuation.benchmarkPricePerSqFt)}</dd>
        </div>
        {property ? (
          <div>
            <dt>Asking price</dt>
            <dd>{formatCompactCurrency(property.askingPrice)}</dd>
          </div>
        ) : null}
        {valuation.confidence ? (
          <div>
            <dt>{valuation.confidence.label}</dt>
            <dd>
              {valuation.confidence.level} ({valuation.confidence.score}/100)
            </dd>
          </div>
        ) : null}
      </dl>
      {valuation.marketData ? (
        <p className="propval-card-note">
          {valuation.marketData.sampleSize} sample records · {valuation.marketData.locality},{' '}
          {valuation.marketData.city} · {valuation.marketData.matchedLevelLabel}
        </p>
      ) : null}
    </div>
  );
}

function ScreeningCard({ screening }) {
  const priceFlag = screening.flags.find((flag) => flag.type === 'PRICE_DEVIATION');

  return (
    <div className="propval-card">
      <p className="propval-card-label">
        <Scale size={14} />
        Listing screening
      </p>
      <span className={`propval-screening-badge propval-screening-badge-${screening.status}`}>
        {screening.status === 'clear' ? <Check size={13} /> : <CircleAlert size={13} />}
        {SCREENING_STATUS_LABEL[screening.status] ?? screening.status}
      </span>
      <dl className="propval-card-rows">
        {priceFlag ? (
          <div>
            <dt>Pricing</dt>
            <dd>{screeningFact(priceFlag)}</dd>
          </div>
        ) : null}
        {screening.property ? (
          <div>
            <dt>Asking price</dt>
            <dd>{formatCompactCurrency(screening.property.askingPrice)}</dd>
          </div>
        ) : null}
        {screening.property ? (
          <div>
            <dt>Location</dt>
            <dd>
              {screening.property.locality}, {screening.property.city}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

/**
 * The aggregate answer. The same figures the analytics service produced are
 * repeated here as a short table, so the numbers in the sentence can be checked
 * without leaving the conversation.
 */
function AnalyticsCard({ analytics }) {
  const { kpis, screening } = analytics;
  const leadingCity = analytics.breakdowns?.cities?.[0];
  const leadingType = analytics.breakdowns?.propertyTypes?.[0];
  const flagged = screening.byStatus.review + screening.byStatus.elevated;

  return (
    <div className="propval-card">
      <p className="propval-card-label">
        <Gauge size={14} />
        Listing analytics
      </p>
      <p className="propval-valuation-value">
        {formatNumber(kpis.totalListings)} {kpis.totalListings === 1 ? 'listing' : 'listings'}
      </p>
      <dl className="propval-card-rows">
        <div>
          <dt>Active</dt>
          <dd>{formatNumber(kpis.activeListings)}</dd>
        </div>
        <div>
          <dt>Average asking price</dt>
          <dd>{formatNullableCurrency(kpis.averageAskingPrice)}</dd>
        </div>
        <div>
          <dt>Median asking price</dt>
          <dd>{formatNullableCurrency(kpis.medianAskingPrice)}</dd>
        </div>
        <div>
          <dt>Average per sq.ft.</dt>
          <dd>{formatNullableNumber(kpis.averagePricePerSqFt)}</dd>
        </div>
        <div>
          <dt>Flagged by screening</dt>
          <dd>
            {formatNumber(flagged)} of {formatNumber(screening.coverage.screenedListings)}
          </dd>
        </div>
        {leadingCity ? (
          <div>
            <dt>Most listed city</dt>
            <dd>
              {leadingCity.city} ({leadingCity.listings})
            </dd>
          </div>
        ) : null}
        {leadingType ? (
          <div>
            <dt>Most listed type</dt>
            <dd>
              {leadingType.propertyType} ({leadingType.listings})
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="propval-card-note">{screening.note}</p>
    </div>
  );
}

function AnswerBody({ answer }) {
  return (
    <>
      <p className="propval-message-text">{answer.message}</p>

      {answer.analytics && !answer.analytics.kpis.empty ? <AnalyticsCard analytics={answer.analytics} /> : null}
      {answer.valuation ? <ValuationCard valuation={answer.valuation} property={answer.property} /> : null}
      {answer.screening ? <ScreeningCard screening={answer.screening} /> : null}

      {answer.results?.length ? (
        <div className="propval-results">
          {answer.results.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      ) : null}

      {answer.suggestions?.length ? (
        <div className="propval-suggestions">
          {answer.suggestions.map((suggestion) => (
            <span key={suggestion}>{suggestion}</span>
          ))}
        </div>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Assistant                                                                   */
/* -------------------------------------------------------------------------- */

const propertyIdFromPath = (pathname) => {
  const match = /^\/properties\/([a-f\d]{24})$/i.exec(pathname);
  return match ? match[1] : null;
};

const greetingAnswer = {
  message: "Hi 👋 Welcome to PropVal. Ask me to find a property, value the one you're viewing, or explain its screening.",
};

/**
 * PropVal is the in-app property assistant. It is a thin client: every message
 * goes to `POST /api/propval`, and every property, price and screening result
 * shown here comes back from the PropIQ API.
 */
export function PropValAssistant() {
  const { pathname } = useLocation();
  const { pageContext } = usePropValPage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([{ id: 'welcome', role: 'assistant', answer: greetingAnswer }]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [lastSearch, setLastSearch] = useState(null);
  const [lastSearchResultCount, setLastSearchResultCount] = useState(null);
  const listRef = useRef(null);
  const nextId = useRef(0);

  const currentPropertyId = useMemo(() => propertyIdFromPath(pathname), [pathname]);

  // The assistant's own last search is the most recent context; the filters the
  // current page has applied are the fallback.
  const searchContext = lastSearch ?? pageContext?.lastSearch ?? null;
  const searchResultCount = lastSearch
    ? lastSearchResultCount
    : pageContext?.lastSearchResultCount ?? null;

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, pending, open]);

  const send = useCallback(
    async (text) => {
      const message = text.trim();
      if (!message || pending) return;

      nextId.current += 1;
      const userEntry = { id: `user-${nextId.current}`, role: 'user', message };
      setMessages((current) => [...current, userEntry]);
      setDraft('');
      setError('');
      setPending(true);

      try {
        const payload = await askPropVal(message, {
          currentRoute: pathname,
          ...(currentPropertyId ? { currentPropertyId } : {}),
          ...(searchContext ? { lastSearch: searchContext } : {}),
          ...(searchResultCount !== null ? { lastSearchResultCount: searchResultCount } : {}),
        });

        nextId.current += 1;
        setMessages((current) => [...current, { id: `answer-${nextId.current}`, role: 'assistant', answer: payload.data }]);

        if (payload.data.entities && Object.keys(payload.data.entities).length > 0) {
          setLastSearch(payload.data.entities);
          setLastSearchResultCount(payload.data.results?.length ?? 0);
        }
      } catch (requestError) {
        setError(requestError.message || 'PropVal could not answer that right now.');
      } finally {
        setPending(false);
      }
    },
    [currentPropertyId, pathname, pending, searchContext, searchResultCount],
  );

  const onSubmit = (event) => {
    event.preventDefault();
    send(draft);
  };

  return (
    <div className={`propval${open ? ' propval-open' : ''}`.trim()}>
      {open ? (
        <section className="propval-panel" aria-label="PropVal property assistant">
          <header className="propval-header">
            <div className="propval-header-copy">
              <p className="propval-header-name">
                <Sparkles size={15} />
                PropVal
              </p>
              <p className="propval-header-note">Application-native property intelligence. No external model.</p>
            </div>
            <button type="button" className="propval-close" onClick={() => setOpen(false)} aria-label="Minimise PropVal">
              <X size={16} />
            </button>
          </header>

          <div className="propval-messages" ref={listRef} aria-live="polite">
            {messages.map((entry) =>
              entry.role === 'user' ? (
                <p className="propval-message propval-message-user" key={entry.id}>
                  {entry.message}
                </p>
              ) : (
                <div className="propval-message propval-message-assistant" key={entry.id}>
                  <p className="propval-message-intent">{INTENT_LABEL[entry.answer.intent] ?? 'PropVal'}</p>
                  <AnswerBody answer={entry.answer} />
                </div>
              ),
            )}

            {pending ? (
              <div className="propval-message propval-message-assistant">
                <p className="propval-message-text propval-message-pending">
                  <Loader2 size={14} className="spin" />
                  Checking PropIQ data…
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="propval-error">
                <CircleAlert size={14} />
                {error}
              </p>
            ) : null}
          </div>

          <div className="propval-quick-actions">
            {QUICK_ACTIONS.map((action) => (
              <button
                type="button"
                key={action.message}
                onClick={() => send(action.message)}
                disabled={pending}
              >
                {action.label}
              </button>
            ))}
          </div>

          <form className="propval-composer" onSubmit={onSubmit}>
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                currentPropertyId
                  ? 'Ask about this property…'
                  : 'Ask for a property, budget or locality…'
              }
              maxLength={500}
              aria-label="Message PropVal"
            />
            <button type="submit" disabled={pending || !draft.trim()} aria-label="Send message">
              <ArrowUp size={16} />
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className="propval-launcher"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? 'Minimise PropVal' : 'Open PropVal'}
      >
        {open ? <X size={18} /> : <MessageSquareText size={18} />}
        <span>PropVal</span>
      </button>
    </div>
  );
}
