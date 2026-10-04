import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

function Register() {
	const { register } = useAuth()
	const navigate = useNavigate()
	const [form, setForm] = useState({ name: '', email: '', password: '', college: '' })
	const [error, setError] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const submit = async (event) => { event.preventDefault(); setError(''); setSubmitting(true); try { await register(form); navigate('/home') } catch (requestError) { setError(requestError.message) } finally { setSubmitting(false) } }
	return <section className="form-panel"><p className="eyebrow">Join your campus</p><h1>Create your account</h1><p className="form-copy">Create an account to buy and sell with your campus community.</p><form className="form-stack" onSubmit={submit}><label>Full name<input type="text" name="name" autoComplete="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>College or university<input type="text" name="college" autoComplete="organization" required value={form.college} onChange={(event) => setForm({ ...form, college: event.target.value })} /></label><label>College email<input type="email" name="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Password<input type="password" name="password" autoComplete="new-password" minLength="8" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Creating account...' : 'Create account'}</button></form></section>
}
export default Register
