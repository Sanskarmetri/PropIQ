import { useEffect, useState } from 'react';
import { getProperties } from '../services/api.js';
import { propertyTypeLabels } from '../utils/formatters.js';

const STATUSES = ['active', 'sold', 'inactive'];

/**
 * Loads the catalogue the Explore bento cards are drawn from.
 *
 * Three requests (one per stored status) give the exact per-status totals the
 * market snapshot shows, plus the listings themselves for the type, city,
 * recent and featured cards. Nothing here is invented: every figure is either
 * a `pagination.total` from the API or a count over the listings it returned.
 *
 * `limit` is capped at 50 by the API, so the distributions are computed over
 * the returned page while the totals stay exact through `pagination.total`.
 */
export function useMarketSnapshot() {
  const [state, setState] = useState({
    status: 'loading',
    counts: null,
    catalogue: [],
    message: '',
  });

  useEffect(() => {
    let mounted = true;
    setState({ status: 'loading', counts: null, catalogue: [], message: '' });

    Promise.all(STATUSES.map((status) => getProperties({ status, limit: 50 })))
      .then((responses) => {
        if (!mounted) return;
        const counts = {};
        const catalogue = [];
        responses.forEach((payload, index) => {
          counts[STATUSES[index]] = payload.data.pagination.total;
          catalogue.push(...payload.data.properties);
        });
        setState({ status: 'ready', counts, catalogue, message: '' });
      })
      .catch((error) => {
        if (!mounted) return;
        setState({ status: 'error', counts: null, catalogue: [], message: error.message });
      });

    return () => {
      mounted = false;
    };
  }, []);

  const { status, counts, catalogue, message } = state;
  const total = counts ? STATUSES.reduce((sum, key) => sum + counts[key], 0) : null;

  const byDate = [...catalogue].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const typeMix = mixBy(catalogue, 'propertyType', (key) => propertyTypeLabels[key] || 'Property');
  const cityMix = mixBy(catalogue, 'city');
  const localities = new Set(catalogue.map((property) => property.locality)).size;

  return {
    status,
    message,
    counts,
    total,
    catalogue,
    typeMix,
    cityMix,
    localities,
    recent: byDate.slice(0, 3),
    featured: byDate.find((property) => property.status === 'active') || byDate[0] || null,
  };
}

function mixBy(list, field, labelFor = (key) => key) {
  const totals = new Map();
  list.forEach((item) => totals.set(item[field], (totals.get(item[field]) || 0) + 1));
  const count = list.length || 1;
  return [...totals.entries()]
    .map(([key, value]) => ({
      key,
      label: labelFor(key),
      count: value,
      share: Math.round((value / count) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}
