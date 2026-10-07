export function SectionHeading({ eyebrow, title, description, align = 'left', className = '' }) {
  return (
    <div className={`section-heading section-heading-${align} ${className}`.trim()}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {description && <p className="section-heading-description">{description}</p>}
    </div>
  );
}
