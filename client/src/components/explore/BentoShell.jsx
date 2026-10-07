import { motion, useReducedMotion } from 'framer-motion';

/**
 * The surface every bento tile is built on: one shared entrance, one shared
 * spring on hover, and the card chrome itself.
 */
export function BentoShell({ delay = 0, className = '', children, ...props }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className={`bento-card ${className}`.trim()}
      initial={reduceMotion ? false : { opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -6, scale: 1.008, transition: { type: 'spring', stiffness: 320, damping: 30, mass: 0.7 } }
      }
      {...props}
    >
      {children}
    </motion.section>
  );
}

export default BentoShell;
