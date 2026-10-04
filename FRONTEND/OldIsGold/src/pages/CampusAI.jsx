import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { campusAIApi } from '../services/api'
import { useAuth } from '../context/useAuth'

const prompts = ['Find calculators under ₹700', 'I lost a black wallet near the library', 'Find DBMS notes for semester 4', 'Show me previous year papers for CSE', 'Swap my calculator for engineering books', 'What’s trending on campus?', 'Show me deals on textbooks', 'Is this calculator fairly priced?']
const domainNames = { marketplace: 'Marketplace', lost_found: 'Lost & Found', resources: 'Resources', campus_exchange: 'Campus Exchange', all: 'Campus' }
const resourceNames = { notes: 'Notes', previous_paper: 'Previous Year Papers', syllabus: 'Syllabus', study_material: 'Study Material', useful_link: 'Useful Links' }
const marketplacePrompts = ['Find calculators under ₹700', 'Show engineering books under ₹500', 'Find used laptops', 'Find a scientific calculator', 'Show cheap CSE books']
const lostFoundPrompts = ['I lost a black wallet near the library', 'Has anyone found a blue bottle?', 'Find lost calculators', 'Show found phones', 'I lost my ID card yesterday']
const resourcePrompts = ['Find DBMS notes for semester 4', 'Show CSE previous year papers', 'Find operating systems study material', 'I need a BCA semester 2 syllabus', 'Show useful links for data structures']
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)

function CampusAI() {
  const { token } = useAuth()
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [marketplaceQuery, setMarketplaceQuery] = useState('')
  const [marketplaceData, setMarketplaceData] = useState(null)
  const [marketplaceLoading, setMarketplaceLoading] = useState(false)
  const [marketplaceError, setMarketplaceError] = useState('')
  const [marketplacePage, setMarketplacePage] = useState(1)
  const [lostFoundQuery, setLostFoundQuery] = useState('')
  const [lostFoundData, setLostFoundData] = useState(null)
  const [lostFoundLoading, setLostFoundLoading] = useState(false)
  const [lostFoundError, setLostFoundError] = useState('')
  const [lostFoundPage, setLostFoundPage] = useState(1)
  const [resourceQuery, setResourceQuery] = useState('')
  const [resourceData, setResourceData] = useState(null)
  const [resourceLoading, setResourceLoading] = useState(false)
  const [resourceError, setResourceError] = useState('')
  const [resourcePage, setResourcePage] = useState(1)
  const [recommendationData, setRecommendationData] = useState(null)
  const [recommendationLoading, setRecommendationLoading] = useState(false)
  const [recommendationError, setRecommendationError] = useState('')
  useEffect(() => {
    if (!token) { setRecommendationData(null); return }
    let current = true
    setRecommendationLoading(true)
    campusAIApi.recommendations(token)
      .then((data) => { if (current) setRecommendationData(data.recommendations) })
      .catch(() => { if (current) setRecommendationError('Recommendations are temporarily unavailable.') })
      .finally(() => { if (current) setRecommendationLoading(false) })
    return () => { current = false }
  }, [token])
  const ask = async (event) => {
    event?.preventDefault()
    if (!query.trim() || loading) return
    setLoading(true); setError(''); setResponse(null)
    try { setResponse(await campusAIApi.search(query.trim())) }
    catch { setError('Campus AI is temporarily unavailable. Please try regular search.') }
    finally { setLoading(false) }
  }
  const quickAction = (elementId, value, setter) => { setter(value); document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
  const searchMarketplace = async (event, page = 1) => {
    event?.preventDefault()
    if (!marketplaceQuery.trim() || marketplaceLoading) return
    setMarketplaceLoading(true); setMarketplaceError('')
    try {
      const data = await campusAIApi.marketplaceSearch(marketplaceQuery.trim(), { page, limit: 20, token })
      setMarketplaceData(data); setMarketplacePage(data.pagination?.page || page)
    } catch { setMarketplaceError('Campus AI is temporarily unavailable. Please try Marketplace search directly.'); setMarketplaceData(null) }
    finally { setMarketplaceLoading(false) }
  }
  const searchLostFound = async (event, page = 1) => {
    event?.preventDefault()
    if (!lostFoundQuery.trim() || lostFoundLoading) return
    setLostFoundLoading(true); setLostFoundError('')
    try {
      const data = await campusAIApi.lostFoundSearch(lostFoundQuery.trim(), { page, limit: 20 })
      setLostFoundData(data); setLostFoundPage(data.pagination?.page || page)
    } catch { setLostFoundError('Campus AI is temporarily unavailable. Please search Lost & Found directly.'); setLostFoundData(null) }
    finally { setLostFoundLoading(false) }
  }
  const searchResources = async (event, page = 1) => {
    event?.preventDefault()
    if (!resourceQuery.trim() || resourceLoading) return
    setResourceLoading(true); setResourceError('')
    try {
      const data = await campusAIApi.resourceSearch(resourceQuery.trim(), { page, limit: 20 })
      setResourceData(data); setResourcePage(data.pagination?.page || page)
    } catch { setResourceError('Campus AI is temporarily unavailable. Please search Resources directly.'); setResourceData(null) }
    finally { setResourceLoading(false) }
  }
  const results = response?.results || {}
  const groups = [['marketplace', 'Marketplace', results.marketplace || []], ['lostFound', 'Lost & Found', results.lostFound || []], ['resources', 'Resources', results.resources || []], ['campusExchange', 'Campus Exchange', results.campusExchange || []]].filter(([, , entries]) => entries.length)
  const count = groups.reduce((sum, [, , entries]) => sum + entries.length, 0)
  const intent = response?.interpretation
  const summary = intent && [domainNames[intent.domain], intent.query, intent.category, intent.location, intent.subject, intent.course, intent.semester && `Semester ${intent.semester}`, intent.type, intent.maxPrice !== null && `up to ₹${intent.maxPrice}`, intent.minPrice !== null && `from ₹${intent.minPrice}`].filter(Boolean).join(' · ')
  const marketFilters = marketplaceData?.filters
  const marketFilterLabels = marketFilters ? [marketFilters.query && `Query: ${marketFilters.query}`, marketFilters.category && `Category: ${marketFilters.category}`, marketFilters.condition && `Condition: ${marketFilters.condition}`, marketFilters.minPrice !== null && `From ${money(marketFilters.minPrice)}`, marketFilters.maxPrice !== null && `Up to ${money(marketFilters.maxPrice)}`, marketFilters.location === 'my_college' && 'Near your college', marketFilters.sort === 'price_asc' && 'Cheapest first', marketFilters.sort === 'price_desc' && 'Most expensive first', marketFilters.sort === 'newest' && 'Newest'].filter(Boolean) : []
  const resourceFilters = resourceData?.filters
  const resourceFilterLabels = resourceFilters ? [resourceFilters.type && `Type: ${resourceNames[resourceFilters.type] || resourceFilters.type}`, resourceFilters.query && `Query: ${resourceFilters.query}`, resourceFilters.subject && `Subject: ${resourceFilters.subject}`, resourceFilters.course && `Course: ${resourceFilters.course}`, resourceFilters.semester && `Semester: ${resourceFilters.semester}`, resourceFilters.year && `Year: ${resourceFilters.year}`].filter(Boolean) : []

  return <section className="campus-ai-page">
    <div className="campus-ai-heading"><p className="eyebrow">CampusMart AI search</p><h1>Campus AI</h1><p>Ask anything about your campus marketplace, lost &amp; found, and resources.</p></div>
    <section className="campus-ai-quick-actions" aria-label="Campus AI quick actions"><h2>Quick actions</h2><div className="campus-ai-prompts"><button type="button" onClick={() => quickAction('campus-ai-marketplace-query', 'Find calculators under ₹700', setMarketplaceQuery)}>🔎 Find Something</button><Link className="button-link" to="/sell">💰 Check a Price</Link><button type="button" onClick={() => quickAction('campus-ai-query', 'Find someone exchanging CSE books', setQuery)}>🔄 Find an Exchange</button><button type="button" onClick={() => quickAction('campus-ai-resource-query', 'Find DBMS notes for semester 4', setResourceQuery)}>📚 Find Resources</button><button type="button" onClick={() => quickAction('campus-ai-lost-found-query', 'I lost a black wallet near the library', setLostFoundQuery)}>🔍 Find Lost Item</button><button type="button" onClick={() => document.getElementById('campus-ai-recommendations-title')?.scrollIntoView({ behavior: 'smooth' })}>🎯 Get Recommendations</button></div></section>
    <section className="campus-ai-recommendations" aria-labelledby="campus-ai-recommendations-title"><div className="campus-ai-section-heading"><div><p className="eyebrow">Picked from real campus activity</p><h2 id="campus-ai-recommendations-title">Recommended for You</h2><p>Discover marketplace items and resources based on campus activity.</p></div></div>
      {!token ? <div className="empty-state">Log in to see recommendations based on your wishlist and product views. <Link to="/login">Log in</Link></div>
        : recommendationLoading ? <div className="empty-state" role="status">Loading recommendations...</div>
          : recommendationError ? <div className="campus-ai-error" role="alert">{recommendationError}</div>
            : recommendationData && !recommendationData.personalized ? <div className="empty-state"><strong>Explore Marketplace and Resources to get personalized recommendations.</strong><div className="resource-page-actions"><Link className="secondary-button" to="/marketplace">Browse Marketplace</Link><Link className="secondary-button" to="/resources">Browse Resources</Link></div></div>
              : recommendationData && <>
                {recommendationData.marketplace?.length > 0 && <section className="campus-ai-recommendation-group"><div className="campus-ai-group-heading"><h3>Marketplace</h3></div><div className="product-grid">{recommendationData.marketplace.map((product) => <ProductCard key={product._id} listing={product} recommendationReason={product.recommendationReason} />)}</div></section>}
                {recommendationData.resources?.length > 0 && <section className="campus-ai-recommendation-group"><div className="campus-ai-group-heading"><h3>Resources</h3></div><div className="resource-grid">{recommendationData.resources.map((resource) => <article className="resource-card" key={resource._id}><span className="resource-type">{resourceNames[resource.type] || resource.type}</span><h3><Link to={`/resources/${resource._id}`}>{resource.title}</Link></h3><p>{[resource.subject, resource.course, resource.semester && `Semester ${resource.semester}`, resource.year].filter(Boolean).join(' · ')}</p><p className="recommendation-reason">{resource.recommendationReason}</p><Link className="secondary-button" to={`/resources/${resource._id}`}>{resource.type === 'useful_link' ? 'Open Resource' : 'View Resource'}</Link></article>)}</div></section>}
                {recommendationData.lostFound?.length > 0 && <section className="campus-ai-recommendation-group"><div className="campus-ai-group-heading"><h3>Related Lost &amp; Found</h3></div><div className="lost-found-grid">{recommendationData.lostFound.map((report) => <Link className="lost-found-card" to={`/lost-found/${report._id}`} key={report._id}><div className="lost-found-card-body"><span>{report.type} · {report.category}</span><h3>{report.title}</h3><p>{report.location}</p><span className="recommendation-reason">{report.recommendationReason}</span></div></Link>)}</div></section>}
                {!recommendationData.marketplace?.length && !recommendationData.resources?.length && !recommendationData.lostFound?.length && <div className="empty-state">No matching recommendations right now. <Link to="/marketplace">Browse Marketplace</Link> · <Link to="/resources">Browse Resources</Link></div>}
              </>}
    </section>
    <section className="campus-ai-marketplace" aria-labelledby="campus-ai-marketplace-title"><div className="campus-ai-section-heading"><div><p className="eyebrow">Natural-language product finder</p><h2 id="campus-ai-marketplace-title">Marketplace Search</h2></div><Link className="secondary-button" to="/marketplace">Browse Marketplace</Link></div>
      <form className="campus-ai-search" onSubmit={searchMarketplace}><label className="sr-only" htmlFor="campus-ai-marketplace-query">Marketplace search</label><input id="campus-ai-marketplace-query" value={marketplaceQuery} onChange={(event) => setMarketplaceQuery(event.target.value)} maxLength={300} placeholder="Find calculators under ₹700" /><button className="primary-button" type="submit" disabled={marketplaceLoading || !marketplaceQuery.trim()}>{marketplaceLoading ? 'Searching…' : 'Search Marketplace'}</button></form>
      <div className="campus-ai-prompts campus-ai-marketplace-prompts"><span>Try</span>{marketplacePrompts.map((prompt) => <button key={prompt} type="button" onClick={() => setMarketplaceQuery(prompt)}>{prompt}</button>)}</div>
      {marketplaceLoading && <div className="empty-state" role="status">Campus AI is searching real marketplace listings...</div>}
      {marketplaceError && <div className="campus-ai-error" role="alert">{marketplaceError} <Link to="/marketplace">Open Marketplace</Link></div>}
      {marketplaceData && <div className="campus-ai-market-results"><div className="campus-ai-interpretation"><strong>Search interpreted as:</strong> {marketFilterLabels.length ? marketFilterLabels.join(' · ') : 'Available marketplace listings'}</div>
        {marketplaceData.results?.length ? <><div className="campus-ai-group-heading"><h3>Marketplace Results</h3><span>{marketplaceData.total} listing{marketplaceData.total === 1 ? '' : 's'}</span></div><div className="product-grid">{marketplaceData.results.map((product) => <ProductCard key={product._id} listing={product} />)}</div>
          {marketplaceData.pagination?.totalPages > 1 && <div className="voice-pagination"><button type="button" className="secondary-button" disabled={marketplacePage <= 1 || marketplaceLoading} onClick={(event) => searchMarketplace(event, marketplacePage - 1)}>Previous</button><span>Page {marketplacePage} of {marketplaceData.pagination.totalPages}</span><button type="button" className="secondary-button" disabled={marketplacePage >= marketplaceData.pagination.totalPages || marketplaceLoading} onClick={(event) => searchMarketplace(event, marketplacePage + 1)}>Next</button></div>}</>
          : <div className="empty-state"><strong>Campus AI couldn't find matching marketplace listings.</strong><span>Remove a price limit or try another keyword.</span><Link to="/marketplace">Browse Marketplace</Link></div>}
      </div>}
    </section>
    <section className="campus-ai-lost-found" aria-labelledby="campus-ai-lost-found-title"><div className="campus-ai-section-heading"><div><p className="eyebrow">Search items reported by students</p><h2 id="campus-ai-lost-found-title">Lost &amp; Found Search</h2></div><Link className="secondary-button" to="/lost-found">Open Lost &amp; Found</Link></div>
      <form className="campus-ai-search" onSubmit={searchLostFound}><label className="sr-only" htmlFor="campus-ai-lost-found-query">Lost and Found search</label><input id="campus-ai-lost-found-query" value={lostFoundQuery} onChange={(event) => setLostFoundQuery(event.target.value)} maxLength={300} placeholder="I lost a black wallet near the library" /><button className="primary-button" type="submit" disabled={lostFoundLoading || !lostFoundQuery.trim()}>{lostFoundLoading ? 'Searching…' : 'Search Lost & Found'}</button></form>
      <div className="campus-ai-prompts campus-ai-marketplace-prompts"><span>Try</span>{lostFoundPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => setLostFoundQuery(prompt)}>{prompt}</button>)}</div>
      {lostFoundLoading && <div className="empty-state" role="status">Campus AI is searching active Lost &amp; Found reports...</div>}
      {lostFoundError && <div className="campus-ai-error" role="alert">{lostFoundError} <Link to="/lost-found">Open Lost &amp; Found</Link></div>}
      {lostFoundData && <div className="campus-ai-market-results"><div className="campus-ai-interpretation"><strong>Search interpreted as:</strong> {[lostFoundData.filters.type && `Type: ${lostFoundData.filters.type}`, lostFoundData.filters.query && `Item: ${lostFoundData.filters.query}`, lostFoundData.filters.category && `Category: ${lostFoundData.filters.category}`, lostFoundData.filters.location && `Location: ${lostFoundData.filters.location}`, lostFoundData.filters.date && `Date: ${lostFoundData.filters.date}`, `Status: ${lostFoundData.filters.status}`].filter(Boolean).join(' · ')}</div>
        {lostFoundData.results?.length ? <><div className="campus-ai-group-heading"><h3>Lost &amp; Found Results</h3><span>{lostFoundData.total} report{lostFoundData.total === 1 ? '' : 's'}</span></div><div className="lost-found-grid">{lostFoundData.results.map((report) => <Link className="lost-found-card" to={`/lost-found/${report._id}`} key={report._id}><div className="lost-found-card-image">{report.images?.[0] ? <img src={report.images[0]} alt="" /> : <span aria-hidden="true">{report.type === 'lost' ? '🔎' : '📦'}</span>}<span className={`lost-found-type ${report.type}`}>{report.type}</span></div><div className="lost-found-card-body"><div className="lost-found-card-top"><span className="lost-found-category">{report.category}</span><span className="lost-found-status">{report.status}</span></div><h3>{report.title}</h3><p>{report.location}</p><time dateTime={report.date}>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(report.date))}</time></div></Link>)}</div>
          {lostFoundData.pagination?.totalPages > 1 && <div className="voice-pagination"><button type="button" className="secondary-button" disabled={lostFoundPage <= 1 || lostFoundLoading} onClick={(event) => searchLostFound(event, lostFoundPage - 1)}>Previous</button><span>Page {lostFoundPage} of {lostFoundData.pagination.totalPages}</span><button type="button" className="secondary-button" disabled={lostFoundPage >= lostFoundData.pagination.totalPages || lostFoundLoading} onClick={(event) => searchLostFound(event, lostFoundPage + 1)}>Next</button></div>}</>
          : <div className="empty-state"><strong>Campus AI couldn&apos;t find a matching Lost &amp; Found report.</strong><span>Try a broader description or remove the location.</span><Link to="/lost-found">Search Lost &amp; Found directly</Link></div>}
      </div>}
    </section>
    <section className="campus-ai-resources" aria-labelledby="campus-ai-resources-title"><div className="campus-ai-section-heading"><div><p className="eyebrow">Natural-language academic search</p><h2 id="campus-ai-resources-title">Resource Search</h2></div><Link className="secondary-button" to="/resources">Browse Resources</Link></div>
      <form className="campus-ai-search" onSubmit={searchResources}><label className="sr-only" htmlFor="campus-ai-resource-query">Resource search</label><input id="campus-ai-resource-query" value={resourceQuery} onChange={(event) => setResourceQuery(event.target.value)} maxLength={300} placeholder="Find DBMS notes for semester 4" /><button className="primary-button" type="submit" disabled={resourceLoading || !resourceQuery.trim()}>{resourceLoading ? 'Searching…' : 'Search Resources'}</button></form>
      <div className="campus-ai-prompts campus-ai-marketplace-prompts"><span>Try</span>{resourcePrompts.map((prompt) => <button key={prompt} type="button" onClick={() => setResourceQuery(prompt)}>{prompt}</button>)}</div>
      {resourceLoading && <div className="empty-state" role="status">Campus AI is searching real resources...</div>}
      {resourceError && <div className="campus-ai-error" role="alert">{resourceError} <Link to="/resources">Open Resources</Link></div>}
      {resourceData && <div className="campus-ai-market-results"><div className="campus-ai-interpretation"><strong>Search interpreted as:</strong> {resourceFilterLabels.length ? resourceFilterLabels.join(' · ') : 'Available resources'}</div>
        {resourceData.results?.length ? <><div className="campus-ai-group-heading"><h3>Resource Results</h3><span>{resourceData.total} resource{resourceData.total === 1 ? '' : 's'}</span></div><div className="resource-grid">{resourceData.results.map((resource) => <article className="resource-card" key={resource._id}><span className="resource-type">{resourceNames[resource.type] || resource.type}</span><h3><Link to={`/resources/${resource._id}`}>{resource.title}</Link></h3><p>{[resource.subject, resource.course, resource.semester && `Semester ${resource.semester}`, resource.year].filter(Boolean).join(' · ')}</p><p className="resource-description">{resource.description || 'No description provided.'}</p><Link className="secondary-button" to={`/resources/${resource._id}`}>{resource.type === 'useful_link' ? 'Open Resource' : 'View / Download'}</Link></article>)}</div>
          {resourceData.pagination?.totalPages > 1 && <div className="voice-pagination"><button type="button" className="secondary-button" disabled={resourcePage <= 1 || resourceLoading} onClick={(event) => searchResources(event, resourcePage - 1)}>Previous</button><span>Page {resourcePage} of {resourceData.pagination.totalPages}</span><button type="button" className="secondary-button" disabled={resourcePage >= resourceData.pagination.totalPages || resourceLoading} onClick={(event) => searchResources(event, resourcePage + 1)}>Next</button></div>}</>
          : <div className="empty-state"><strong>Campus AI couldn&apos;t find matching resources.</strong><span>Try another subject, remove the semester filter, or search by course.</span><Link to="/resources">Browse Resources</Link></div>}
      </div>}
    </section>
    <form className="campus-ai-search" onSubmit={ask}><label className="sr-only" htmlFor="campus-ai-query">Search CampusMart</label><input id="campus-ai-query" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={300} placeholder="Try: Find DBMS notes for semester 4" /><button className="primary-button" type="submit" disabled={loading || !query.trim()}>{loading ? 'Searching…' : 'Ask Campus AI'}</button></form>
    <div className="campus-ai-prompts"><span>Try asking</span>{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => setQuery(prompt)}>{prompt}</button>)}</div>
    {loading && <div className="empty-state" role="status">Campus AI is searching CampusMart...</div>}
    {error && <div className="campus-ai-error" role="alert">{error} <Link to="/marketplace">Marketplace</Link> · <Link to="/lost-found">Lost &amp; Found</Link> · <Link to="/resources">Resources</Link></div>}
    {response && <div className="campus-ai-results"><div className="campus-ai-interpretation"><strong>Searching:</strong> {summary}</div>
      {count === 0 ? <div className="empty-state"><strong>No matching campus results found.</strong><span>Try different keywords, remove a filter, or search another category.</span></div> : groups.map(([key, title, entries]) => <section className="campus-ai-result-group" key={key}><div className="campus-ai-group-heading"><h2>{title}</h2><span>{entries.length} result{entries.length === 1 ? '' : 's'}</span></div>
        {key === 'marketplace' ? <div className="product-grid">{entries.map((product) => <ProductCard key={product._id} listing={product} />)}</div>
          : key === 'lostFound' ? <div className="lost-found-grid">{entries.map((report) => <Link className="lost-found-card" to={`/lost-found/${report._id}`} key={report._id}><div className="lost-found-card-image">{report.images?.[0] ? <img src={report.images[0]} alt="" /> : <span aria-hidden="true">{report.type === 'lost' ? '🔎' : '📦'}</span>}<span className={`lost-found-type ${report.type}`}>{report.type}</span></div><div className="lost-found-card-body"><div className="lost-found-card-top"><span className="lost-found-category">{report.category}</span><span className="lost-found-status">{report.status}</span></div><h3>{report.title}</h3><p>{report.location}</p><time>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(report.date))}</time></div></Link>)}</div>
          : key === 'campusExchange' ? <div className="resource-grid exchange-grid">{entries.map((exchange) => <article className="resource-card exchange-card" key={exchange._id}><span className="resource-type">{exchange.category} · {exchange.condition}</span><h3><Link to={`/campus-exchange/${exchange._id}`}>{exchange.title}</Link></h3><p><strong>Offering:</strong> {exchange.offeredItem}</p><p><strong>Looking for:</strong> {exchange.wantedItem}</p><p>{exchange.location} · {exchange.owner?.college || 'Campus student'}</p><Link className="secondary-button" to={`/campus-exchange/${exchange._id}`}>View Exchange</Link></article>)}</div>
            : <div className="resource-grid">{entries.map((resource) => <article className="resource-card" key={resource._id}><span className="resource-type">{resourceNames[resource.type] || resource.type}</span><h3><Link to={`/resources/${resource._id}`}>{resource.title}</Link></h3><p>{[resource.subject, resource.course, resource.semester && `Semester ${resource.semester}`, resource.year].filter(Boolean).join(' · ')}</p><p className="resource-description">{resource.description || 'No description provided.'}</p><Link className="secondary-button" to={`/resources/${resource._id}`}>{resource.type === 'useful_link' ? 'Open Resource' : 'View Resource'}</Link></article>)}</div>}
      </section>)}
      <p className="campus-ai-real-data-note">Results are existing CampusMart listings, reports, and resources.</p>
    </div>}
  </section>
}

export default CampusAI
