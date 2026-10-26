import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthField from '../components/AuthField'
import { authSecurityApi } from '../services/api'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setSubmitting(true)
    try {
      await authSecurityApi.forgotPassword(email)
      setSent(true)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return <section className="form-panel auth-panel">
    <p className="eyebrow">Account recovery</p>
    <h1>Forgot your password?</h1>
    <p className="form-copy">Enter the email address on your account. We’ll send a reset link if an account matches.</p>
    {sent ? <div className="form-success" role="status"><strong>Check your inbox.</strong><p>If an account matches that email, password reset instructions will be sent.</p><p>For your privacy, we show the same message whether an account exists or not.</p></div>
      : <form className="form-stack auth-form" onSubmit={submit} noValidate>
        <AuthField label="Email address" name="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Send reset link'}</button>
      </form>}
    <p className="auth-switch"><Link to="/login">Back to log in</Link></p>
  </section>
}

export default ForgotPassword
