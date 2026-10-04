import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { lostFoundApi } from '../services/api'

const categories = ['Electronics', 'Wallets & Cards', 'Keys', 'Clothing', 'Books', 'Bags', 'Other']
const formatDate = (value) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value))

function LostFound() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState({ search: '', category: '', location: '', date: '' })
  const [reports, setReports] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const type = searchParams.get('type') || 'lost'

  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    lostFoundApi.list({ ...filters, type, page, limit: 12 }).then((data) => {
      if (active) { setReports(data.reports || []); setPages(data.pages || 1) }
    }).catch((requestError) => { if (active) setError(requestError.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, type, page])

  const changeFilter = (name, value) => { setPage(1); setFilters((current) => ({ ...current, [name]: value })) }
  const changeType = (next) => { setPage(1); setSearchParams({ type: next }) }

  return <section className="lost-found-page"><div className="lost-found-heading"><div><p className="eyebrow">Look out for one another</p><h1>Lost &amp; Found</h1><p>Find a missing item or help return something to its owner.</p></div><Link className="secondary-button" to="/lost-found/my-reports">My reports</Link></div>
    <div className="lost-found-actions"><Link className="primary-button" to="/lost-found/report?type=lost">Report Lost</Link><Link className="secondary-button" to="/lost-found/report?type=found">Report Found</Link></div>
    <div className="lost-found-tabs" role="tablist" aria-label="Report type"><button type="button" role="tab" aria-selected={type === 'lost'} className={type === 'lost' ? 'is-active' : ''} onClick={() => changeType('lost')}>Lost</button><button type="button" role="tab" aria-selected={type === 'found'} className={type === 'found' ? 'is-active' : ''} onClick={() => changeType('found')}>Found</button></div>
    <div className="lost-found-search"><input aria-label="Search reports" placeholder="Search item name or details" value={filters.search} onChange={(event) => changeFilter('search', event.target.value)} /><span aria-hidden="true">⌕</span></div>
    <div className="lost-found-filters"><label>Category<select value={filters.category} onChange={(event) => changeFilter('category', event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Location<input placeholder="e.g. Library" value={filters.location} onChange={(event) => changeFilter('location', event.target.value)} /></label><label>Date<input type="date" value={filters.date} onChange={(event) => changeFilter('date', event.target.value)} /></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}{loading ? <div className="empty-state">Loading reports...</div> : reports.length ? <div className="lost-found-grid">{reports.map((report) => <Link className="lost-found-card" to={`/lost-found/${report._id}`} key={report._id}><div className="lost-found-card-image">{report.images?.[0] ? <img src={report.images[0]} alt="" /> : <span aria-hidden="true">{report.type === 'lost' ? '🔎' : '📦'}</span>}<span className={`lost-found-type ${report.type}`}>{report.type}</span></div><div className="lost-found-card-body"><div className="lost-found-card-top"><span className="lost-found-category">{report.category}</span><span className="lost-found-status">{report.status}</span></div><h2>{report.title}</h2><p>{report.location}</p><time dateTime={report.date}>{formatDate(report.date)}</time></div></Link>)}</div> : <div className="empty-state"><strong>No active reports found.</strong><span>Try changing your filters or submit a report.</span></div>}
    {pages > 1 && <div className="lost-found-pagination"><button className="secondary-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="secondary-button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>}
  </section>
}

export default LostFound
