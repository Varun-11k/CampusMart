import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import LoadingSkeletons from '../components/LoadingSkeletons'
import ProductCard from '../components/ProductCard'
import { useAuth } from '../context/useAuth'
import { authSecurityApi, engagementApi, productApi, profilePhotoApi, studentDashboardApi } from '../services/api'

const tabs = [
  ['overview', 'Overview'],
  ['listings', 'Listings'],
  ['lost-found', 'Lost & Found'],
  ['claims', 'Claims'],
  ['confessions', 'Confessions'],
]
const yearOptions = [['', 'Not specified'], ['1', 'Year 1'], ['2', 'Year 2'], ['3', 'Year 3'], ['4', 'Year 4'], ['5', 'Year 5'], ['graduate', 'Graduate'], ['other', 'Other']]
const dateLabel = (date) => date ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(date)) : '—'
const initial = (name) => name?.trim()?.charAt(0)?.toUpperCase() || 'S'
const profileFromUser = (user) => ({
  name: user?.name || '',
  college: user?.college || '',
  course: user?.course || '',
  branch: user?.branch || '',
  academicYear: user?.academicYear || '',
  themePreference: user?.themePreference || 'light',
})

function Profile() {
  const { user, token, loading: authLoading, updateCurrentUser } = useAuth()
  const [dashboard, setDashboard] = useState(null)
  const [community, setCommunity] = useState(null)
  const [loadedToken, setLoadedToken] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileDraft, setProfileDraft] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [photoError, setPhotoError] = useState('')
  const [photoProgress, setPhotoProgress] = useState(null)

  useEffect(() => {
    if (!token) return undefined
    let active = true
    Promise.all([
      studentDashboardApi.get(token),
      engagementApi.points(token).catch(() => null),
    ]).then(([data, points]) => {
      if (!active) return
      setDashboard(data)
      setCommunity(points)
      setError('')
    }).catch((requestError) => {
      if (active) {
        setDashboard(null)
        setCommunity(null)
        setError(requestError.message || 'Your dashboard could not be loaded.')
      }
    }).finally(() => {
      if (active) setLoadedToken(token)
    })
    return () => { active = false }
  }, [token])

  if (authLoading) return <section className="placeholder"><LoadingSkeletons variant="profile" count={3} label="Loading your account" /></section>
  if (!user || !token) return <Navigate to="/login" replace state={{ from: '/profile' }} />

  const activity = dashboard?.activity || { products: [], reports: [], claims: [], confessions: [] }
  const counts = dashboard?.counts || { products: 0, reports: 0, claims: 0, confessions: 0 }
  const profile = profileDraft || profileFromUser(user)
  const currentDashboardIsLoaded = loadedToken === token
  const currentActivity = currentDashboardIsLoaded ? activity : { products: [], reports: [], claims: [], confessions: [] }
  const currentCounts = currentDashboardIsLoaded ? counts : { products: 0, reports: 0, claims: 0, confessions: 0 }
  const currentTabCounts = { listings: currentCounts.products, 'lost-found': currentCounts.reports, claims: currentCounts.claims, confessions: currentCounts.confessions }
  const dashboardLoading = !currentDashboardIsLoaded
  const saveProfile = async (event) => {
    event.preventDefault()
    setSaving(true)
    setProfileMessage('')
    setError('')
    setFieldErrors({})
    try {
      const result = await authSecurityApi.updateProfile(token, profile)
      updateCurrentUser(result.user)
      setProfileDraft(null)
      setProfileMessage('Your profile has been updated.')
      setEditing(false)
    } catch (requestError) {
      setError(requestError.message)
      setFieldErrors(requestError.errors || {})
    } finally {
      setSaving(false)
    }
  }

  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Choose a JPG, PNG, or WEBP image.')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setPhotoError('Profile photos must be 3MB or smaller.')
      return
    }
    setPhotoProgress(0)
    try {
      const result = await profilePhotoApi.upload(token, file, setPhotoProgress)
      updateCurrentUser(result.user)
      setPhotoProgress(100)
    } catch (requestError) {
      setPhotoError(requestError.message)
      setPhotoProgress(null)
    }
  }

  const updateField = (event) => setProfileDraft((current) => ({ ...(current || profileFromUser(user)), [event.target.name]: event.target.value }))
  const updateListing = async (product, updates) => {
    setError('')
    try {
      const result = await productApi.update(token, product._id, updates)
      setDashboard((current) => current ? ({
        ...current,
        activity: {
          ...current.activity,
          products: current.activity.products.map((item) => item._id === product._id ? result.product : item),
        },
      }) : current)
    } catch (requestError) {
      setError(requestError.message)
    }
  }
  const deleteListing = async (product) => {
    if (!window.confirm(`Delete "${product.title}"? This cannot be undone.`)) return
    setError('')
    try {
      await productApi.remove(token, product._id)
      setDashboard((current) => current ? ({
        ...current,
        counts: { ...current.counts, products: Math.max(0, current.counts.products - 1) },
        activity: { ...current.activity, products: current.activity.products.filter((item) => item._id !== product._id) },
      }) : current)
    } catch (requestError) {
      setError(requestError.message)
    }
  }
  const showReport = (report) => (
    <article className="student-activity-row" key={report._id}>
      <div className="student-activity-image">{report.images?.[0] ? <img src={report.images[0]} alt="" /> : <span aria-hidden="true">{report.type === 'lost' ? '⌕' : '▣'}</span>}</div>
      <div className="student-activity-copy"><Link to={`/lost-found/${report._id}`}><strong>{report.title}</strong></Link><span>{report.type === 'lost' ? 'Lost item' : 'Found item'} · {dateLabel(report.date)}</span></div>
      <span className={`student-status status-${report.status}`}>{report.status}</span>
    </article>
  )

  return <section className="student-dashboard">
    <header className="student-profile-card">
      <div className="student-profile-avatar" aria-label={`${user.name}'s profile photo`}>
        {user.profileImage ? <img src={user.profileImage} alt="" /> : <span>{initial(user.name)}</span>}
      </div>
      <div className="student-profile-main">
        <p className="eyebrow">My CampusMart</p>
        <h1>{user.name}</h1>
        <p className="student-profile-campus">{[user.course, user.branch, user.college].filter(Boolean).join(' · ') || 'Campus community member'}</p>
        <p className="student-profile-since">Member since {dateLabel(user.createdAt)}</p>
        <div className="student-profile-actions">
          <label className="secondary-button student-photo-button" htmlFor="profile-photo">Update photo</label>
          <input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={photoProgress !== null && photoProgress < 100} />
          <button className="secondary-button" type="button" onClick={() => { if (editing) setProfileDraft(null); setEditing((current) => !current); setProfileMessage(''); setError('') }}>{editing ? 'Cancel edit' : 'Edit profile'}</button>
          <Link className="secondary-button" to="/settings">Security settings</Link>
        </div>
        {profileMessage && <p className="form-success" role="status">{profileMessage}</p>}
        {photoProgress !== null && <div className="student-upload-progress" role="status"><span>{photoProgress === 100 ? 'Photo updated.' : `Uploading photo: ${photoProgress}%`}</span>{photoProgress < 100 && <progress max="100" value={photoProgress} aria-label="Photo upload progress" />}</div>}
        {photoError && <p className="form-error" role="alert">{photoError}</p>}
      </div>
    </header>

    {editing && <section className="student-profile-editor" aria-labelledby="student-profile-editor-title">
      <div><p className="eyebrow">Your information</p><h2 id="student-profile-editor-title">Edit student profile</h2><p>Academic information is private to your account and is not shown on public confessions.</p></div>
      <form className="student-profile-form" onSubmit={saveProfile}>
        <label>Display name<input name="name" value={profile.name || ''} onChange={updateField} minLength={2} maxLength={80} required /></label>
        {fieldErrors.name && <span className="form-error">{fieldErrors.name}</span>}
        <label>College or campus <span>(optional)</span><input name="college" value={profile.college || ''} onChange={updateField} maxLength={120} /></label>
        {fieldErrors.college && <span className="form-error">{fieldErrors.college}</span>}
        <label>Course <span>(optional)</span><input name="course" value={profile.course || ''} onChange={updateField} maxLength={120} /></label>
        {fieldErrors.course && <span className="form-error">{fieldErrors.course}</span>}
        <label>Branch or department <span>(optional)</span><input name="branch" value={profile.branch || ''} onChange={updateField} maxLength={120} /></label>
        {fieldErrors.branch && <span className="form-error">{fieldErrors.branch}</span>}
        <label>Academic year<select name="academicYear" value={profile.academicYear || ''} onChange={updateField}>{yearOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {fieldErrors.academicYear && <span className="form-error">{fieldErrors.academicYear}</span>}
        <label>Theme preference<select name="themePreference" value={profile.themePreference || 'light'} onChange={updateField}><option value="light">Light</option><option value="dark">Dark</option></select></label>
        {fieldErrors.themePreference && <span className="form-error">{fieldErrors.themePreference}</span>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
      </form>
    </section>}

    <nav className="student-dashboard-tabs" role="tablist" aria-label="My CampusMart activity">
      {tabs.map(([id, label]) => <button key={id} id={`student-tab-${id}`} type="button" role="tab" aria-selected={activeTab === id} aria-controls={`student-panel-${id}`} onClick={() => setActiveTab(id)}>{label}<span>{currentTabCounts[id] ?? ''}</span></button>)}
    </nav>

    {currentDashboardIsLoaded && error && !editing && <div className="form-error" role="alert">{error}</div>}
    {dashboardLoading ? <section className="placeholder"><LoadingSkeletons variant="product" count={3} label="Loading your CampusMart activity" /></section> : <div id={`student-panel-${activeTab}`} role="tabpanel" aria-labelledby={`student-tab-${activeTab}`} className="student-dashboard-panel">
      {activeTab === 'overview' && <>
        <div className="student-stat-grid">
          <article><span>Listed products</span><strong>{currentCounts.products}</strong><Link to="/sell">Create a listing</Link></article>
          <article><span>Lost &amp; Found reports</span><strong>{currentCounts.reports}</strong><Link to="/lost-found/my-reports">Manage reports</Link></article>
          <article><span>Submitted claims</span><strong>{currentCounts.claims}</strong><button type="button" onClick={() => setActiveTab('claims')}>View claims</button></article>
          <article><span>Anonymous posts</span><strong>{currentCounts.confessions}</strong><Link to="/campus-voices/my-posts">Manage posts</Link></article>
          {community && <article><span>Campus points</span><strong>{community.balance ?? 0}</strong><span>Earned through campus activity</span></article>}
        </div>
        <div className="student-dashboard-columns">
          <section className="student-dashboard-card"><div className="student-card-heading"><div><p className="eyebrow">Marketplace</p><h2>Recent listings</h2></div><button className="text-link-button" type="button" onClick={() => setActiveTab('listings')}>View all</button></div>
            {currentActivity.products.slice(0, 3).map((product) => <article className="student-activity-row" key={product._id}><div className="student-activity-image">{product.images?.[0] ? <img src={product.images[0]} alt="" /> : <span aria-hidden="true">▣</span>}</div><div className="student-activity-copy"><Link to={`/products/${product._id}`}><strong>{product.title}</strong></Link><span>{product.category} · ₹{Number(product.price).toLocaleString('en-IN')}</span></div><span className={`student-status status-${product.status}`}>{product.status}</span></article>)}
            {!currentActivity.products.length && <p className="student-empty">No listings yet. <Link to="/sell">List your first item.</Link></p>}
          </section>
          <section className="student-dashboard-card"><div className="student-card-heading"><div><p className="eyebrow">Campus community</p><h2>Recent Lost &amp; Found</h2></div><button className="text-link-button" type="button" onClick={() => setActiveTab('lost-found')}>View all</button></div>
            {currentActivity.reports.slice(0, 3).map(showReport)}
            {!currentActivity.reports.length && <p className="student-empty">No Lost &amp; Found reports yet. <Link to="/lost-found/report">Report an item.</Link></p>}
          </section>
        </div>
        <section className="student-dashboard-card student-orders-notice"><div><p className="eyebrow">Purchases</p><h2>Order history</h2><p>CampusMart does not currently record purchases or completed orders, so there is no order history to show.</p></div><Link className="secondary-button" to="/marketplace">Browse marketplace</Link></section>
        <section className="student-dashboard-card student-quick-links"><h2>Account &amp; updates</h2><Link to="/notifications">Notifications</Link><Link to="/settings">Password and security</Link><Link to="/wishlist">Saved listings</Link><Link to="/campus-exchange/my-exchanges">My campus exchanges</Link></section>
      </>}
      {activeTab === 'listings' && <section className="student-tab-content"><div className="student-card-heading"><div><p className="eyebrow">Marketplace activity</p><h2>Your listings <span>({currentCounts.products})</span></h2></div><Link className="primary-button" to="/sell">Create listing</Link></div>{currentActivity.products.length ? <div className="student-listing-management">{currentActivity.products.map((product) => <article className="student-managed-listing" key={product._id}>
        <ProductCard listing={product} />
        <div className="student-managed-listing-actions">
          <Link className="secondary-button" to={`/sell/${product._id}`}>Edit</Link>
          {product.status !== 'sold' && <button className="secondary-button" type="button" onClick={() => updateListing(product, { status: 'sold' })}>Mark sold</button>}
          {product.status !== 'archived' && <button className="secondary-button" type="button" onClick={() => updateListing(product, { status: 'archived' })}>Archive</button>}
          {product.status === 'archived' && <button className="secondary-button" type="button" onClick={() => updateListing(product, { status: 'available' })}>Reactivate</button>}
          <button className="secondary-button danger-button" type="button" onClick={() => deleteListing(product)}>Delete</button>
        </div>
        {product.moderationStatus && product.moderationStatus !== 'active' && <p className="form-error">This listing is {product.moderationStatus} by moderation and is not visible publicly.</p>}
      </article>)}</div> : <div className="empty-state"><strong>No listings yet.</strong><span>Your marketplace listings will appear here.</span><Link className="primary-button" to="/sell">List your first item</Link></div>}</section>}
      {activeTab === 'lost-found' && <section className="student-tab-content"><div className="student-card-heading"><div><p className="eyebrow">Reports you've submitted</p><h2>Lost &amp; Found <span>({currentCounts.reports})</span></h2></div><Link className="primary-button" to="/lost-found/report">Report an item</Link></div>{currentActivity.reports.length ? <div className="student-activity-list">{currentActivity.reports.map(showReport)}</div> : <div className="empty-state"><strong>No reports yet.</strong><span>Reports you create will be listed here.</span><Link className="primary-button" to="/lost-found/report">Create a report</Link></div>}</section>}
      {activeTab === 'claims' && <section className="student-tab-content"><div className="student-card-heading"><div><p className="eyebrow">Items you responded to</p><h2>Submitted claims <span>({currentCounts.claims})</span></h2></div><Link className="secondary-button" to="/lost-found">Browse Lost &amp; Found</Link></div>{currentActivity.claims.length ? <div className="student-activity-list">{currentActivity.claims.map((claim) => <article className="student-claim-card" key={claim._id}><div><Link to={claim.report?._id ? `/lost-found/${claim.report._id}` : '/lost-found'}><strong>{claim.report?.title || 'Report no longer available'}</strong></Link><p>{claim.message}</p><span>Submitted {dateLabel(claim.createdAt)}</span></div><span className={`student-status status-${claim.status}`}>{claim.status}</span></article>)}</div> : <div className="empty-state"><strong>No claims submitted.</strong><span>When you submit a claim for a found item, its status appears here.</span><Link className="primary-button" to="/lost-found">Browse reports</Link></div>}</section>}
      {activeTab === 'confessions' && <section className="student-tab-content"><div className="student-card-heading"><div><p className="eyebrow">Private activity view</p><h2>Your anonymous posts <span>({currentCounts.confessions})</span></h2><p>Your identity remains hidden from the public campus feed.</p></div><Link className="primary-button" to="/campus-voices/create">Write a post</Link></div>{currentActivity.confessions.length ? <div className="student-confession-list">{currentActivity.confessions.map((post) => <article className="student-confession-card" key={post._id}><div><span className="student-confession-category">{post.category}</span></div><p>{post.content}</p><span>{dateLabel(post.createdAt)}</span></article>)}</div> : <div className="empty-state"><strong>No posts yet.</strong><span>Anything you share in Campus Voices remains anonymous to other students.</span><Link className="primary-button" to="/campus-voices/create">Share anonymously</Link></div>}</section>}
    </div>}
  </section>
}

export default Profile
