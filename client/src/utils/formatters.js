const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('en-IN');

const dateFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const propertyTypeLabels = {
  apartment: 'Apartment',
  villa: 'Villa',
  house: 'House',
  plot: 'Plot',
};

export const formatCurrency = (value) => inrFormatter.format(value || 0);

export const formatCompactCurrency = (value) => {
  const amount = value || 0;
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
  return formatCurrency(amount);
};

export const formatNumber = (value) => numberFormatter.format(value || 0);

/**
 * Analytics answers with `null` when a figure does not exist yet, such as an
 * average asking price for a filter that matches no listings. That is shown as
 * a dash rather than a zero, because zero would read as a real measurement.
 */
export const formatNullableCurrency = (value) =>
  value === null || value === undefined ? '—' : formatCompactCurrency(value);

export const formatNullableNumber = (value) => (value === null || value === undefined ? '—' : formatNumber(value));

export const formatArea = (value) => `${numberFormatter.format(value || 0)} sq.ft.`;

export const formatPropertyType = (value) => propertyTypeLabels[value] || 'Property';

export const formatPropertyAge = (value) => (Number(value) > 0 ? `${value} yrs old` : 'New build');

export const getPricePerSqft = (property) =>
  property?.builtUpArea > 0 ? Math.round((property.askingPrice || 0) / property.builtUpArea) : 0;

export const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : '—');

export const formatSignedPercent = (value) => {
  const percentage = Number(value) || 0;
  if (!percentage) return '0%';
  return `${percentage > 0 ? '+' : '−'}${Math.abs(Math.round(percentage * 1000) / 10)}%`;
};

export const getStatusLabel = (status) => {
  const labels = {
    fair: 'Fair market value',
    overpriced: 'Above estimate',
    underpriced: 'Below estimate',
    active: 'Active listing',
    sold: 'Sold',
    inactive: 'Inactive',
  };
  return labels[status] || 'Awaiting analysis';
};
