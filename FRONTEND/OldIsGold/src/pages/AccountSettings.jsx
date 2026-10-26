import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthField from '../components/AuthField'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { useAuth } from '../context/useAuth'
import { authSecurityApi } from '../services/api'

function AccountSettings() {
  const { user, token, loading, updateAuthenticatedUser, updateCurrentUser, logout } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState({ name: user?.name || '', college: user?.college || '' })
  const [password, setPassword] = useState({ currentPassword: '', password: '', confirmPassword: '' })
  const [profileMessage, setProfileMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [googleCredential, setGoogleCredential] = useState('')
  const [deactivationPassword, setDeactivationPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <section className="form-panel auth-panel"><p role="status">Loading account settings…</p></section>
  if (!user || !token) return <Navigate to="/login" replace state={{ from: '/settings' }} />

  const saveProfile = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setProfileMessage('')
    setFieldErrors({})
    try {
      const result = await authSecurityApi.updateProfile(token, profile)
      updateCurrentUser(result.user)
      setProfileMessage('Your profile has been updated.')
    } catch (requestError) {
      setError(requestError.message)
      setFieldErrors(requestError.errors || {})
    } finally {
      setSubmitting(false)
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setPasswordMessage('')
    setFieldErrors({})
    try {
      const result = await authSecurityApi.changePassword(token, {
        ...password,
        ...(!user.hasPassword ? { googleCredential } : {}),
      })
      updateAuthenticatedUser(result)
      setPassword({ currentPassword: '', password: '', confirmPassword: '' })
      setPasswordMessage(result.message)
    } catch (requestError) {
      setError(requestError.message)
      setFieldErrors(requestError.errors || {})
    } finally {
      setSubmitting(false)
    }
  }

  const deactivate = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setFieldErrors({})
    try {
      await authSecurityApi.deactivate(token, {
        confirmation,
        ...(user.hasPassword ? { password: deactivationPassword } : { googleCredential }),
      })
      await logout()
      navigate('/login', { replace: true, state: { accountDeactivated: true } })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return <section className="account-settings">
    <header className="settings-heading"><div><p className="eyebrow">Your account</p><h1>Account settings</h1><p>Manage your profile, sign-in security, and account access.</p></div><Link className="secondary-button" to="/profile">Back to profile</Link></header>

    <section className="settings-card" aria-labelledby="settings-profile-title">
      <div><h2 id="settings-profile-title">Profile information</h2><p>Update the name and college shown on your profile.</p></div>
      <form className="form-stack auth-form" onSubmit={saveProfile} noValidate>
        <AuthField label="Full name" name="settings-name" autoComplete="name" minLength={2} maxLength={80} required value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} error={fieldErrors.name} />
        <AuthField label="College or university" name="settings-college" autoComplete="organization" minLength={2} maxLength={120} required value={profile.college} onChange={(event) => setProfile({ ...profile, college: event.target.value })} error={fieldErrors.college} />
        <p className="settings-readonly">Email address: <strong>{user.email}</strong> <span>{user.isVerified ? 'Verified' : 'Not verified'}</span></p>
        {profileMessage && <p className="form-success" role="status">{profileMessage}</p>}
        <button className="primary-button" type="submit" disabled={submitting}>Save profile</button>
      </form>
    </section>

    <section className="settings-card" aria-labelledby="settings-password-title">
      <div><h2 id="settings-password-title">{user.hasPassword ? 'Change password' : 'Add a password'}</h2><p>{user.hasPassword ? 'Changing your password signs out other active sessions.' : 'Add a password so you can also sign in with your email.'}</p></div>
      <form className="form-stack auth-form" onSubmit={changePassword} noValidate>
        {user.hasPassword && <AuthField label="Current password" name="current-password" type="password" autoComplete="current-password" required value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} error={fieldErrors.currentPassword} />}
        {!user.hasPassword && <><p className="form-copy">Confirm your Google account to add a password.</p><GoogleSignInButton onCredential={setGoogleCredential} disabled={submitting} /></>}
        <AuthField label="New password" name="settings-new-password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={password.password} onChange={(event) => setPassword({ ...password, password: event.target.value })} error={fieldErrors.password} />
        <AuthField label="Confirm new password" name="settings-confirm-password" type="password" autoComplete="new-password" maxLength={72} required value={password.confirmPassword} onChange={(event) => setPassword({ ...password, confirmPassword: event.target.value })} error={fieldErrors.confirmPassword} />
        {passwordMessage && <p className="form-success" role="status">{passwordMessage}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={submitting || (!user.hasPassword && !googleCredential)}>{submitting ? 'Updating…' : 'Update password'}</button>
      </form>
    </section>

    <section className="settings-card danger-zone" aria-labelledby="settings-deactivate-title">
      <div><h2 id="settings-deactivate-title">Deactivate account</h2><p>Deactivation blocks future sign-ins and invalidates existing sessions. Your marketplace records may remain visible to preserve transaction history.</p></div>
      <form className="form-stack auth-form" onSubmit={deactivate} noValidate>
        {user.hasPassword
          ? <AuthField label="Confirm your password" name="deactivate-password" type="password" autoComplete="current-password" required value={deactivationPassword} onChange={(event) => setDeactivationPassword(event.target.value)} />
          : <><p className="form-copy">Confirm your Google identity to continue.</p><GoogleSignInButton onCredential={setGoogleCredential} disabled={submitting} /></>}
        <AuthField label={'Type DELETE to confirm'} name="deactivate-confirmation" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="danger-button" type="submit" disabled={submitting || confirmation !== 'DELETE' || (!user.hasPassword && !googleCredential)}>{submitting ? 'Deactivating…' : 'Deactivate my account'}</button>
      </form>
    </section>
  </section>
}

export default AccountSettings
