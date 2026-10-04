import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { campusExchangeApi } from '../services/api'

const categories = ['Books', 'Electronics', 'Hostel', 'Fashion', 'Accessories', 'Sports', 'Other']
const conditions = ['New', 'Like New', 'Good', 'Fair']

function CampusExchange() {
  const [filters, setFilters] = useState({ search: '', category: '', condition: '', location: '' })
  const [items, setItems] = useState([]); const [page, setPage] = useState(1); const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    campusExchangeApi.list({ ...filters, page, limit: 12 }).then((data) => {
      if (active) { setItems(data.exchanges || []); setPages(data.pagination?.pages || 1) }
    }).catch((requestError) => { if (active) setError(requestError.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, page])
  const set = (name, value) => { setPage(1); setFilters((current) => ({ ...current, [name]: value })) }
  return <section className="resources-page exchange-page"><div className="resources-heading"><div><p className="eyebrow">Swap with your campus community</p><h1>Campus Exchange</h1><p>Swap items with students on your campus.</p></div><div className="resource-page-actions"><Link className="secondary-button" to="/campus-exchange/my-exchanges">My Exchanges</Link><Link className="primary-button" to="/campus-exchange/create">Create Exchange</Link></div></div>
    <div className="resource-filters"><input aria-label="Search exchanges" type="search" placeholder="Search what students offer or want..." value={filters.search} onChange={(event) => set('search', event.target.value)} /><select aria-label="Category" value={filters.category} onChange={(event) => set('category', event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select><select aria-label="Condition" value={filters.condition} onChange={(event) => set('condition', event.target.value)}><option value="">All conditions</option>{conditions.map((condition) => <option key={condition}>{condition}</option>)}</select><input aria-label="Location" placeholder="Campus location" value={filters.location} onChange={(event) => set('location', event.target.value)} /></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <div className="empty-state">Loading exchange listings...</div> : !items.length ? <div className="empty-state">No active exchange listings found. Try another search or create a listing.</div> : <div className="resource-grid exchange-grid">{items.map((item) => <article className="resource-card exchange-card" key={item._id}><Link className="exchange-card-image" to={`/campus-exchange/${item._id}`}>{item.images?.[0] ? <img src={item.images[0]} alt="" /> : <span aria-hidden="true">⇄</span>}</Link><span className="resource-type">{item.category} · {item.condition}</span><h2><Link to={`/campus-exchange/${item._id}`}>{item.title}</Link></h2><p><strong>Offering:</strong> {item.offeredItem}</p><p><strong>Looking for:</strong> {item.wantedItem}</p><p>{item.location}</p><span className="exchange-owner">{item.owner?.college || 'Campus student'}</span><Link className="secondary-button" to={`/campus-exchange/${item._id}`}>View Exchange</Link></article>)}</div>}
    {pages > 1 && <div className="voice-pagination"><button className="secondary-button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="secondary-button" disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
  </section>
}

export default CampusExchange
