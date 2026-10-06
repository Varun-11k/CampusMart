import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import CategoryStrip from '../components/CategoryStrip'
import HowItWorks from '../components/HowItWorks'
import InstallAppButton from '../components/InstallAppButton'
import ProductCard from '../components/ProductCard'
import SearchBar from '../components/SearchBar'
import { useAuth } from '../context/useAuth'
import { useWishlist } from '../hooks/useWishlist'
import { productApi, recommendationApi, engagementApi } from '../services/api'

function Home() {
    const [search, setSearch] = useState('')
    const [listings, setListings] = useState([])
    const [loading, setLoading] = useState(true)
    const [recommendations, setRecommendations] = useState([])
    const [recommendationsLoading, setRecommendationsLoading] = useState(false)
    const [deals, setDeals] = useState([])
    const [dealsLoading, setDealsLoading] = useState(false)
    const [trending, setTrending] = useState([])
    const navigate = useNavigate()
    const { user, token, loading: authLoading } = useAuth()
    const { savedIds, pendingIds, loading: wishlistLoading, error: wishlistError, toggleSaved } = useWishlist()

    const handleSearchKeyDown = (event) => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        const query = search.trim()
        navigate(query ? `/marketplace?search=${encodeURIComponent(query)}` : '/marketplace')
    }

    useEffect(() => {
        let active = true
        productApi.list().then((data) => {
            if (active) setListings(data.products.slice(0, 4))
        }).catch(() => {
            if (active) setListings([])
        }).finally(() => {
            if (active) setLoading(false)
        })

        return () => { active = false }
    }, [])

    useEffect(() => {
        if (authLoading) return undefined
        if (!token) {
            setRecommendations([])
            setRecommendationsLoading(false)
            return undefined
        }

        let active = true
        setRecommendationsLoading(true)
        recommendationApi.list(token)
            .then((data) => {
                if (active) setRecommendations(data.personalized ? data.products || [] : [])
            })
            .catch(() => {
                if (active) setRecommendations([])
            })
            .finally(() => {
                if (active) setRecommendationsLoading(false)
            })

        return () => { active = false }
    }, [authLoading, token])

    useEffect(() => {
        let active = true
        setDealsLoading(true)
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
        <section className="home-hero"><div className="hero-copy"><p className="eyebrow">The student marketplace</p><h1>Buy &amp; sell right on campus.</h1><p className="lead">Find useful things from people in your college community, or give your own essentials a second life.</p><div className="hero-actions"><Link className="primary-button" to="/marketplace">Browse marketplace <span>→</span></Link><Link className="secondary-button" to="/sell">Sell an item</Link><InstallAppButton /></div></div><div className="hero-note"><span>✦</span><p>Better finds,<br /><strong>closer to home.</strong></p></div></section>
        <section className="home-search"><p className="eyebrow">What are you looking for?</p><SearchBar value={search} onChange={setSearch} onKeyDown={handleSearchKeyDown} /><p className="search-hint">Press Enter to search listings.</p></section>
        <section className="category-section"><div className="section-heading"><div><p className="eyebrow">Browse by need</p><h2>Find your category</h2></div><Link to="/marketplace" className="text-link">See all categories →</Link></div><CategoryStrip /></section>
        <section className="recommendations-section"><div className="section-heading"><div><p className="eyebrow">Picked from your activity</p><h2>Recommended for you</h2></div><Link to="/marketplace" className="text-link">Browse all listings →</Link></div>{recommendationsLoading ? <div className="empty-state">Finding relevant listings...</div> : recommendations.length ? <div className="product-grid">{recommendations.map((listing) => <ProductCard key={listing._id} listing={listing} isSaved={savedIds.includes(listing._id)} isSaving={wishlistLoading || pendingIds.includes(listing._id)} onToggleSave={handleToggleSave} recommendationReason={listing.recommendationReason} />)}</div> : <div className="recommendation-fallback"><p>Explore products to get personalized recommendations.</p>{loading ? <span>Loading current listings...</span> : listings.length ? <Link className="text-link" to="/marketplace">Explore {listings.length} current marketplace listings →</Link> : <span>There are no available marketplace listings right now.</span>}</div>}</section>
        <section className="featured-section"><div className="section-heading"><div><p className="eyebrow">Campus Deals</p><h2>Deals of the day</h2></div><Link to="/marketplace" className="text-link">View all listings →</Link></div>{dealsLoading ? <div className="empty-state">Loading campus deals...</div> : deals.length ? <div className="product-grid">{deals.map((listing) => <ProductCard key={listing._id} listing={listing} isSaved={savedIds.includes(listing._id)} isSaving={wishlistLoading || pendingIds.includes(listing._id)} onToggleSave={handleToggleSave} recommendationReason={listing.offer ? `🔥 Flash offer: ₹${listing.offer.offerPrice}` : null} />)}</div> : <div className="empty-state"><strong>No active deals right now.</strong><span>Check back or browse the full marketplace.</span></div>}</section>
        {trending.length > 0 && <section className="featured-section"><div className="section-heading"><div><p className="eyebrow">This week</p><h2>Trending products</h2></div><Link to="/marketplace" className="text-link">See trending →</Link></div><div className="product-grid">{trending.map((listing) => <ProductCard key={listing._id} listing={listing} isSaved={savedIds.includes(listing._id)} isSaving={wishlistLoading || pendingIds.includes(listing._id)} onToggleSave={handleToggleSave} />)}</div></section>}
        <section className="featured-section"><div className="section-heading"><div><p className="eyebrow">Fresh on campus</p><h2>Featured listings</h2></div><Link to="/marketplace" className="text-link">View all listings →</Link></div>{wishlistError && <p className="form-error" role="alert">Saved products could not be loaded: {wishlistError}</p>}{loading ? <div className="empty-state">Loading listings...</div> : listings.length ? <div className="product-grid">{listings.map((listing) => <ProductCard key={listing._id} listing={listing} isSaved={savedIds.includes(listing._id)} isSaving={wishlistLoading || pendingIds.includes(listing._id)} onToggleSave={handleToggleSave} />)}</div> : <div className="empty-state"><strong>No products listed yet.</strong><span>New listings from your campus will appear here.</span></div>}</section>
        <HowItWorks />
    </>
}
export default Home