import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

const metricIcons = {
  averagePrice: ArrowUpRight,
  averagePricePerSqft: ArrowUpRight,
  listingVolume: ArrowUpRight,
  flaggedListings: ArrowDownRight,
};

export function MetricCard({ label, value, change, icon: Icon, tone = 'positive', note }) {
  const MetricIcon = Icon || metricIcons[label] || Minus;
  const changeIcon = change?.startsWith('-') ? ArrowDownRight : ArrowUpRight;
  const ChangeIcon = change ? changeIcon : Minus;

  return (
    <div className="metric-card">
      <div className="metric-card-heading">
        <span className="metric-label">{label}</span>
        <span className={`metric-icon metric-icon-${tone}`}><MetricIcon size={16} strokeWidth={1.8} /></span>
      </div>
      <strong className="metric-value">{value}</strong>
      <div className="metric-meta">
        {change && <span className={`metric-change metric-change-${tone}`}><ChangeIcon size={13} strokeWidth={2} /> {change}</span>}
        {note && <span>{note}</span>}
      </div>
    </div>
  );
}
