import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { adminApi } from '../services/api'
import AdminEngagementControls from '../components/AdminEngagementControls'

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)
}

function AdminDashboard() {
  const navigate = useNavigate()
  const { user, token, loading: authLoading } = useAuth()
  const [overview, setOverview] = useState(null)
  const [reports, setReports] = useState([])
  const [products, setProducts] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [viewedUser, setViewedUser] = useState(null)
  const [pendingAction, setPendingAction] = useState('')

  useEffect(() => {
    if (authLoading) return undefined
    if (!user || !token) {
      navigate('/login', { state: { from: '/admin' }, replace: true })
      return undefined
    }

    if (user.role !== 'admin') {
      setLoading(false)
      return undefined
    }

    let active = true
    setLoading(true)
    setError('')
    Promise.all([adminApi.overview(token), adminApi.products(token)])
      .then(([overviewData, productData]) => {
        if (!active) return
        setOverview(overviewData.overview)
        setProducts(productData.products || [])
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [authLoading, navigate, token, user])

  useEffect(() => {
    if (user?.role !== 'admin' || !token) return undefined

    let active = true
    setError('')
    adminApi.reports(token, { status: statusFilter, page })
      .then((data) => {
        if (!active) return
        setReports(data.reports || [])
        setPages(data.pagination?.pages || 1)
        setSelectedReport((current) => current ? (data.reports || []).find((report) => report._id === current._id) || current : null)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })

    return () => { active = false }
  }, [page, statusFilter, token, user?.role])

  const updateReport = async (report, updates) => {
    setPendingAction(report._id)
    setError('')
    try {
      const data = await adminApi.updateReport(token, report._id, updates)
      setReports((current) => current.map((item) => item._id === report._id ? data.report : item))
      setSelectedReport(data.report)
      if (Object.hasOwn(updates, 'adminNote')) setAdminNote(data.report.adminNote || '')
      const overviewData = await adminApi.overview(token)
      setOverview(overviewData.overview)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPendingAction('')
    }
  }

  const moderateProduct = async (product, moderationStatus) => {
    const actionKey = `product:${product._id}`
    setPendingAction(actionKey)
    setError('')
    try {
      const data = await adminApi.moderateProduct(token, product._id, moderationStatus)
      setProducts((current) => current.map((item) => item._id === product._id ? data.product : item))
      if (selectedReport?.product?._id === product._id) {
        setSelectedReport((current) => ({ ...current, product: data.product }))
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPendingAction('')
    }
  }

  const viewUser = async (userId) => {
    if (!userId) return
    setPendingAction(`user:${userId}`)
    setError('')
    try {
      const data = await adminApi.user(token, userId)
      setViewedUser(data.user)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPendingAction('')
    }
  }

  if (authLoading || loading) return <section className="placeholder"><strong>Loading admin dashboard...</strong></section>
  if (!user || user.role !== 'admin') {
    return <section className="placeholder" role="alert"><strong>Admin access required</strong><span>This area is only available to CampusMart admins.</span><p><Link className="secondary-button" to="/marketplace">Return to marketplace</Link></p></section>
  }

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">CampusMart operations</p>
          <h1>Admin dashboard</h1>
        </div>
        <span className="admin-role-label">Administrator</span>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="admin-overview-grid">
        <div className="admin-stat"><span>Total users</span><strong>{overview?.totalUsers ?? '—'}</strong></div>
        <div className="admin-stat"><span>Total products</span><strong>{overview?.totalProducts ?? '—'}</strong></div>
        <div className="admin-stat"><span>Pending reports</span><strong>{overview?.pendingReports ?? '—'}</strong></div>
        <div className="admin-stat"><span>Resolved reports</span><strong>{overview?.resolvedReports ?? '—'}</strong></div>
      </div>

      <section className="admin-section">
        <AdminEngagementControls token={token} />
      </section>

      <section className="admin-section">
        <div className="admin-section-heading">
          <div><p className="eyebrow">Community safety</p><h2>Reports</h2></div>
          <label className="admin-filter">Status
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewing">Reviewing</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </label>
        </div>

        {reports.length === 0 ? <div className="empty-state compact-empty">No reports match this filter.</div> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Reported content</th><th>Reporter</th><th>Reason</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report._id}>
                    <td>{report.campusExchange ? report.campusExchange.title : report.resource ? report.resource.title : report.voicePost ? `${report.voicePost.category} post` : report.product?.title || (report.reportedUser ? 'User report' : 'Product unavailable')}</td>
                    <td>{report.reporter?.name || 'Unknown user'}</td>
                    <td>{report.reason.replaceAll('_', ' ')}</td>
                    <td><span className={`admin-status status-${report.status}`}>{report.status}</span></td>
                    <td>{formatDate(report.createdAt)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button type="button" className="admin-action" onClick={() => { setSelectedReport(report); setAdminNote(report.adminNote || ''); setViewedUser(null) }}>View</button>
                        <button type="button" className="admin-action" onClick={() => updateReport(report, { status: 'reviewing' })} disabled={pendingAction === report._id || report.status === 'reviewing'}>Review</button>
                        <button type="button" className="admin-action" onClick={() => updateReport(report, { status: 'resolved' })} disabled={pendingAction === report._id || report.status === 'resolved'}>Resolve</button>
                        <button type="button" className="admin-action danger-text" onClick={() => updateReport(report, { status: 'dismissed' })} disabled={pendingAction === report._id || report.status === 'dismissed'}>Dismiss</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && <div className="notification-pagination"><button type="button" className="secondary-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button><span>Page {page} of {pages}</span><button type="button" className="secondary-button" onClick={() => setPage((current) => Math.min(pages, current + 1))} disabled={page >= pages}>Next</button></div>}

        {selectedReport && (
          <div className="admin-detail-panel">
            <div className="admin-detail-heading"><h3>Report details</h3><button type="button" className="admin-action" onClick={() => setSelectedReport(null)}>Close</button></div>
            <p><strong>Reason:</strong> {selectedReport.reason.replaceAll('_', ' ')}</p>
            <p><strong>Description:</strong> {selectedReport.description || 'No additional description.'}</p>
            <p><strong>Reporter:</strong> {selectedReport.reporter?.name} · {selectedReport.reporter?.email}</p>
            {(selectedReport.reportedUser || selectedReport.product?.seller) && (() => {
              const subjectUser = selectedReport.reportedUser || selectedReport.product.seller
              const userId = subjectUser._id
              return <div className="admin-user-summary"><strong>{selectedReport.reportedUser ? 'Reported user:' : 'Product seller:'}</strong> {subjectUser.name}<button type="button" className="admin-action" onClick={() => viewUser(userId)} disabled={pendingAction === `user:${userId}`}>View user</button></div>
            })()}
            {selectedReport.product && <div className="admin-product-review">
              <div className="admin-product-summary"><strong>Reported product:</strong> {selectedReport.product.title}<span className={`admin-status status-${selectedReport.product.moderationStatus || 'active'}`}>{selectedReport.product.moderationStatus || 'active'}</span></div>
              <div className="admin-reported-product">
                {selectedReport.product.images?.[0] && <img src={selectedReport.product.images[0]} alt={selectedReport.product.title} />}
                <div>
                  <p>{selectedReport.product.description}</p>
                  <p><strong>Price:</strong> ₹{Number(selectedReport.product.price || 0).toLocaleString('en-IN')} · <strong>Sale status:</strong> {selectedReport.product.status}</p>
                  <p><strong>Seller:</strong> {selectedReport.product.seller?.name || 'Unknown seller'} · {selectedReport.product.college}</p>
                </div>
              </div>
              {selectedReport.product.moderationStatus === 'active' || !selectedReport.product.moderationStatus
                ? <Link to={`/products/${selectedReport.product._id}`} target="_blank" rel="noreferrer">Open public listing</Link>
                : <span className="admin-note">This listing is hidden from public access; its report details are shown here for review.</span>}
            </div>}
            {selectedReport.resource && <div className="admin-voice-review">
              <div className="admin-product-summary"><strong>Resource:</strong> {selectedReport.resource.title}<span className={`admin-status status-${selectedReport.resource.status}`}>{selectedReport.resource.status}</span></div>
              <p>{selectedReport.resource.type.replaceAll('_', ' ')} · {[selectedReport.resource.subject, selectedReport.resource.course, selectedReport.resource.semester && `Semester ${selectedReport.resource.semester}`, selectedReport.resource.year].filter(Boolean).join(' · ')}</p>
              <p>{selectedReport.resource.description || 'No description provided.'}</p>
              {selectedReport.resource.externalUrl && <a href={selectedReport.resource.externalUrl} target="_blank" rel="noreferrer">Open reported link</a>}
              {selectedReport.resource.fileUrl && <a href={selectedReport.resource.fileUrl} target="_blank" rel="noreferrer">Open reported file</a>}
              <div className="admin-row-actions">
                <button type="button" className="admin-action" onClick={() => updateReport(selectedReport, { resourceStatus: 'hidden' })} disabled={pendingAction === selectedReport._id || selectedReport.resource.status === 'hidden'}>Hide</button>
                <button type="button" className="admin-action danger-text" onClick={() => updateReport(selectedReport, { resourceStatus: 'removed' })} disabled={pendingAction === selectedReport._id || selectedReport.resource.status === 'removed'}>Remove</button>
                <button type="button" className="admin-action" onClick={() => updateReport(selectedReport, { resourceStatus: 'active' })} disabled={pendingAction === selectedReport._id || selectedReport.resource.status === 'active'}>Restore</button>
              </div>
            </div>}
            {selectedReport.campusExchange && <div className="admin-voice-review">
              <div className="admin-product-summary"><strong>Campus Exchange listing:</strong> {selectedReport.campusExchange.title}<span className={`admin-status status-${selectedReport.campusExchange.moderationStatus || 'active'}`}>{selectedReport.campusExchange.moderationStatus || 'active'}</span></div>
              <p><strong>Offering:</strong> {selectedReport.campusExchange.offeredItem} · <strong>Looking for:</strong> {selectedReport.campusExchange.wantedItem}</p>
              <p>{selectedReport.campusExchange.category} · {selectedReport.campusExchange.condition} · {selectedReport.campusExchange.location}</p>
              <p>{selectedReport.campusExchange.description || 'No description provided.'}</p>
              <div className="admin-row-actions">
                <button type="button" className="admin-action" onClick={() => updateReport(selectedReport, { campusExchangeStatus: 'hidden' })} disabled={pendingAction === selectedReport._id || selectedReport.campusExchange.moderationStatus === 'hidden'}>Hide</button>
                <button type="button" className="admin-action danger-text" onClick={() => updateReport(selectedReport, { campusExchangeStatus: 'removed' })} disabled={pendingAction === selectedReport._id || selectedReport.campusExchange.moderationStatus === 'removed'}>Remove</button>
                <button type="button" className="admin-action" onClick={() => updateReport(selectedReport, { campusExchangeStatus: 'active' })} disabled={pendingAction === selectedReport._id || selectedReport.campusExchange.moderationStatus === 'active'}>Restore</button>
              </div>
            </div>}
            {selectedReport.voicePost && <div className="admin-voice-review">
              <div className="admin-product-summary"><strong>Campus Voice post:</strong> {selectedReport.voicePost.category}<span className={`admin-status status-${selectedReport.voicePost.status}`}>{selectedReport.voicePost.status}</span></div>
              <p className="admin-voice-content">{selectedReport.voicePost.content}</p>
              <div className="admin-row-actions">
                <button type="button" className="admin-action" onClick={() => updateReport(selectedReport, { voicePostStatus: 'hidden' })} disabled={pendingAction === selectedReport._id || selectedReport.voicePost.status === 'hidden'}>Hide</button>
                <button type="button" className="admin-action danger-text" onClick={() => updateReport(selectedReport, { voicePostStatus: 'removed' })} disabled={pendingAction === selectedReport._id || selectedReport.voicePost.status === 'removed'}>Remove</button>
                <button type="button" className="admin-action" onClick={() => updateReport(selectedReport, { voicePostStatus: 'active' })} disabled={pendingAction === selectedReport._id || selectedReport.voicePost.status === 'active'}>Restore</button>
              </div>
            </div>}
            <label className="admin-note-field">Admin note<textarea maxLength={1000} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} /></label>
            <button type="button" className="primary-button" onClick={() => updateReport(selectedReport, { adminNote })} disabled={pendingAction === selectedReport._id}>Save note</button>
            {viewedUser && <div className="admin-user-summary viewed-user"><strong>User details:</strong> {viewedUser.name}, {viewedUser.email}, {viewedUser.college} · {viewedUser.role}</div>}
            <p className="admin-note">User disabling is not available because the current account model has no disabled state.</p>
          </div>
        )}
      </section>

      <section className="admin-section">
        <div className="admin-section-heading"><div><p className="eyebrow">Listing safety</p><h2>Product moderation</h2></div><span>{products.length} loaded</span></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Product</th><th>Seller</th><th>Sale status</th><th>Moderation</th><th>Actions</th></tr></thead>
            <tbody>
              {products.map((product) => {
                const moderationStatus = product.moderationStatus || 'active'
                const nextStatus = moderationStatus === 'active' ? 'hidden' : moderationStatus === 'hidden' ? 'removed' : 'active'
                const actionLabel = moderationStatus === 'active' ? 'Hide / unavailable' : moderationStatus === 'hidden' ? 'Remove' : 'Restore'
                return <tr key={product._id}>
                  <td><strong>{product.title}</strong></td>
                  <td>{product.seller?.name || 'Unknown seller'}</td>
                  <td>{product.status}</td>
                  <td><span className={`admin-status status-${moderationStatus}`}>{moderationStatus}</span></td>
                  <td><button type="button" className="admin-action" onClick={() => moderateProduct(product, nextStatus)} disabled={pendingAction === `product:${product._id}`}>{pendingAction === `product:${product._id}` ? 'Updating...' : actionLabel}</button></td>
                </tr>
              })}
              {products.length === 0 && <tr><td colSpan="5">No products found.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="admin-note">Hidden and removed listings are excluded from the marketplace. Removal is soft; product data remains stored and can be restored.</p>
      </section>
    </section>
  )
}

export default AdminDashboard
