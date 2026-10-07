import { useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell.jsx';
import { Button } from '../components/Button.jsx';
import { FormMessage } from '../components/FormMessage.jsx';
import { useAuth } from '../context/AuthContext.js';

const PASSWORD_MAX_LENGTH = 72;

export function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'buyer' });
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState({ type: 'success', text: '' });
  const [accepted, setAccepted] = useState(false);
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
    if (form.name.trim().length < 2) nextErrors.name = 'Tell us your name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.';
    if (form.password.length < 8) nextErrors.password = 'Use at least 8 characters for your password.';
    if (form.password.length > PASSWORD_MAX_LENGTH) nextErrors.password = `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;
    if (form.confirmPassword !== form.password) nextErrors.confirmPassword = 'Passwords need to match.';
    if (!accepted) nextErrors.accepted = 'Please accept the terms to continue.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setFeedback({ type: 'success', text: '' });
    try {
      const payload = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      setForm({ name: '', email: '', password: '', confirmPassword: '', role: 'buyer' });
      setAccepted(false);
      setFeedback({ type: 'success', text: `${payload.message} You can sign in with those details now.` });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell eyebrow="Start with clarity" title="Build your own property brief." description="Create a PropIQ workspace for the places, prices, and questions you want to keep close." asideTitle="A more informed way to move." asideBody="Bring the scattered details of a property search into one considered, easy-to-return-to place." asidePoints={['Understand a price beyond the listing', 'Keep important context in one place', 'Make every next step more intentional']}>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field"><label htmlFor="register-name">Full name</label><input id="register-name" name="name" type="text" autoComplete="name" value={form.name} onChange={updateField} placeholder="Your name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'register-name-error' : undefined} />{errors.name && <span className="field-error" id="register-name-error">{errors.name}</span>}</div>
        <div className="form-field"><label htmlFor="register-role">I am joining as</label><select id="register-role" name="role" value={form.role} onChange={updateField}><option value="buyer">A buyer or renter</option><option value="seller">A seller or owner</option></select></div>
        <div className="form-field"><label htmlFor="register-email">Email address</label><input id="register-email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} placeholder="you@example.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'register-email-error' : undefined} />{errors.email && <span className="field-error" id="register-email-error">{errors.email}</span>}</div>
        <div className="form-field"><label htmlFor="register-password">Create a password</label><div className="password-input-wrap"><input id="register-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={updateField} placeholder="At least 8 characters" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'register-password-error' : undefined} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <span className="field-error" id="register-password-error">{errors.password}</span>}</div>
        <div className="form-field"><label htmlFor="register-confirm">Confirm password</label><input id="register-confirm" name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={updateField} placeholder="Repeat your password" aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? 'register-confirm-error' : undefined} />{errors.confirmPassword && <span className="field-error" id="register-confirm-error">{errors.confirmPassword}</span>}</div>
        <div className="checkbox-field"><input id="accept-terms" type="checkbox" checked={accepted} onChange={(event) => { setAccepted(event.target.checked); setErrors((current) => ({ ...current, accepted: '' })); }} /><label htmlFor="accept-terms">I agree to the future PropIQ terms and privacy policy.</label></div>
        {errors.accepted && <span className="field-error checkbox-error">{errors.accepted}</span>}
        <FormMessage type={feedback.type}>{feedback.text}</FormMessage>
        <Button type="submit" size="lg" className="auth-submit" disabled={submitting} aria-busy={submitting}>{submitting ? 'Creating your workspace…' : 'Create my workspace'} {!submitting && <ArrowRight size={17} />}</Button>
      </form>
      <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
    </AuthShell>
  );
}
