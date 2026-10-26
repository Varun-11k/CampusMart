import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthField from '../components/AuthField'
import { authSecurityApi } from '../services/api'

function ResetPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') || '')
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (token) navigate('/reset-password', { replace: true })
  }, [navigate, token])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setErrors({})
    if (form.password !== form.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match.' })
      return
    }
    setSubmitting(true)
    try {
      const result = await authSecurityApi.resetPassword({ ...form, token })
      setSuccess(true)
      setError(result.message)
    } catch (requestError) {
      setErrors(requestError.errors || {})
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return <section className="form-panel auth-panel">
    <p className="eyebrow">Account recovery</p>
    <h1>Choose a new password</h1>
    {success ? <div className="form-success" role="status"><p>{error}</p><Link className="primary-button" to="/login">Continue to log in</Link></div>
      : !token ? <div className="form-error" role="alert"><p>This reset link is missing or has expired.</p><Link to="/forgot-password">Request another reset link</Link></div>
        : <form className="form-stack auth-form" onSubmit={submit} noValidate>
          <p className="form-copy">Use at least 12 characters and choose a password you don’t use elsewhere.</p>
          <AuthField label="New password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} error={errors.password} />
          <AuthField label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required maxLength={72} value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} error={errors.confirmPassword} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Updating password…' : 'Reset password'}</button>
        </form>}
  </section>
}

export default ResetPassword
