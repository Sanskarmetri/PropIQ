import { ArrowLeft, ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AuthShell({ eyebrow, title, description, children, asideTitle, asideBody, asidePoints }) {
  return (
    <section className="auth-page">
      <div className="container auth-grid">
        <div className="auth-form-column">
          <Link to="/" className="back-home-link"><ArrowLeft size={15} /> Back to PropIQ</Link>
          <div className="auth-form-wrap">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1><p className="auth-description">{description}</p>{children}</div>
        </div>
        <div className="auth-aside">
          <div className="auth-ambient" aria-hidden="true">
            <span className="auth-ambient-orb auth-ambient-orb-lime" />
            <span className="auth-ambient-orb auth-ambient-orb-green" />
          </div>
          <div className="auth-aside-top"><span className="brand-mark" aria-hidden="true"><span /></span><span className="brand-word">Prop<span>IQ</span></span></div>
          <div className="auth-aside-content"><span className="auth-aside-icon"><Sparkles size={20} /></span><p className="eyebrow eyebrow-light">A better property brief</p><h2>{asideTitle}</h2><p>{asideBody}</p><ul>{asidePoints.map((point) => <li key={point}><span><ShieldCheck size={14} /></span>{point}</li>)}</ul></div>
          <div className="auth-aside-footer"><span>Property intelligence, with a human point of view.</span><ArrowUpRight size={17} /></div>
        </div>
      </div>
    </section>
  );
}
