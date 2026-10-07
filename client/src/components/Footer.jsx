import { ArrowUpRight, Linkedin, Twitter } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-brand-column">
          <Link to="/" className="brand brand-footer" aria-label="PropIQ home">
            <span className="brand-mark" aria-hidden="true"><span /></span>
            <span className="brand-word">Prop<span>IQ</span></span>
          </Link>
          <p>Clarity for every property decision.</p>
        </div>
        <div className="footer-links-grid">
          <div className="footer-link-group">
            <span className="footer-link-title">Product</span>
            <Link to="/explore">Explore properties</Link>
            <Link to="/valuation">Valuation preview</Link>
            <Link to="/dashboard">Insights dashboard</Link>
          </div>
          <div className="footer-link-group">
            <span className="footer-link-title">Account</span>
            <Link to="/login">Log in</Link>
            <Link to="/register">Create an account</Link>
            <Link to="/dashboard">Workspace</Link>
          </div>
          <div className="footer-link-group">
            <span className="footer-link-title">Stay curious</span>
            <p className="footer-note">A considered view of the market, without the noise.</p>
            <div className="footer-socials">
              <a href="https://www.linkedin.com" aria-label="PropIQ on LinkedIn"><Linkedin size={16} /></a>
              <a href="https://twitter.com" aria-label="PropIQ on X"><Twitter size={16} /></a>
              <a href="mailto:hello@propiq.example" aria-label="Email PropIQ"><ArrowUpRight size={16} /></a>
            </div>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} PropIQ</span>
        <span>Built for clearer decisions.</span>
      </div>
    </footer>
  );
}
