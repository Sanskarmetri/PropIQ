import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../Button.jsx';
import { propertyTypeLabels } from '../../utils/formatters.js';

const propertyTypeOptions = [
  { value: '', label: 'All types' },
  ...Object.entries(propertyTypeLabels).map(([value, label]) => ({ value, label })),
];

// Used only before the catalogue arrives (or if it never does), so the select
// is never empty. Once real listings load they take over and cover every
// locality actually stored.
const fallbackLocalityOptions = [
  { value: 'Indiranagar', label: 'Indiranagar' },
  { value: 'Whitefield', label: 'Whitefield' },
  { value: 'Koregaon Park', label: 'Koregaon Park' },
  { value: 'Bandra West', label: 'Bandra West' },
  { value: 'Koramangala', label: 'Koramangala' },
  { value: 'Gurugram', label: 'Gurugram' },
];

/**
 * The search and filter controls, unchanged in behaviour and rehoused in a
 * floating glass bar that rides under the navigation while the page scrolls.
 */
export function ExploreControls({
  search,
  onSearchChange,
  propertyType,
  onPropertyTypeChange,
  locality,
  onLocalityChange,
  localities,
  filtersOpen,
  onFiltersToggle,
  hasFilters,
  onClearFilters,
}) {
  const localityOptions = [
    { value: '', label: 'All localities' },
    ...(localities && localities.length > 0 ? localities : fallbackLocalityOptions),
  ];

  return (
    <div className="explore-controls">
      <div className="container">
        <div className="explore-toolbar">
          <div className="search-field-wrap">
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
            <label className="sr-only" htmlFor="property-search">Search properties</label>
            <input
              id="property-search"
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search a locality, city, or property"
            />
            {search && (
              <button type="button" className="clear-search" aria-label="Clear search" onClick={() => onSearchChange('')}>
                <X size={15} />
              </button>
            )}
          </div>

          <Button variant="secondary" className="mobile-filter-toggle" onClick={onFiltersToggle}>
            <SlidersHorizontal size={16} /> Filters
          </Button>

          <div className={`filter-row ${filtersOpen ? 'filter-row-open' : ''}`.trim()}>
            <label className="select-field">
              <span className="sr-only">Filter by property type</span>
              <select value={propertyType} onChange={(event) => onPropertyTypeChange(event.target.value)}>
                {propertyTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="select-field">
              <span className="sr-only">Filter by locality</span>
              <select value={locality} onChange={(event) => onLocalityChange(event.target.value)}>
                {localityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            {hasFilters && (
              <button type="button" className="clear-filters" onClick={onClearFilters}>
                Clear all <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExploreControls;
