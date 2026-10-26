import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import CategoryStrip from '../components/CategoryStrip'
import HowItWorks from '../components/HowItWorks'
import ProductCard from '../components/ProductCard'
import SearchBar from '../components/SearchBar'
import { useAuth } from '../context/useAuth'
import { useWishlist } from '../hooks/useWishlist'
import { campusVoiceApi, engagementApi, lostFoundApi, productApi, recommendationApi } from '../services/api'

const services = [
    { icon: '▧', eyebrow: 'Buy & sell', title: 'Marketplace', description: 'Discover books, electronics, clothes, room essentials, and more.', to: '/marketplace', action: 'Browse listings', tone: 'marketplace' },
    { icon: '⌕', eyebrow: 'Look out for each other', title: 'Lost & Found', description: 'Share a report or help a missing item get home.', to: '/lost-found', action: 'Browse reports', tone: 'lost-found' },
    { icon: '♡', eyebrow: 'Your voice matters', title: 'Anonymous confessions', description: 'Read what students are sharing, anonymously.', to: '/campus-voices?category=confession', action: 'Read confessions', tone: 'confessions' },
]

function Home() {
    const [search, setSearch] = useState('')
    const [listings, setListings] = useState([])
    const [marketCategories, setMarketCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [listingError, setListingError] = useState('')
    const [recommendationResult, setRecommendationResult] = useState({ token: '', products: [] })
    const [deals, setDeals] = useState([])
    const [dealsLoading, setDealsLoading] = useState(true)
    const [trending, setTrending] = useState([])
    const [reports, setReports] = useState([])
    const [reportsLoading, setReportsLoading] = useState(true)
    const [reportsError, setReportsError] = useState('')
    const [confessions, setConfessions] = useState([])
    const [confessionsLoading, setConfessionsLoading] = useState(true)
    const [confessionsError, setConfessionsError] = useState('')
    const navigate = useNavigate()
    const { user, token, loading: authLoading } = useAuth()
    const { savedIds, pendingIds, loading: wishlistLoading, error: wishlistError, toggleSaved } = useWishlist()
    const recommendations = token && recommendationResult.token === token ? recommendationResult.products : []
    const recommendationsLoading = Boolean(token && !authLoading && recommendationResult.token !== token)
    const popularCategories = [...marketCategories].sort((a, b) => (b.listingCount || 0) - (a.listingCount || 0)).slice(0, 8)

    const handleSearchKeyDown = (event) => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        const query = search.trim()
        navigate(query ? `/marketplace?search=${encodeURIComponent(query)}` : '/marketplace')
    }

    useEffect(() => {
        let active = true
        Promise.all([productApi.list({ limit: 4 }), productApi.categories()]).then(([data, categoryData]) => {
            if (!active) return
            setListings(Array.isArray(data.products) ? data.products : [])
            setMarketCategories(categoryData.categories || [])
        }).catch((error) => {
            if (active) setListingError(error.message)
        }).finally(() => {
            if (active) setLoading(false)
        })

        return () => { active = false }
    }, [])

    useEffect(() => {
        let active = true
        lostFoundApi.list({ page: 1, limit: 3 }).then((data) => {
            if (active) setReports(data.reports || [])
        }).catch((error) => {
            if (active) setReportsError(error.message)
        }).finally(() => {
            if (active) setReportsLoading(false)
        })
        return () => { active = false }
    }, [])

    useEffect(() => {
        let active = true
        campusVoiceApi.list({ category: 'confession', sort: 'recent', page: 1, limit: 3 }, token).then((data) => {
            if (active) setConfessions(data.posts || [])
        }).catch((error) => {
            if (active) setConfessionsError(error.message)
        }).finally(() => {
            if (active) setConfessionsLoading(false)
        })
        return () => { active = false }
    }, [token])

    useEffect(() => {
        if (authLoading || !token) return undefined

        let active = true
        recommendationApi.list(token)
            .then((data) => {
                if (active) setRecommendationResult({ token, products: data.personalized ? data.products || [] : [] })
            })
            .catch(() => {
                if (active) setRecommendationResult({ token, products: [] })
            })

        return () => { active = false }
    }, [authLoading, token])

    useEffect(() => {
        let active = true
        Promise.all([
            engagementApi.deals({ page: 1, limit: 6 }),
            engagementApi.trending(),
        ]).then(([dealData, trendingData]) => {
            if (!active) return
            setDeals(dealData.deals || [])
            setTrending(trendingData.products || [])
        }).catch(() => {
            if (active) {
                setDeals([])
                setTrending([])
            }
        }).finally(() => {
            if (active) setDealsLoading(false)
        })

        return () => { active = false }
    }, [])

    const handleToggleSave = (id) => {
        if (!user || !token) {
            navigate('/login', { state: { from: '/' } })
            return
        }
        toggleSaved(id)
    }

    return <>
        <section className="home-hero">
            <div className="hero-copy">
                <p className="eyebrow"><span className="hero-live-dot" aria-hidden="true" /> Made for campus life</p>
                <h1>Your campus.<br /><span>Your marketplace.</span></h1>
                <p className="lead">Find what you need, return what someone lost, and feel a little more connected to campus.</p>
                <div className="hero-actions">
                    <Link className="primary-button" to="/marketplace">Explore marketplace <span aria-hidden="true">→</span></Link>
                    <Link className="secondary-button" to="/lost-found">Lost &amp; Found</Link>
                    <Link className="hero-text-link" to="/campus-voices?category=confession">Read confessions</Link>
                </div>
                <form className="home-search" role="search" onSubmit={(event) => {
                    event.preventDefault()
                    const query = search.trim()
                    navigate(query ? `/marketplace?search=${encodeURIComponent(query)}` : '/marketplace')
                }}>
                    <SearchBar value={search} onChange={setSearch} onKeyDown={handleSearchKeyDown} />
                    <button className="primary-button" type="submit">Search</button>
                </form>
                <p className="search-hint">Search real listings by title, category, or college.</p>
            </div>
            <div className="hero-note" aria-hidden="true">
                <div className="hero-note-orbit"><span className="hero-note-star">✳</span></div>
                <p>Good finds,<br /><strong>closer to home.</strong></p>
                <span className="hero-note-caption">Campus life, shared.</span>
            </div>
        </section>

        <section className="service-section" aria-labelledby="services-heading">
            <div className="section-heading"><div><p className="eyebrow">One campus, lots to discover</p><h2 id="services-heading">Your community starts here</h2></div></div>
            <div className="service-grid">{services.map((service) => <Link className={`service-card service-card-${service.tone}`} to={service.to} key={service.title}>
                <span className="service-icon" aria-hidden="true">{service.icon}</span>
                <span className="service-eyebrow">{service.eyebrow}</span>
                <strong>{service.title}</strong>
                <span className="service-description">{service.description}</span>
                <span className="service-action">{service.action}<span aria-hidden="true"> →</span></span>
            </Link>)}</div>
        </section>

        <section className="category-section"><div className="section-heading"><div><p className="eyebrow">Browse by need</p><h2>Popular categories</h2></div><Link to="/marketplace" className="text-link">See all categories →</Link></div><CategoryStrip categories={popularCategories} onSelect={(category) => navigate(category ? `/marketplace?category=${encodeURIComponent(category)}` : '/marketplace')} /></section>

        <section className="featured-section home-data-section">
            <div className="section-heading"><div><p className="eyebrow">Fresh on campus</p><h2>Recently listed items</h2></div><Link to="/marketplace" className="text-link">Explore all listings →</Link></div>
            {loading ? <div className="empty-state" role="status">Loading current listings...</div>
                : listingError ? <div className="empty-state" role="alert"><strong>Recent listings could not be loaded.</strong><span>{listingError}</span></div>
                    : listings.length ? <div className="product-grid">{listings.slice(0, 4).map((listing) => <ProductCard key={listing._id} listing={listing} isSaved={savedIds.includes(listing._id)} isSaving={wishlistLoading || pendingIds.includes(listing._id)} onToggleSave={handleToggleSave} />)}</div>
                        : <div className="empty-state"><strong>No listings yet.</strong><span>Browse all current campus listings or check back later.</span><Link className="text-link" to="/marketplace">Browse marketplace →</Link></div>}
        </section>

        <section className="featured-section home-data-section">
            <div className="section-heading"><div><p className="eyebrow">Help reunite an item</p><h2>Recently reported</h2></div><Link to="/lost-found" className="text-link">Visit Lost &amp; Found →</Link></div>
            {reportsLoading ? <div className="empty-state" role="status">Loading recent reports...</div>
                : reportsError ? <div className="empty-state" role="alert"><strong>Recent reports could not be loaded.</strong><span>{reportsError}</span></div>
                    : reports.length ? <div className="recent-report-grid">{reports.map((report) => <Link className="recent-report-card" to={`/lost-found/${report._id}`} key={report._id}>
                        <span className={`recent-report-type ${report.type}`}>{report.type === 'lost' ? 'Lost item' : 'Found item'}</span>
                        <strong>{report.title}</strong><span>{report.category} · {report.location}</span>
                    </Link>)}</div>
                        : <div className="empty-state"><strong>No recent reports.</strong><span>New reports from the community will appear here.</span></div>}
        </section>

        <section className="featured-section home-data-section">
            <div className="section-heading"><div><p className="eyebrow">Shared anonymously</p><h2>Recent confessions</h2></div><Link to="/campus-voices?category=confession" className="text-link">Visit Campus Voices →</Link></div>
            {confessionsLoading ? <div className="empty-state" role="status">Loading recent confessions...</div>
                : confessionsError ? <div className="empty-state" role="alert"><strong>Recent confessions could not be loaded.</strong><span>{confessionsError}</span></div>
                    : confessions.length ? <div className="recent-confession-grid">{confessions.map((post) => <Link className="recent-confession-card" to={`/campus-voices/${post._id}`} key={post._id}>
                        <span className="confession-label">Anonymous student · Confession</span><p>{post.content}</p><span className="confession-read">Read confession →</span>
                    </Link>)}</div>
                        : <div className="empty-state"><strong>No recent confessions.</strong><span>New anonymous posts from the campus community will appear here.</span><Link className="text-link" to="/campus-voices/create">Share a confession →</Link></div>}
        </section>

        <section className="recommendations-section"><div className="section-heading"><div><p className="eyebrow">Picked from your activity</p><h2>Recommended for you</h2></div><Link to="/marketplace" className="text-link">Browse all listings →</Link></div>{recommendationsLoading ? <div className="empty-state">Finding relevant listings...</div> : recommendations.length ? <div className="product-grid">{recommendations.map((listing) => <ProductCard key={listing._id} listing={listing} isSaved={savedIds.includes(listing._id)} isSaving={wishlistLoading || pendingIds.includes(listing._id)} onToggleSave={handleToggleSave} recommendationReason={listing.recommendationReason} />)}</div> : <div className="recommendation-fallback"><p>Explore products to get personalized recommendations.</p>{loading ? <span>Loading current listings...</span> : listings.length ? <Link className="text-link" to="/marketplace">Explore {listings.length} current marketplace listings →</Link> : <span>{listingError || 'There are no available marketplace listings right now.'}</span>}</div>}</section>

        <section className="featured-section"><div className="section-heading"><div><p className="eyebrow">Campus Deals</p><h2>Deals of the day</h2></div><Link to="/deals" className="text-link">View campus deals →</Link></div>{dealsLoading ? <div className="empty-state">Loading campus deals...</div> : deals.length ? <div className="product-grid">{deals.map((listing) => <ProductCard key={listing._id} listing={listing} isSaved={savedIds.includes(listing._id)} isSaving={wishlistLoading || pendingIds.includes(listing._id)} onToggleSave={handleToggleSave} recommendationReason={listing.offer ? `Flash offer: ₹${listing.offer.offerPrice}` : null} />)}</div> : <div className="empty-state"><strong>No active deals right now.</strong><span>Check back or browse the full marketplace.</span></div>}</section>
        {trending.length > 0 && <section className="featured-section"><div className="section-heading"><div><p className="eyebrow">This week</p><h2>Trending products</h2></div><Link to="/marketplace" className="text-link">See trending →</Link></div><div className="product-grid">{trending.map((listing) => <ProductCard key={listing._id} listing={listing} isSaved={savedIds.includes(listing._id)} isSaving={wishlistLoading || pendingIds.includes(listing._id)} onToggleSave={handleToggleSave} />)}</div></section>}
        <section className="featured-section"><div className="section-heading"><div><p className="eyebrow">Fresh on campus</p><h2>Featured listings</h2></div><Link to="/marketplace" className="text-link">View all listings →</Link></div>{wishlistError && <p className="form-error" role="alert">Saved products could not be loaded: {wishlistError}</p>}{loading ? <div className="empty-state">Loading listings...</div> : listings.length ? <div className="product-grid">{listings.map((listing) => <ProductCard key={listing._id} listing={listing} isSaved={savedIds.includes(listing._id)} isSaving={wishlistLoading || pendingIds.includes(listing._id)} onToggleSave={handleToggleSave} />)}</div> : <div className="empty-state"><strong>{listingError ? 'Listings could not be loaded.' : 'No products listed yet.'}</strong><span>{listingError || 'New listings from your campus will appear here.'}</span></div>}</section>
        <section className="home-join-cta"><div><p className="eyebrow">CampusMart is better together</p><h2>Make campus life a little easier.</h2><p>Join the community to list an item, save a find, or start a conversation.</p></div><Link className="primary-button" to={user ? '/sell' : '/register'}>{user ? 'List an item' : 'Join CampusMart'}<span aria-hidden="true">→</span></Link></section>
        <HowItWorks />
    </>
}

export default Home
