import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { campusExchangeApi } from '../services/api'

function MyCampusExchanges() {
  const { user, token, loading: authLoading } = useAuth()
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(1); const [pages, setPages] = useState(1)
  useEffect(() => {
    if (!token) return
    let active = true
    setLoading(true); setError('')
    campusExchangeApi.mine(token, page, status).then((data) => { if (active) { setItems(data.exchanges || []); setPages(data.pagination?.pages || 1) } }).catch((requestError) => active && setError(requestError.message)).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [token, page, status])
  if (authLoading) return <section className="placeholder">Loading your account...</section>
  if (!user || !token) return <Navigate to="/login" replace />
  return <section className="resources-page"><div className="resources-heading"><div><p className="eyebrow">Your listings</p><h1>My Exchanges</h1></div><Link className="primary-button" to="/campus-exchange/create">Create Exchange</Link></div>
    <label className="resource-filter">Show exchanges<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">All exchanges</option><option value="active">Active</option><option value="pending_requests">Pending Requests</option><option value="exchanged">Exchanged</option><option value="closed">Closed</option></select></label>
    {error && <p className="form-error" role="alert">{error}</p>}{loading ? <div className="empty-state">Loading your exchanges...</div> : items.length ? <div className="resource-grid exchange-grid">{items.map((item) => <article className="resource-card exchange-card" key={item._id}><span className={`resource-type resource-status-${item.status}`}>{item.status}</span><h2><Link to={`/campus-exchange/${item._id}`}>{item.title}</Link></h2><p><strong>Offering:</strong> {item.offeredItem}</p><p><strong>Looking for:</strong> {item.wantedItem}</p><Link className="secondary-button" to={`/campus-exchange/${item._id}`}>View Requests</Link>{item.status === 'active' && <Link className="secondary-button" to={`/campus-exchange/create?id=${item._id}`}>Edit</Link>}</article>)}</div> : <div className="empty-state">You haven’t created any exchanges yet. <Link to="/campus-exchange">Browse Campus Exchange</Link></div>}
    {pages > 1 && <div className="voice-pagination"><button type="button" className="secondary-button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading}>Previous</button><span>Page {page} of {pages}</span><button type="button" className="secondary-button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages || loading}>Next</button></div>}
  </section>
}

export default MyCampusExchanges
