export function PageIntro({ eyebrow, title, description, children, className = '' }) {
  return (
    <section className={`page-intro ${className}`.trim()}>
      <div className="container page-intro-inner">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-intro-description">{description}</p>}
        {children}
      </div>
    </section>
  );
}
