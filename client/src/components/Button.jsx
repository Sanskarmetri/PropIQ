import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';

const buttonClasses = {
  primary: 'button button-primary',
  secondary: 'button button-secondary',
  dark: 'button button-dark',
  ghost: 'button button-ghost',
  text: 'button button-text',
};

const sizeClasses = {
  sm: 'button-sm',
  md: 'button-md',
  lg: 'button-lg',
};

const MotionLink = motion.create(Link);

function useButtonMotion() {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return {
      whileHover: undefined,
      whileTap: { scale: 0.99 },
      transition: { duration: 0 },
    };
  }

  return {
    whileHover: { y: -2 },
    whileTap: { scale: 0.97 },
    transition: { type: 'spring', stiffness: 420, damping: 26, mass: 0.6 },
  };
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  disabled = false,
  ...props
}) {
  const motionProps = useButtonMotion();
  const interactiveMotionProps = disabled ? { ...motionProps, whileHover: undefined } : motionProps;

  return (
    <motion.button
      type={type}
      disabled={disabled}
      className={`${buttonClasses[variant] || buttonClasses.primary} ${sizeClasses[size] || sizeClasses.md} ${className}`.trim()}
      {...interactiveMotionProps}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function ButtonLink({ children, to, variant = 'primary', size = 'md', className = '', ...props }) {
  const motionProps = useButtonMotion();

  return (
    <MotionLink
      to={to}
      className={`${buttonClasses[variant] || buttonClasses.primary} ${sizeClasses[size] || sizeClasses.md} ${className}`.trim()}
      {...motionProps}
      {...props}
    >
      {children}
    </MotionLink>
  );
}
