import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPinned, RefreshCw, Search } from 'lucide-react';
import { Button } from '../components/Button.jsx';
import { CityCoverageCard } from '../components/explore/CityCoverageCard.jsx';
import { ExploreControls } from '../components/explore/ExploreControls.jsx';
import { ExploreHero } from '../components/explore/ExploreHero.jsx';
import { ExplorePropertyCard } from '../components/explore/ExplorePropertyCard.jsx';
import { FeaturedPropertyCard } from '../components/explore/FeaturedPropertyCard.jsx';
import { MarketSnapshotCard } from '../components/explore/MarketSnapshotCard.jsx';
import { RecentListingsCard } from '../components/explore/RecentListingsCard.jsx';
import { TypeMixCard } from '../components/explore/TypeMixCard.jsx';
import { ValuationCtaCard } from '../components/explore/ValuationCtaCard.jsx';
import { Reveal } from '../components/Reveal.jsx';
import { usePropValFilters } from '../context/PropValContext.js';
import { useMarketSnapshot } from '../hooks/useMarketSnapshot.js';
import { getProperties } from '../services/api.js';

const PAGE_SIZE = 6;

const emptyState = { status: 'loading', results: [], pagination: null, message: '' };

export function ExplorePage() {
  const [search, setSearch] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [locality, setLocality] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listings, setListings] = useState(emptyState);
  const [pending, setPending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const latestRequest = useRef(0);

  const snapshot = useMarketSnapshot();

  // Locality options are read off the catalogue the bento cards already
  // fetched, so every stored locality can be offered with no extra request.
  const localityOptions = useMemo(() => {
    const counts = new Map();
    snapshot.catalogue.forEach((property) => {
      if (property.locality) counts.set(property.locality, (counts.get(property.locality) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value]) => ({ value, label: value }));
  }, [snapshot.catalogue]);

  const fetchListings = useCallback(
    async (page, append, signal) => {
      const requestId = latestRequest.current + 1;
      latestRequest.current = requestId;
      if (append) setLoadingMore(true);
      else setPending(true);

      try {
        const params = { page, limit: PAGE_SIZE };
        if (search.trim()) params.search = search.trim();
        if (propertyType) params.propertyType = propertyType;
        if (locality) params.locality = locality;
        const payload = await getProperties(params);
        if (signal?.aborted || latestRequest.current !== requestId) return;

        setListings((current) => ({
          status: 'ready',
          results: append ? [...current.results, ...payload.data.properties] : payload.data.properties,
          pagination: payload.data.pagination,
          message: '',
        }));
      } catch (error) {
        if (signal?.aborted || latestRequest.current !== requestId) return;
        setListings({ status: 'error', results: [], pagination: null, message: error.message });
      } finally {
        if (latestRequest.current === requestId) {
          setPending(false);
          setLoadingMore(false);
        }
      }
    },
    [locality, propertyType, search],
  );

  useEffect(() => {
    const controller = new AbortController();
    setListings(emptyState);
    const handle = setTimeout(() => fetchListings(1, false, controller.signal), 300);
    return () => {
      controller.abort();
      clearTimeout(handle);
    };
  }, [fetchListings]);

  const clearFilters = () => {
    setSearch('');
    setPropertyType('');
    setLocality('');
  };

  const hasFilters = Boolean(search) || Boolean(propertyType) || Boolean(locality);
  const { results, pagination } = listings;
  const canLoadMore = listings.status === 'ready' && pagination && pagination.page < pagination.pages;
  const foundTotal = pagination ? pagination.total : 0;

  // Hands the filters applied on this page to PropVal, so a follow-up question in
  // the assistant is answered against the same search instead of a second one.
  usePropValFilters(
    {
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(propertyType ? { propertyType } : {}),
      ...(locality ? { locality } : {}),
    },
    listings.status === 'ready' ? listings.pagination?.total ?? null : null,
  );

  return (
    <div className="explore-page">
      <ExploreHero total={snapshot.total} cityCount={snapshot.cityMix.length} />

      <div className="explore-flow">
        <ExploreControls
          search={search}
          onSearchChange={setSearch}
          propertyType={propertyType}
          onPropertyTypeChange={setPropertyType}
          locality={locality}
          onLocalityChange={setLocality}
          localities={localityOptions}
          filtersOpen={filtersOpen}
          onFiltersToggle={() => setFiltersOpen((open) => !open)}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
        />

        <section className="section explore-bento-section" aria-label="Explore at a glance">
          <div className="container">
            <div className="explore-bento">
              <FeaturedPropertyCard property={snapshot.featured} delay={0.12} />
              <MarketSnapshotCard snapshot={snapshot} delay={0.16} />
              <TypeMixCard typeMix={snapshot.typeMix} total={snapshot.total} delay={0.2} />
              <CityCoverageCard cityMix={snapshot.cityMix} localities={snapshot.localities} delay={0.24} />
              <RecentListingsCard recent={snapshot.recent} delay={0.28} />
              <ValuationCtaCard total={snapshot.total} delay={0.32} />
            </div>
          </div>
        </section>

        <section className="section explore-collection-section">
          <div className="container">
            <Reveal className="explore-collection-head">
              <div>
                <p className="eyebrow">The collection</p>
                <h2>Homes worth a closer look.</h2>
              </div>
              <div className="explore-result-bar" aria-live="polite">
                <p>
                  <strong>{foundTotal}</strong> {foundTotal === 1 ? 'property' : 'properties'} found
                </p>
                <p className="result-context">
                  <MapPinned size={15} />
                  {snapshot.cityMix.length
                    ? `Live listings across ${snapshot.cityMix.length} ${
                        snapshot.cityMix.length === 1 ? 'city' : 'cities'
                      }`
                    : 'Live listing data'}
                  <span className="context-divider" />
                  <span>{pending ? 'Refreshing…' : 'Synced with the API'}</span>
                </p>
              </div>
            </Reveal>

            {listings.status === 'loading' ? (
              <div className="empty-state" role="status">
                <div className="empty-state-icon">
                  <Search size={21} aria-hidden="true" />
                </div>
                <h2>Loading live listings…</h2>
                <p>Fetching the latest properties from the PropIQ API.</p>
              </div>
            ) : null}

            {listings.status === 'error' ? (
              <div className="empty-state" role="alert">
                <div className="empty-state-icon">
                  <RefreshCw size={21} />
                </div>
                <h2>We could not load the listings.</h2>
                <p>{listings.message}</p>
                <Button variant="secondary" onClick={() => fetchListings(1, false)}>
                  Try again
                </Button>
              </div>
            ) : null}

            {listings.status === 'ready' && results.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Search size={21} />
                </div>
                <h2>No properties match those filters.</h2>
                <p>Try a different locality, property type, or search phrase.</p>
                <Button variant="secondary" onClick={clearFilters}>Reset filters</Button>
              </div>
            ) : null}

            {results.length > 0 ? (
              <div className="explore-collection-grid">
                {results.map((property, index) => (
                  <Reveal key={property.id} delay={(index % PAGE_SIZE) * 0.05}>
                    <ExplorePropertyCard property={property} priority={index < 3} />
                  </Reveal>
                ))}
              </div>
            ) : null}

            {canLoadMore ? (
              <div className="explore-load-more">
                <Button variant="secondary" onClick={() => fetchListings(pagination.page + 1, true)} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more properties'}
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export default ExplorePage;
