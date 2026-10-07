import { motion, useReducedMotion } from 'framer-motion';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const line = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

/**
 * Editorial opening for Explore: type, whitespace and the live-data promise,
 * with no dashboard chrome around it.
 */
export function ExploreHero({ total, cityCount }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="explore-hero">
      <div className="explore-hero-wash" aria-hidden="true" />
      <motion.div
        className="container explore-hero-inner"
        variants={reduceMotion ? undefined : container}
        initial={reduceMotion ? undefined : 'hidden'}
        animate={reduceMotion ? undefined : 'show'}
      >
        <motion.p className="eyebrow" variants={line}>
          The market, made legible
        </motion.p>
        <motion.h1 variants={line}>Explore Properties</motion.h1>
        <motion.p className="explore-hero-description" variants={line}>
          Discover live PropIQ listings in one place. Every home below is read straight from the API, so the
          price, the space and the status you see are the ones the platform is working from right now.
        </motion.p>
        <motion.div className="explore-hero-meta" variants={line}>
          <span>
            <span className="live-indicator" /> Live listing data
          </span>
          <span className="explore-hero-meta-divider" aria-hidden="true" />
          <span>
            {total === null ? 'Loading catalogue' : `${total} listings in the catalogue`}
          </span>
          {cityCount > 0 && (
            <>
              <span className="explore-hero-meta-divider" aria-hidden="true" />
              <span>
                {cityCount} {cityCount === 1 ? 'city' : 'cities'}
              </span>
            </>
          )}
        </motion.div>
      </motion.div>
    </section>
  );
}

export default ExploreHero;
