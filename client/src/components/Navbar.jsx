import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowUpRight, Menu, Sparkles, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

const navItems = [
  { label: 'Explore', to: '/explore' },
  { label: 'Valuation', to: '/valuation' },
  { label: 'Insights', to: '/dashboard' },
  // Analytics is an admin surface: the link only appears for an admin session,
  // and the server checks the same role on every analytics request.
  { label: 'Analytics', to: '/analytics', adminOnly: true },
];

export function Navbar() {
  const { isAuthenticated, role } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const visibleItems = navItems.filter((item) => !item.adminOnly || (isAuthenticated && role === 'admin'));

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 12);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  const closeMenu = () => setMenuOpen(false);
  const glassActive = scrolled || menuOpen;

  return (
    <header className={`site-header ${glassActive ? 'site-header-scrolled' : ''}`.trim()}>
      <div className="container navbar-inner">
        <Link to="/" className="brand" aria-label="PropIQ home" onClick={closeMenu}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-word">Prop<span>IQ</span></span>
        </Link>
        <nav className={`main-nav ${menuOpen ? 'main-nav-open' : ''}`} aria-label="Primary navigation">
          <div className="nav-links">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`.trim()}
                onClick={closeMenu}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="nav-actions">
            <Link to="/login" className="nav-login" onClick={closeMenu}>Log in</Link>
            <Link to="/register" className="button button-dark button-sm" onClick={closeMenu}>
              Get started <ArrowUpRight size={15} strokeWidth={1.8} />
            </Link>
          </div>
        </nav>
        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <div className="nav-status-line" aria-hidden="true">
        <span><Sparkles size={12} /> Intelligence for better property decisions</span>
      </div>
    </header>
  );
}
