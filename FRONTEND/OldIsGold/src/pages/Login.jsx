import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

function Login() {
	const { login } = useAuth()
	const navigate = useNavigate()
	const location = useLocation()
	const [form, setForm] = useState({ email: '', password: '' })
	const [error, setError] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const submit = async (event) => { event.preventDefault(); setError(''); setSubmitting(true); try { const account = await login(form); const requestedPath = location.state?.from; const destination = account?.role === 'admin' ? (requestedPath?.startsWith('/admin') ? requestedPath : '/admin') : (requestedPath && !requestedPath.startsWith('/admin') ? requestedPath : '/home'); navigate(destination, { replace: true }) } catch (requestError) { setError(requestError.message) } finally { setSubmitting(false) } }
	return <section className="form-panel"><p className="eyebrow">Welcome back</p><h1>Log in</h1><p className="form-copy">Use your CampusMart account to manage listings and messages.</p><form className="form-stack" onSubmit={submit}><label>Email address<input type="email" name="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Password<input type="password" name="password" autoComplete="current-password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Logging in...' : 'Log in'}</button></form></section>
}
export default Login
