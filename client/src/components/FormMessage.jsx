import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function FormMessage({ children, type = 'error' }) {
  if (!children) return null;
  const isSuccess = type === 'success';
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;

  return (
    <div className={`form-message form-message-${type}`} role="status">
      <Icon size={16} strokeWidth={1.9} />
      <span>{children}</span>
    </div>
  );
}
