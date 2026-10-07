import { ArrowLeft, Compass, Home } from 'lucide-react';
import { ButtonLink } from '../components/Button.jsx';

export function NotFoundPage() {
  return (
    <section className="section not-found-page"><div className="container not-found-inner"><div className="not-found-code">404</div><div className="not-found-icon"><Compass size={24} /></div><p className="eyebrow">A small detour</p><h1>This page is not on the map.</h1><p>The link may be out of date, or the page may still be taking shape. Let’s get you back somewhere useful.</p><div className="not-found-actions"><ButtonLink to="/"><Home size={16} /> Go home</ButtonLink><ButtonLink to="/explore" variant="secondary"><ArrowLeft size={16} /> Explore properties</ButtonLink></div></div></section>
  );
}
