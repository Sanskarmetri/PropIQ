import { useState } from 'react';
import { ArrowRight, BarChart3, Bell, Check, CircleAlert, Clock3, FileSearch, Flag, LayoutDashboard, Lock, MapPin, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { ButtonLink } from '../components/Button.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { PageIntro } from '../components/PageIntro.jsx';
import { PropertyManager } from '../components/PropertyManager.jsx';
import { Reveal } from '../components/Reveal.jsx';
import { useAuth } from '../context/AuthContext.js';
import { analytics, properties } from '../data/properties.js';
import { formatCompactCurrency, formatCurrency, formatNumber } from '../utils/formatters.js';

const activity = [
  { property: properties[2], signal: 'Below estimate', detail: '₹13.0L under the sample market value', tone: 'positive', icon: TrendingUp },
  { property: properties[1], signal: 'Above estimate', detail: '₹18.0L over the sample market value', tone: 'warning', icon: CircleAlert },
  { property: properties[3], signal: 'Low risk', detail: 'No duplicate details found in sample data', tone: 'positive', icon: ShieldCheck },
];

export function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const canManage = isAuthenticated && (user.role === 'seller' || user.role === 'admin');
  const isAdmin = isAuthenticated && user.role === 'admin';
  const greeting = user?.name ? user.name.split(' ')[0] : 'there';

  return (
    <div className="dashboard-page">
      <PageIntro eyebrow="Your property intelligence" title="A clearer view of what matters." description="A considered starting point for the listings, signals, and decisions you want to keep close.">
        <div className="page-intro-meta"><span><LayoutDashboard size={14} /> Workspace preview</span><span className="preview-chip preview-chip-light"><span className="status-dot" /> Data is illustrative</span></div>
      </PageIntro>
      <section className="section dashboard-content-section"><div className="container">
        <Reveal>        <div className="dashboard-welcome-row"><div><span className="dashboard-greeting">Good morning, <strong>{greeting}.</strong></span><p>Here’s the market pulse for your current view.</p></div><div className="dashboard-actions"><ButtonLink to="/explore" size="sm">Explore properties <ArrowRight size={15} /></ButtonLink>{!authLoading && isAdmin ? <ButtonLink to="/analytics" variant="secondary" size="sm"><BarChart3 size={15} /> Live analytics</ButtonLink> : null}<div className="notification-wrap"><button type="button" className="icon-button" aria-label="Notifications preview" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={17} /><span className="notification-dot" /></button>{notificationsOpen && <div className="notification-popover" role="status"><span className="notification-popover-icon"><Sparkles size={14} /></span><div><strong>Nothing urgent here</strong><p>Signal updates will appear in this space once live data is connected.</p></div></div>}</div></div></div></Reveal>
        <div className="dashboard-metrics-grid"><MetricCard label="Average property price" value={formatCompactCurrency(analytics.averagePrice)} change={analytics.change.averagePrice} note="vs. previous period" icon={BarChart3} tone="positive" /><MetricCard label="Average price / sq.ft." value={formatCurrency(analytics.averagePricePerSqft)} change={analytics.change.averagePricePerSqft} note="across your view" icon={TrendingUp} tone="positive" /><MetricCard label="Listing volume" value={formatNumber(analytics.listingVolume)} change={analytics.change.listingVolume} note="last 30 days" icon={MapPin} tone="positive" /><MetricCard label="Flagged listings" value={formatNumber(analytics.flaggedListings)} change={analytics.change.flaggedListings} note="needs a closer look" icon={Flag} tone="positive" /></div>
        {!authLoading && canManage ? <PropertyManager user={user} /> : null}
        {!authLoading && !canManage ? (
          <Reveal>
            <div className="dashboard-next-card">
              <div className="dashboard-next-icon"><Lock size={20} /></div>
              <div>
                <p className="eyebrow">Seller workspace</p>
                <h2>Publish and manage your own listings.</h2>
                <p>{isAuthenticated ? 'Listing management is available to seller and admin accounts.' : 'Sign in with a seller account to publish properties, update asking prices, and manage your listing status.'}</p>
              </div>
              <ButtonLink to={isAuthenticated ? '/explore' : '/signin'} variant="secondary">{isAuthenticated ? 'Browse listings' : 'Sign in to continue'} <ArrowRight size={16} /></ButtonLink>
            </div>
          </Reveal>
        ) : null}
        <div className="dashboard-main-grid">
          <Reveal className="dashboard-chart-card"><div className="dashboard-card-heading"><div><p className="eyebrow">Market movement</p><h2>A steady upward signal</h2></div><span className="select-like">Last 12 months <span>⌄</span></span></div><div className="dashboard-chart-summary"><strong>+12.6%</strong><span>listing activity</span></div><div className="dashboard-chart"><div className="chart-y-labels"><span>1.4k</span><span>1.0k</span><span>600</span><span>200</span></div><div className="chart-plot"><div className="chart-grid-lines"><i /><i /><i /><i /></div><div className="chart-bars">{[38, 48, 43, 56, 52, 65, 61, 73, 70, 82, 78, 92].map((height, index) => <span key={`${height}-${index}`} style={{ height: `${height}%` }}><i /></span>)}</div><div className="chart-x-labels"><span>Jan</span><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span><span>Nov</span></div></div></div></Reveal>
          <Reveal className="dashboard-health-card" delay={0.1}><div className="dashboard-card-heading"><div><p className="eyebrow">Your signal mix</p><h2>Context at a glance</h2></div><Sparkles size={18} className="card-heading-sparkle" /></div><div className="health-ring-wrap"><div className="health-ring"><div><strong>82</strong><span>signal score</span></div></div><p>Most of your sample view is within a useful market range.</p></div><div className="health-legend"><span><i className="legend-dot legend-dot-green" /> In range <strong>74%</strong></span><span><i className="legend-dot legend-dot-yellow" /> Review <strong>18%</strong></span><span><i className="legend-dot legend-dot-grey" /> Other <strong>8%</strong></span></div></Reveal>
        </div>
        <Reveal className="activity-card" delay={0.12}><div className="dashboard-card-heading"><div><p className="eyebrow">Recent signals</p><h2>Worth a closer look.</h2></div><ButtonLink to="/explore" variant="text">View properties <ArrowRight size={15} /></ButtonLink></div><div className="activity-list">{activity.map(({ property, signal, detail, tone, icon: Icon }) => <div className="activity-row" key={property.id}><span className={`activity-icon activity-icon-${tone}`}><Icon size={17} /></span><div className="activity-property"><strong>{property.title}</strong><span><MapPin size={13} /> {property.locality}, {property.city}</span></div><div className="activity-signal"><strong className={tone === 'warning' ? 'text-warning' : 'text-positive'}>{signal}</strong><span>{detail}</span></div><span className="activity-time"><Clock3 size={13} /> Today</span><ArrowRight size={16} className="activity-arrow" /></div>)}</div></Reveal>
        <div className="dashboard-next-card"><div className="dashboard-next-icon"><FileSearch size={20} /></div><div><p className="eyebrow">Coming into focus</p><h2>Your next insight is waiting.</h2><p>Save a property and PropIQ will help you compare its context over time.</p></div><ButtonLink to="/explore" variant="secondary">Find a property <ArrowRight size={16} /></ButtonLink></div>
        <div className="dashboard-footnote"><Check size={14} /> {isAdmin ? 'The charts above are illustrative previews. Live figures computed from the listings are on the analytics page.' : canManage ? 'Analytics above are illustrative previews. Your listings below are live data.' : 'No authentication or persistent data is connected in Phase 1.'}</div>
      </div></section>
    </div>
  );
}
