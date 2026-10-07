import { getStoredToken } from './token.js';

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';

const request = async (path, { method = 'GET', body, auth = false } = {}) => {
  const headers = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = getStoredToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || 'Something went wrong. Please try again.');
    error.status = response.status;
    error.code = payload.code;
    error.details = payload.details;
    throw error;
  }

  return payload;
};

export const getProperties = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/properties${suffix}`);
};

export const getPropertyById = (id) => request(`/properties/${id}`);

export const getMyProperties = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/properties/mine${suffix}`, { auth: true });
};

export const createProperty = (details) =>
  request('/properties', { method: 'POST', body: details, auth: true });

export const updateProperty = (id, details) =>
  request(`/properties/${id}`, { method: 'PUT', body: details, auth: true });

export const deleteProperty = (id) => request(`/properties/${id}`, { method: 'DELETE', auth: true });

export const registerUser = (details) => request('/auth/register', { method: 'POST', body: details });

export const loginUser = (credentials) => request('/auth/login', { method: 'POST', body: credentials });

export const getCurrentUser = () => request('/auth/me', { auth: true });

/**
 * Runs the valuation engine. Pass either a stored `propertyId` or inline
 * characteristics (`locality`, `city`, `propertyType`, `builtUpArea`,
 * `propertyAge`, `amenities`). The endpoint is public: the estimate is derived
 * on request and never stored.
 */
export const createValuation = (details) => request('/valuation', { method: 'POST', body: details });

/**
 * Runs the deterministic screening rules against a stored listing. The result is
 * derived on request from the current estimate and live listings, so it is never
 * stored and changes as soon as the underlying data changes.
 */
export const checkPropertyScreening = (propertyId) =>
  request('/fraud/check', { method: 'POST', body: { propertyId } });

/**
 * Sends one message to PropVal together with the page context the app already
 * knows (current route, the property being viewed, the last search filters).
 * PropVal answers from the same listing, valuation and screening services this
 * app already uses; there is no external model behind it.
 *
 * The stored session is sent when there is one, so PropVal can tell an admin
 * apart from a visitor. Questions that do not need a session still work without
 * one, exactly as before.
 */
export const askPropVal = (message, context = {}) =>
  request('/propval', { method: 'POST', body: { message, context }, auth: true });

const queryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  return query.toString() ? `?${query.toString()}` : '';
};

/**
 * Admin analytics. Every figure is computed by the server from the stored
 * listings, so the dashboard never carries a hard-coded metric. These endpoints
 * are admin only, which is why the session is always sent.
 */
export const getAnalyticsOverview = (params = {}) =>
  request(`/analytics/overview${queryString(params)}`, { auth: true });

export const getAnalyticsReport = (params = {}) => request(`/analytics/report${queryString(params)}`, { auth: true });

export const getAnalyticsFilterOptions = () => request('/analytics/filters', { auth: true });
