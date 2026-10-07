import { getStatusLabel } from '../utils/formatters.js';

const statusClasses = {
  fair: 'status-fair',
  overpriced: 'status-overpriced',
  underpriced: 'status-underpriced',
  active: 'status-active',
  sold: 'status-sold',
  inactive: 'status-inactive',
};

export function StatusPill({ status, compact = false }) {
  return (
    <span className={`status-pill ${statusClasses[status] || 'status-neutral'} ${compact ? 'status-pill-compact' : ''}`.trim()}>
      <span className="status-dot" aria-hidden="true" />
      {getStatusLabel(status)}
    </span>
  );
}
