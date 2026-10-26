import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthField from '../components/AuthField'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { useAuth } from '../context/useAuth'

function Login() {
  const { login, googleLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const destinationFor = (account) => {
    const requestedPath = location.state?.from
    return account?.role === 'admin'
      ? (requestedPath?.startsWith('/admin') ? requestedPath : '/admin')
      : (requestedPath && !requestedPath.startsWith('/admin') ? requestedPath : '/home')
  }

  const submit = async (event) => {
    event.preventDefault()
    setErrors({})
    setError('')
    const validation = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) validation.email = 'Enter a valid email address.'
    if (!form.password) validation.password = 'Enter your password.'
    if (Object.keys(validation).length) {
      setErrors(validation)
      return
    }
    setSubmitting(true)
    try {
      const account = await login({ email: form.email, password: form.password })
      navigate(destinationFor(account), { replace: true })
    } catch (requestError) {
      setErrors(requestError.errors || {})
      setError(requestError.status === 401 ? 'The email or password is incorrect.' : requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const submitGoogleCredential = async (credential) => {
    setSubmitting(true)
    setErrors({})
    setError('')
    try {
      const account = await googleLogin(credential)
      navigate(destinationFor(account), { replace: true })
    } catch (requestError) {
      setErrors(requestError.errors || {})
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return <section className="form-panel auth-panel">
    <p className="eyebrow">Welcome back</p>
    <h1>Log in</h1>
    <p className="form-copy">Sign in to your CampusMart account to manage listings and messages.</p>
    <form className="form-stack auth-form" onSubmit={submit} noValidate>
      <AuthField label="Email address" name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} error={errors.email} />
      <AuthField label="Password" name="password" type="password" autoComplete="current-password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} error={errors.password} />
      <div className="auth-form-options">
        <span className="remember-me">Sign-in lasts for this browser session</span>
        <Link to="/forgot-password">Forgot password?</Link>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Log in'}</button>
    </form>
    <div className="auth-divider"><span>or continue with</span></div>
    <GoogleSignInButton onCredential={submitGoogleCredential} disabled={submitting} />
    <p className="auth-switch">New to CampusMart? <Link to="/register">Create an account</Link></p>
  </section>
}

export default Login
