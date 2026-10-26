import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthField from '../components/AuthField'
import { useAuth } from '../context/useAuth'
import { authSecurityApi } from '../services/api'

function VerifyEmail() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [verificationToken] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') || '')
  const processedRef = useRef(false)
  const [email, setEmail] = useState(user?.email || '')
  const [status, setStatus] = useState(verificationToken ? 'verifying' : 'pending')
  const [message, setMessage] = useState(location.state?.verificationEmailSent === false
    ? 'Your account is ready, but verification email delivery is not configured yet.'
    : 'Check your inbox for a verification link. You can continue using CampusMart while your email is unverified.')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!verificationToken || processedRef.current) return undefined
    processedRef.current = true
    navigate('/verify-email', { replace: true })
    let active = true
    authSecurityApi.verifyEmail(verificationToken).then((result) => {
      if (active) {
        setStatus('verified')
        setMessage(result.message)
      }
    }).catch((requestError) => {
      if (active) {
        setStatus('error')
        setError(requestError.message)
      }
    })
    return () => { active = false }
  }, [navigate, verificationToken])

  const resend = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await authSecurityApi.resendVerification(email)
      setMessage(result.message)
      setStatus('sent')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return <section className="form-panel auth-panel">
    <p className="eyebrow">Email verification</p>
    <h1>{status === 'verified' ? 'You’re verified' : 'Verify your email'}</h1>
    {status === 'verifying' ? <p className="form-copy" role="status">Checking your verification link…</p>
      : status === 'verified' ? <div className="form-success" role="status"><p>{message}</p><Link className="primary-button" to="/home">Continue to CampusMart</Link></div>
        : <><p className={status === 'error' ? 'form-error' : 'form-copy'} role={status === 'error' ? 'alert' : 'status'}>{status === 'error' ? error : message}</p>
          <form className="form-stack auth-form" onSubmit={resend} noValidate>
            <AuthField label="Email address" name="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} />
            {error && status !== 'error' && <p className="form-error" role="alert">{error}</p>}
            <button className="secondary-button" type="submit" disabled={submitting || !email}>{submitting ? 'Sending…' : 'Resend verification email'}</button>
          </form>
          <p className="auth-switch"><Link to="/profile">Back to your account</Link></p>
        </>}
  </section>
}

export default VerifyEmail
