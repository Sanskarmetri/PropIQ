import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, CircleAlert, Database, FileText, Flag, Layers, Lock, MapPin, RefreshCw, ShieldCheck, TrendingUp, X } from 'lucide-react';
import { BreakdownBars } from '../components/analytics/BreakdownBars.jsx';
import { ChartCard } from '../components/analytics/ChartCard.jsx';
import { StatusDonut } from '../components/analytics/StatusDonut.jsx';
import { TrendChart } from '../components/analytics/TrendChart.jsx';
import { Button, ButtonLink } from '../components/Button.jsx';
import { PageIntro } from '../components/PageIntro.jsx';
import { Reveal } from '../components/Reveal.jsx';
import { useAuth } from '../context/AuthContext.js';
import { getAnalyticsFilterOptions, getAnalyticsOverview, getAnalyticsReport } from '../services/api.js';
import { formatCompactCurrency, formatCurrency, formatNullableCurrency, formatNullableNumber, formatNumber, formatPropertyType } from '../utils/formatters.js';

const EMPTY_FILTERS = { city: '', locality: '', propertyType: '', status: '', from: '', to: '' };

const SCREENING_LABELS = {
  clear: 'Clear',
  review: 'Needs review',
  elevated: 'Elevated',
  unavailable: 'No benchmark',
};

const SCREENING_DOTS = {
  clear: 'var(--green-deep)',
  review: 'var(--amber)',
  elevated: 'var(--red)',
  unavailable: 'var(--muted-light)',
};

const RISK_LABELS = { high: 'High', medium: 'Medium', low: 'Low', unknown: 'Unknown' };

const typeLabel = (value) => (value ? formatPropertyType(value) : 'All property types');
const statusLabel = (value) => value.charAt(0).toUpperCase() + value.slice(1);

// A report row is one shape per section, so the label and key are read from the
// field the section actually groups by.
const reportRowLabel = (row) => {
  if (row.status) return statusLabel(row.status);
  if (row.propertyType) return formatPropertyType(row.propertyType);
  if (row.month) return row.month;
  if (row.locality) return `${row.locality}, ${row.city}`;
  return row.city ?? '—';
};

const reportRowKey = (row) =>
  row.status ?? row.propertyType ?? row.month ?? row.id ?? `${row.locality}, ${row.city}`;

const matches = (draft, applied) => Object.keys(EMPTY_FILTERS).every((key) => draft[key] === applied[key]);

export function AnalyticsPage() {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const isAdmin = isAuthenticated && role === 'admin';

  const [options, setOptions] = useState(null);
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [query, setQuery] = useState(EMPTY_FILTERS);
  const [overview, setOverview] = useState({ status: 'idle', data: null, message: '' });
  const [report, setReport] = useState(null);
  const [reportState, setReportState] = useState('idle');
  const [reportError, setReportError] = useState('');
  const reportRef = useRef(null);

  useEffect(() => {
    if (!isAdmin) return undefined;
    getAnalyticsFilterOptions()
      .then((payload) => setOptions(payload.data))
      .catch(() => setOptions(null));
    return undefined;
  }, [isAdmin]);

  // The previous figures stay on screen while a new filter set is aggregated, so
  // a slow request never blanks the page.
  const loadOverview = useCallback((next) => {
    setOverview((current) => ({ ...current, status: 'loading' }));
    getAnalyticsOverview(next)
      .then((payload) => setOverview({ status: 'ready', data: payload.data, message: '' }))
      .catch((error) => setOverview({ status: 'error', data: null, message: error.message }));
  }, []);

  useEffect(() => {
    if (isAdmin) loadOverview(query);
  }, [isAdmin, query, loadOverview]);

  const update = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  const applyFilters = () => {
    setQuery(draft);
    setReport(null);
    setReportState('idle');
    setReportError('');
  };

  const clearFilters = () => {
    setDraft(EMPTY_FILTERS);
    setQuery(EMPTY_FILTERS);
    setReport(null);
    setReportState('idle');
    setReportError('');
  };

  const openReport = () => {
    setReportState('loading');
    setReportError('');
    getAnalyticsReport(query)
      .then((payload) => {
        setReport(payload.data);
        setReportState('ready');
        requestAnimationFrame(() => reportRef.current?.focus());
      })
      .catch((error) => {
        setReport(null);
        setReportState('error');
        setReportError(error.message);
      });
  };

  const data = overview.data;
  const kpis = data?.kpis;
  const dirty = !matches(draft, query);

  // The locality list follows the chosen city, so a filter pair cannot be chosen
  // that the server would answer with nothing.
  const visibleLocalities = useMemo(() => {
    const all = options?.localities ?? [];
    return draft.city ? all.filter((locality) => locality.city === draft.city) : all;
  }, [options, draft.city]);

  const scopeSummary = useMemo(() => {
    const parts = [
      typeLabel(query.propertyType),
      query.status ? `Status: ${statusLabel(query.status)}` : null,
      [query.locality, query.city].filter(Boolean).join(', ') || null,
      query.from ? `From ${query.from}` : null,
      query.to ? `To ${query.to}` : null,
    ];
    return parts.filter(Boolean).join(' · ');
  }, [query]);

  if (!authLoading && !isAdmin) {
    return (
      <div className="dashboard-page">
        <PageIntro eyebrow="Admin analytics" title="Listing analytics for your whole catalogue." description="Every figure below is computed from the stored listings, so what you read here is what PropIQ actually holds." />
        <section className="section dashboard-content-section">
          <div className="container">
            <Reveal>
              <div className="dashboard-next-card">
                <div className="dashboard-next-icon">
                  <Lock size={20} />
                </div>
                <div>
                  <p className="eyebrow">Admin only</p>
                  <h2>Analytics is available to admin accounts.</h2>
                  <p>{isAuthenticated ? 'This account is not an admin, so the analytics endpoints stay closed.' : 'Sign in with an admin account to see listing volume, pricing, screening coverage and the generated report.'}</p>
                </div>
                <ButtonLink to={isAuthenticated ? '/dashboard' : '/login'} variant="secondary">{isAuthenticated ? 'Back to dashboard' : 'Sign in to continue'} </ButtonLink>
              </div>
            </Reveal>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <PageIntro
        eyebrow="Admin analytics"
        title="Listing analytics for your whole catalogue."
        description="Every figure below is computed from the stored listings on request, so the dashboard, the report and PropVal all read from the same data."
      >
        <div className="page-intro-meta">
          <span>
            <Database size={14} /> Live figures from the listings collection
          </span>
          {overview.status === 'loading' && data ? <span className="preview-chip preview-chip-light">Recalculating…</span> : null}
          {data ? <span className="preview-chip preview-chip-light">Generated {new Date(data.generatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span> : null}
        </div>
      </PageIntro>

      <section className="section dashboard-content-section">
        <div className="container">
          <Reveal>
            <form
              className="analytics-filter-bar"
              onSubmit={(event) => {
                event.preventDefault();
                applyFilters();
              }}
            >
              <div className="filter-row">
                <label className="select-field">
                  <span className="sr-only">Filter by city</span>
                  <select value={draft.city} onChange={update('city')}>
                    <option value="">All cities</option>
                    {(options?.cities ?? []).map((city) => (
                      <option key={city.name} value={city.name}>
                        {city.name} ({city.listings})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="select-field">
                  <span className="sr-only">Filter by locality</span>
                  <select value={draft.locality} onChange={update('locality')}>
                    <option value="">All localities</option>
                    {visibleLocalities.map((locality) => (
                      <option key={`${locality.name}-${locality.city}`} value={locality.name}>
                        {locality.name}, {locality.city} ({locality.listings})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="select-field">
                  <span className="sr-only">Filter by property type</span>
                  <select value={draft.propertyType} onChange={update('propertyType')}>
                    <option value="">All property types</option>
                    {(options?.propertyTypes ?? []).map((propertyType) => (
                      <option key={propertyType} value={propertyType}>
                        {formatPropertyType(propertyType)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="select-field">
                  <span className="sr-only">Filter by listing status</span>
                  <select value={draft.status} onChange={update('status')}>
                    <option value="">Any status</option>
                    {(options?.statuses ?? []).map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="select-field">
                  <span className="sr-only">Listings created from</span>
                  <input className="analytics-date-input" type="date" value={draft.from} onChange={update('from')} aria-label="Listings created from" />
                </label>

                <label className="select-field">
                  <span className="sr-only">Listings created to</span>
                  <input className="analytics-date-input" type="date" value={draft.to} onChange={update('to')} aria-label="Listings created to" />
                </label>

                <Button type="submit" size="sm" disabled={!dirty}>
                  Apply filters
                </Button>
                {dirty || Object.values(query).some(Boolean) ? (
                  <button type="button" className="clear-filters" onClick={clearFilters}>
                    Clear all <X size={14} />
                  </button>
                ) : null}
              </div>
              <p className="analytics-filter-note">
                {dirty ? 'Filters changed — apply to refresh the figures.' : `Showing ${scopeSummary}.`} Filters match exactly, the way PropVal reads them, so this page and a PropVal question describe the same listings.
              </p>
            </form>
          </Reveal>

          {overview.status === 'loading' && !data ? (
            <div className="empty-state" role="status">
              <div className="empty-state-icon">
                <BarChart3 size={21} aria-hidden="true" />
              </div>
              <h2>Aggregating the listings…</h2>
              <p>Every number on this page is computed from the database on request.</p>
            </div>
          ) : null}

          {overview.status === 'error' ? (
            <div className="empty-state" role="alert">
              <div className="empty-state-icon">
                <CircleAlert size={21} />
              </div>
              <h2>We could not load the analytics.</h2>
              <p>{overview.message}</p>
              <Button variant="secondary" onClick={() => loadOverview(query)}>
                <RefreshCw size={15} /> Try again
              </Button>
            </div>
          ) : null}

          {data ? (
            <>
              {kpis.empty ? (
                <Reveal>
                  <div className="empty-state" role="status">
                    <div className="empty-state-icon">
                      <Layers size={21} aria-hidden="true" />
                    </div>
                    <h2>No listings match these filters.</h2>
                    <p>PropIQ has {formatNumber(data.dataCoverage.totalListingsInDatabase)} listings stored, but none of them match every filter at once. Loosen a filter to see the real figures.</p>
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  </div>
                </Reveal>
              ) : null}

              <div className="dashboard-metrics-grid analytics-metrics-grid">
                <Reveal className="analytics-metric">
                  <div className="metric-card-heading">
                    <span className="metric-label">Listings in scope</span>
                    <span className="metric-icon">
                      <Layers size={16} strokeWidth={1.8} />
                    </span>
                  </div>
                  <strong className="metric-value">{formatNumber(kpis.totalListings)}</strong>
                  <div className="metric-meta">
                    <span>
                      {kpis.activeSharePercentage === null ? 'No listings in scope' : `${kpis.activeSharePercentage}% active`}
                    </span>
                  </div>
                </Reveal>

                <Reveal className="analytics-metric" delay={0.05}>
                  <div className="metric-card-heading">
                    <span className="metric-label">Average asking price</span>
                    <span className="metric-icon">
                      <TrendingUp size={16} strokeWidth={1.8} />
                    </span>
                  </div>
                  <strong className="metric-value">{formatNullableCurrency(kpis.averageAskingPrice)}</strong>
                  <div className="metric-meta">
                    <span>Median {formatNullableCurrency(kpis.medianAskingPrice)}</span>
                  </div>
                </Reveal>

                <Reveal className="analytics-metric" delay={0.1}>
                  <div className="metric-card-heading">
                    <span className="metric-label">Price per sq.ft.</span>
                    <span className="metric-icon">
                      <BarChart3 size={16} strokeWidth={1.8} />
                    </span>
                  </div>
                  <strong className="metric-value">{formatNullableNumber(kpis.averagePricePerSqFt)}</strong>
                  <div className="metric-meta">
                    <span>{formatNullableNumber(kpis.averageBuiltUpArea)} sq.ft. average</span>
                  </div>
                </Reveal>

                <Reveal className="analytics-metric" delay={0.15}>
                  <div className="metric-card-heading">
                    <span className="metric-label">Flagged by screening</span>
                    <span className="metric-icon">
                      <Flag size={16} strokeWidth={1.8} />
                    </span>
                  </div>
                  <strong className="metric-value">{formatNumber(data.screening.byStatus.review + data.screening.byStatus.elevated)}</strong>
                  <div className="metric-meta">
                    <span>of {formatNumber(data.screening.coverage.screenedListings)} screened</span>
                  </div>
                </Reveal>
              </div>

              <div className="analytics-grid">
                <Reveal className="analytics-card">
                  <ChartCard
                    eyebrow="Listing status"
                    title="How the catalogue is split"
                    meta={`${formatNumber(kpis.totalListings)} listings`}
                    note={`${formatCompactCurrency(kpis.totalAskingValue)} total asking value, of which ${formatCompactCurrency(kpis.activeAskingValue)} sits on active listings.`}
                  >
                    <StatusDonut breakdown={data.breakdowns.status} total={kpis.totalListings} />
                  </ChartCard>
                </Reveal>

                <Reveal className="analytics-card" delay={0.05}>
                  <ChartCard
                    eyebrow="Asking price range"
                    title="Where prices sit"
                    meta={typeLabel(query.propertyType)}
                    note="Lowest, median and highest asking price are taken from the matching listings only."
                  >
                    <dl className="analytics-stat-list">
                      <div>
                        <dt>Lowest</dt>
                        <dd>{formatNullableCurrency(kpis.minimumAskingPrice)}</dd>
                      </div>
                      <div>
                        <dt>Median</dt>
                        <dd>{formatNullableCurrency(kpis.medianAskingPrice)}</dd>
                      </div>
                      <div>
                        <dt>Average</dt>
                        <dd>{formatNullableCurrency(kpis.averageAskingPrice)}</dd>
                      </div>
                      <div>
                        <dt>Highest</dt>
                        <dd>{formatNullableCurrency(kpis.maximumAskingPrice)}</dd>
                      </div>
                      <div>
                        <dt>Average bedrooms</dt>
                        <dd>{formatNullableNumber(kpis.averageBedrooms)}</dd>
                      </div>
                      <div>
                        <dt>Active asking value</dt>
                        <dd>{formatCompactCurrency(kpis.activeAskingValue)}</dd>
                      </div>
                    </dl>
                  </ChartCard>
                </Reveal>
              </div>

              <Reveal className="analytics-card analytics-card-wide">
                <ChartCard
                  eyebrow="Listing volume"
                  title="New listings by month"
                  meta={`${data.trend.months.length} months with listings`}
                  note={data.trend.basis}
                >
                  <TrendChart trend={data.trend} />
                </ChartCard>
              </Reveal>

              <div className="analytics-grid">
                <Reveal className="analytics-card">
                  <ChartCard eyebrow="Where listings sit" title="City mix" note="Top cities in the current scope, by listing volume.">
                    <BreakdownBars rows={data.breakdowns.cities} labelKey="city" valueLabel="Listings" />
                  </ChartCard>
                </Reveal>

                <Reveal className="analytics-card" delay={0.05}>
                  <ChartCard eyebrow="Property mix" title="Type mix" note="Every stored property type in the current scope.">
                    <BreakdownBars rows={data.breakdowns.propertyTypes} labelKey="propertyType" valueLabel="Listings" />
                  </ChartCard>
                </Reveal>
              </div>

              <Reveal className="analytics-card analytics-card-wide">
                <ChartCard
                  eyebrow="Locality detail"
                  title="Most listed localities"
                  meta={`Top ${data.breakdowns.localities.length}`}
                  note="Locality volume with the average asking price and price per sq.ft. in each one."
                >
                  <BreakdownBars rows={data.breakdowns.localities} labelKey="locality" secondaryKey="city" valueLabel="Listings" />
                </ChartCard>
              </Reveal>

              <div className="analytics-grid">
                <Reveal className="analytics-card">
                  <ChartCard
                    eyebrow="Screening coverage"
                    title="What screening could review"
                    meta={`Limit ${data.screening.coverage.limit}`}
                    note={data.screening.note}
                  >
                    <ul className="analytics-legend-rows">
                      {Object.entries(data.screening.byStatus).map(([status, count]) => (
                        <li key={status}>
                          <span className="legend-dot"
                          style={{ background: SCREENING_DOTS[status] ?? 'var(--muted-light)' }} />
                          {SCREENING_LABELS[status] ?? status} <strong>{formatNumber(count)}</strong>
                        </li>
                      ))}
                    </ul>
                    <ul className="analytics-legend-rows">
                      <li>
                        <span>Price deviation triggered</span>
                        <strong>{formatNumber(data.screening.ruleTriggers.PRICE_DEVIATION)}</strong>
                      </li>
                      <li>
                        <span>Duplicate listing triggered</span>
                        <strong>{formatNumber(data.screening.ruleTriggers.DUPLICATE_LISTING)}</strong>
                      </li>
                      <li>
                        <span>Without a benchmark</span>
                        <strong>{formatNumber(data.screening.withoutBenchmark)}</strong>
                      </li>
                      <li>
                        <span>Could not be screened</span>
                        <strong>{formatNumber(data.screening.errors)}</strong>
                      </li>
                    </ul>
                  </ChartCard>
                </Reveal>

                <Reveal className="analytics-card" delay={0.05}>
                  <ChartCard
                    eyebrow="Needs attention"
                    title="Flagged listings"
                    meta={`Up to ${data.screening.flaggedListings.length}`}
                    note="Sorted by risk level, then by how far the asking price sits from the benchmark."
                  >
                    {data.screening.flaggedListings.length === 0 ? (
                      <p className="analytics-chart-empty" role="status">
                        <ShieldCheck size={15} /> No listing in this scope was flagged for review.
                      </p>
                    ) : (
                      <ul className="analytics-flagged-list">
                        {data.screening.flaggedListings.map((listing) => (
                          <li key={listing.id}>
                            <div>
                              <strong>{listing.title}</strong>
                              <span>
                                <MapPin size={12} /> {listing.locality}, {listing.city} · {formatPropertyType(listing.propertyType)}
                              </span>
                            </div>
                            <div className="analytics-flagged-meta">
                              <strong>{formatCurrency(listing.askingPrice)}</strong>
                              <span className={`analytics-risk analytics-risk-${listing.screening.riskLevel}`}>{RISK_LABELS[listing.screening.riskLevel] ?? listing.screening.riskLevel} risk</span>
                              {listing.screening.deviationPercentage !== null ? <span>{listing.screening.deviationPercentage > 0 ? '+' : ''}{listing.screening.deviationPercentage}% vs benchmark</span> : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </ChartCard>
                </Reveal>
              </div>

              <Reveal className="analytics-card analytics-card-wide">
                <div className="dashboard-card-heading">
                  <div>
                    <p className="eyebrow">Report</p>
                    <h2>A written summary of this exact filter</h2>
                  </div>
                  <span className="select-like">
                    <FileText size={13} /> Findings from the same figures
                  </span>
                </div>
                <p className="analytics-card-note">
                  The report is generated by the server from the numbers above, so it cannot claim something the data does not support.
                </p>
                <div className="analytics-report-actions">
                  <Button onClick={openReport} disabled={reportState === 'loading'}>
                    <FileText size={15} /> {report ? 'Refresh report' : 'Open report'}
                  </Button>
                  {report ? (
                    <Button variant="secondary" onClick={() => window.print()}>
                      Print
                    </Button>
                  ) : null}
                </div>

                {reportState === 'loading' ? (
                  <p className="analytics-chart-empty" role="status">
                    Building the report…
                  </p>
                ) : null}

                {reportState === 'error' ? (
                  <p className="analytics-chart-empty" role="alert">
                    {reportError || 'The report could not be generated.'}
                  </p>
                ) : null}

                {report ? (
                  <article className="analytics-report" tabIndex={-1} ref={reportRef}>
                    <header>
                      <h3>{report.title}</h3>
                      <p>
                        {scopeSummary} · Generated {new Date(report.generatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </header>
                    <ul className="analytics-report-findings">
                      {report.findings.map((finding) => (
                        <li key={finding}>{finding}</li>
                      ))}
                    </ul>
                    {report.sections
                      .filter((section) => section.rows.length > 0)
                      .map((section) => (
                        <div className="analytics-report-section" key={section.id}>
                          <h4>{section.title}</h4>
                          <p>{section.description}</p>
                          <table>
                            <thead>
                              <tr>
                                {section.id === 'screening' ? <th scope="col">Listing</th> : <th scope="col">{section.title}</th>}
                                <th scope="col">Listings</th>
                                {section.id === 'screening' ? <th scope="col">Screening</th> : <th scope="col">Share</th>}
                                {section.id === 'screening' ? null : <th scope="col">Average asking price</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {section.rows.map((row) => {
                                if (section.id === 'screening') {
                                  return (
                                    <tr key={row.id}>
                                      <th scope="row">
                                        {row.title}, {row.locality}
                                      </th>
                                      <td>{formatCurrency(row.askingPrice)}</td>
                                      <td>{SCREENING_LABELS[row.screening.status] ?? row.screening.status}</td>
                                    </tr>
                                  );
                                }
                                return (
                                  <tr key={reportRowKey(row)}>
                                    <th scope="row">{reportRowLabel(row)}</th>
                                    <td>{formatNumber(row.listings)}</td>
                                    <td>{row.sharePercentage === null || row.sharePercentage === undefined ? '—' : `${row.sharePercentage}%`}</td>
                                    <td>{formatNullableCurrency(row.averageAskingPrice)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    <div className="analytics-report-limitations">
                      <h4>What these numbers cannot tell you</h4>
                      <ul>
                        {report.limitations.map((limitation) => (
                          <li key={limitation}>{limitation}</li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ) : null}
              </Reveal>

              <Reveal className="analytics-card analytics-card-wide">
                <ChartCard eyebrow="Coverage" title="What this data covers" note="Stated so a small dataset is never mistaken for a market-wide conclusion.">
                  <ul className="analytics-legend-rows">
                    <li>
                      <span>Listings stored in PropIQ</span>
                      <strong>{formatNumber(data.dataCoverage.totalListingsInDatabase)}</strong>
                    </li>
                    <li>
                      <span>Listings matching these filters</span>
                      <strong>{formatNumber(data.dataCoverage.matchedListings)}</strong>
                    </li>
                    <li>
                      <span>First listing created</span>
                      <strong>{data.dataCoverage.firstListingAt ? new Date(data.dataCoverage.firstListingAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}</strong>
                    </li>
                    <li>
                      <span>Most recent listing created</span>
                      <strong>{data.dataCoverage.lastListingAt ? new Date(data.dataCoverage.lastListingAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}</strong>
                    </li>
                  </ul>
                  <ul className="analytics-limitations">
                    {data.limitations.map((limitation) => (
                      <li key={limitation}>{limitation}</li>
                    ))}
                  </ul>
                </ChartCard>
              </Reveal>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
