import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthField from '../components/AuthField'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { useAuth } from '../context/useAuth'

const passwordChecks = [
  { label: '12 or more characters', test: (value) => value.length >= 12 },
  { label: 'Upper- and lowercase letters', test: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { label: 'A number', test: (value) => /\d/.test(value) },
  { label: 'A symbol', test: (value) => /[^A-Za-z0-9]/.test(value) },
]

function Register() {
  const { register, googleLogin } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', college: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const strength = useMemo(() => passwordChecks.filter((check) => check.test(form.password)).length, [form.password])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setErrors({})
    const validation = {}
    if (form.name.trim().length < 2 || form.name.trim().length > 80) validation.name = 'Enter a name between 2 and 80 characters.'
    if (form.college.trim().length < 2 || form.college.trim().length > 120) validation.college = 'Enter a college or university between 2 and 120 characters.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) validation.email = 'Enter a valid email address.'
    if (form.password.length < 12 || new TextEncoder().encode(form.password).length > 72) validation.password = 'Use at least 12 characters and no more than 72 UTF-8 bytes.'
    if (form.password !== form.confirmPassword) {
      validation.confirmPassword = 'Passwords do not match.'
    }
    if (Object.keys(validation).length) {
      setErrors(validation)
      return
    }
    setSubmitting(true)
    try {
      const result = await register(form)
      navigate('/verify-email', { replace: true, state: { verificationEmailSent: result.verificationEmailSent } })
    } catch (requestError) {
      setErrors(requestError.errors || {})
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const submitGoogleCredential = async (credential) => {
    setSubmitting(true)
    setErrors({})
    setError('')
    try {
      await googleLogin(credential, form.college)
      navigate('/home', { replace: true })
    } catch (requestError) {
      setErrors(requestError.errors || {})
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return <section className="form-panel auth-panel">
    <p className="eyebrow">Join your campus</p>
    <h1>Create your account</h1>
    <p className="form-copy">Connect with your college community to buy, sell, share, and help each other out.</p>
    <form className="form-stack auth-form" onSubmit={submit} noValidate>
      <AuthField label="Full name" name="name" autoComplete="name" required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} error={errors.name} />
      <AuthField label="College or university" name="college" autoComplete="organization" required minLength={2} maxLength={120} value={form.college} onChange={(event) => setForm({ ...form, college: event.target.value })} error={errors.college} />
      <AuthField label="Email address" name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} error={errors.email} />
      <AuthField label="Password" name="password" type="password" autoComplete="new-password" required maxLength={72} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} error={errors.password} />
      <div className="password-strength" aria-live="polite" aria-label={`Password strength: ${strength < 2 ? 'weak' : strength < 4 ? 'good' : 'strong'}`}>
        <div className="strength-meter" aria-hidden="true"><span data-strength={strength} /></div>
        <ul>{passwordChecks.map((check) => <li className={check.test(form.password) ? 'is-met' : ''} key={check.label}><span aria-hidden="true">{check.test(form.password) ? '✓' : '○'}</span>{check.label}</li>)}</ul>
      </div>
      <AuthField label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" required maxLength={72} value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} error={errors.confirmPassword} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'}</button>
    </form>
    <div className="auth-divider"><span>or create an account with</span></div>
    <GoogleSignInButton onCredential={submitGoogleCredential} disabled={submitting || form.college.trim().length < 2} />
    <p className="auth-provider-note">Google sign-up also needs your college name above. Your college email domain is not used as proof of enrollment.</p>
    <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
  </section>
}

export default Register
