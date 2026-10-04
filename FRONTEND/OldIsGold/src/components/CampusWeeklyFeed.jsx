import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from './ProductCard'
import { useAuth } from '../context/useAuth'
import { campusAIApi, engagementApi } from '../services/api'

function FeedSkeleton() {
  return <div className="feed-skeleton-grid" aria-label="Loading campus feed" role="status"><span className="sr-only">Loading campus feed…</span>{[0, 1, 2].map((item) => <div className="feed-skeleton" key={item}><span /><span /><span /></div>)}</div>
}

function CampusWeeklyFeed() {
  const { token } = useAuth()
  const [feed, setFeed] = useState(null)
  const [recent, setRecent] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [points, setPoints] = useState(0)
  const [badges, setBadges] = useState([])
  const [reputation, setReputation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadFeed = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await engagementApi.feed(token)
      setFeed(data.feed)
    } catch {
      setError('We couldn’t load the campus feed right now.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { loadFeed() }, [loadFeed])

  useEffect(() => {
    if (!token) { setRecent([]); setRecommendations([]); setPoints(0); setBadges([]); setReputation(null); return undefined }
    let active = true
    engagementApi.recentlyViewed(token).then((data) => active && setRecent(data.products || [])).catch(() => { })
    engagementApi.points(token).then((data) => { if (active) { setPoints(data.balance || 0); setBadges(data.badges || []); setReputation(data.reputation || null) } }).catch(() => { })
    campusAIApi.recommendations(token).then((data) => active && setRecommendations(data.recommendations?.marketplace || [])).catch(() => { })
    return () => { active = false }
  }, [token])

  if (loading) return <section className="campus-weekly-feed" id="weekly-campus"><FeedSkeleton /></section>
  if (error || !feed) return <section className="campus-weekly-feed" id="weekly-campus"><div className="feed-error" role="alert"><strong>Campus feed unavailable</strong><span>{error || 'Please try again.'}</span><button className="secondary-button" type="button" onClick={loadFeed}>Try again</button></div></section>

  return <div className="campus-weekly-feed" id="weekly-campus">
    <div className="feed-heading"><div><p className="eyebrow">A little of everything</p><h2>This week on campus</h2></div><Link className="text-link" to="/campus-ai">Explore with Campus AI →</Link></div>

    <section className="feed-section"><div className="campus-ai-section-heading"><h2>🔥 Trending</h2><Link to="/marketplace">Marketplace</Link></div>{feed.trending?.length ? <div className="product-grid">{feed.trending.slice(0, 4).map((product) => <ProductCard key={product._id} listing={product} />)}</div> : <p className="empty-state">Nothing is trending this week yet.</p>}</section>

    <section className="feed-section"><div className="campus-ai-section-heading"><h2>🎁 Campus Deals</h2><Link to="/deals">All deals</Link></div>{feed.deals?.length ? <div className="resource-grid">{feed.deals.slice(0, 4).map((product) => <article className="resource-card" key={product._id}><span className="resource-type">Flash offer</span><h3><Link to={`/products/${product._id}`}>{product.title}</Link></h3><p><strong>₹{Number(product.offer.offerPrice).toLocaleString('en-IN')}</strong> · listed ₹{Number(product.price).toLocaleString('en-IN')}</p></article>)}</div> : <p className="empty-state">No active deals right now.</p>}</section>

    <section className="feed-section"><div className="campus-ai-section-heading"><h2>🔄 Exchange opportunities</h2><Link to="/campus-exchange">Explore exchanges</Link></div>{feed.exchanges?.length ? <div className="resource-grid">{feed.exchanges.slice(0, 4).map((item) => <article className="resource-card" key={item._id}><span className="resource-type">Exchange</span><h3><Link to={`/campus-exchange/${item._id}`}>{item.title}</Link></h3><p><strong>I have</strong> · {item.offeredItem}</p><p><strong>I want</strong> · {item.wantedItem}</p></article>)}</div> : <p className="empty-state">No active exchange listings yet.</p>}</section>

    <section className="feed-section"><div className="campus-ai-section-heading"><h2>📚 Popular resources</h2><Link to="/resources">Browse resources</Link></div>{feed.resources?.length ? <div className="resource-grid">{feed.resources.slice(0, 4).map((item) => <article className="resource-card" key={item._id}><span className="resource-type">{item.type?.replace('_', ' ')}</span><h3><Link to={`/resources/${item._id}`}>{item.title}</Link></h3><p>{item.subject}{item.downloads ? ` · ${item.downloads} views` : ''}</p></article>)}</div> : <p className="empty-state">No popular resources this week yet.</p>}</section>
  </div>
}

export default CampusWeeklyFeed
