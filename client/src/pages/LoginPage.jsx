import { useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell.jsx';
import { Button } from '../components/Button.jsx';
import { FormMessage } from '../components/FormMessage.jsx';
import { useAuth } from '../context/AuthContext.js';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState({ type: 'success', text: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setFeedback({ type: 'success', text: '' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.';
    if (form.password.length < 8) nextErrors.password = 'Use at least 8 characters for your password.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setFeedback({ type: 'success', text: '' });
    try {
      await login({ email: form.email.trim(), password: form.password });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message });
      setSubmitting(false);
    }
  };

  return (
    <AuthShell eyebrow="Welcome back" title="Your property workspace, when you need it." description="Sign in to keep your watchlist and valuation history close at hand." asideTitle="Good decisions deserve a calm place to live." asideBody="PropIQ is being shaped into a focused workspace for the moments that matter: shortlisting, checking, and deciding." asidePoints={['Keep a thoughtful shortlist', 'Return to saved property context', 'See valuation changes over time']}>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field"><label htmlFor="login-email">Email address</label><input id="login-email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} placeholder="you@example.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'login-email-error' : undefined} />{errors.email && <span className="field-error" id="login-email-error">{errors.email}</span>}</div>
        <div className="form-field"><div className="label-row"><label htmlFor="login-password">Password</label><button type="button" className="forgot-link" onClick={() => setFeedback({ type: 'success', text: 'Password recovery is not available yet.' })}>Forgot password?</button></div><div className="password-input-wrap"><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={updateField} placeholder="Enter your password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'login-password-error' : undefined} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <span className="field-error" id="login-password-error">{errors.password}</span>}</div>
        <FormMessage type={feedback.type}>{feedback.text}</FormMessage>
        <Button type="submit" size="lg" className="auth-submit" disabled={submitting} aria-busy={submitting}>{submitting ? 'Signing in…' : 'Continue to workspace'} {!submitting && <ArrowRight size={17} />}</Button>
      </form>
      <p className="auth-switch">New to PropIQ? <Link to="/register">Create an account</Link></p>
    </AuthShell>
  );
}
