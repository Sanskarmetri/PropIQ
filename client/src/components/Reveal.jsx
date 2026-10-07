import { motion, useReducedMotion } from 'framer-motion';

export function Reveal({ children, delay = 0, className = '', ...props }) {
  const reduceMotion = useReducedMotion();
  const hidden = reduceMotion ? { opacity: 1 } : { opacity: 0, y: 22 };

  return (
    <motion.div
      className={className}
      initial={hidden}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: reduceMotion ? 0 : 0.65, delay: reduceMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
