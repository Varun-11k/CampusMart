import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import CategoryStrip from '../components/CategoryStrip'
import ProductCard from '../components/ProductCard'
import SearchBar from '../components/SearchBar'
import { useAuth } from '../context/useAuth'
import { useWishlist } from '../hooks/useWishlist'
import { aiApi, productApi } from '../services/api'

const formatInr = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
}).format(Number(value || 0))

function Marketplace() {
    const location = useLocation()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { user, token } = useAuth()
    const { savedIds, pendingIds, loading: wishlistLoading, error: wishlistError, toggleSaved } = useWishlist()
    const [listings, setListings] = useState([])
    const [marketCategories, setMarketCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [resultCount, setResultCount] = useState(0)
    const [page, setPage] = useState(1)
    const [pages, setPages] = useState(1)
    const [category, setCategory] = useState(searchParams.get('category') || '')
    const [subcategory, setSubcategory] = useState('')
    const [condition, setCondition] = useState('')
    const [campus, setCampus] = useState('')
    const [price, setPrice] = useState('')
    const [sort, setSort] = useState('newest')
    const [naturalQuery, setNaturalQuery] = useState('')
    const [aiFilters, setAiFilters] = useState(null)
    const [aiResults, setAiResults] = useState(null)
    const [aiMode, setAiMode] = useState(false)
    const [aiSearching, setAiSearching] = useState(false)
    const [aiError, setAiError] = useState('')
    const [flashMessage, setFlashMessage] = useState(location.state?.successMessage || '')
    const search = searchParams.get('search') || ''

    useEffect(() => {
        let active = true

        productApi.categories().then((data) => {
            if (active) setMarketCategories(data.categories || [])
        }).catch((requestError) => {
            if (active) setError(requestError.message)
        })

        return () => { active = false }
    }, [])

    useEffect(() => {
        if (aiMode) return undefined
        let active = true
        setLoading(true)
        setError('')
        const timer = window.setTimeout(() => {
            const [minPrice, maxPrice] = price === 'under-500' ? ['0', '499.99']
                : price === '500-1000' ? ['500', '1000']
                    : price === '1000-5000' ? ['1000.01', '5000']
                        : price === 'above-5000' ? ['5000.01', ''] : ['', '']
            const sortBy = sort === 'price-low' ? 'price-asc' : sort === 'price-high' ? 'price-desc' : 'newest'
            productApi.list({ search: search.trim(), category, subcategory, condition, location: campus.trim(), minPrice, maxPrice, sort: sortBy, page, limit: 20 }).then((data) => {
                if (!active) return
                setListings(data.products || [])
                setMarketCategories(data.categories || [])
                setResultCount(data.count || 0)
                setPages(data.pagination?.pages || 1)
            }).catch((requestError) => {
                if (active) setError(requestError.message)
            }).finally(() => {
                if (active) setLoading(false)
            })
        }, search ? 250 : 0)
        return () => { active = false; window.clearTimeout(timer) }
    }, [aiMode, campus, category, condition, page, price, search, sort, subcategory])

    useEffect(() => {
        setFlashMessage(location.state?.successMessage || '')
    }, [location.key, location.state])

    const handleToggleSave = (id) => {
        if (!user || !token) {
            navigate('/login', { state: { from: '/marketplace' } })
            return
        }
        toggleSaved(id)
    }

    const leaveAiSearch = () => {
        setAiMode(false)
        setAiFilters(null)
        setAiResults(null)
        setAiError('')
    }

    const runAiSearch = async (filterOverrides = null) => {
        if (!naturalQuery.trim()) {
            setAiError('Enter a natural-language query first.')
            return
        }

        setAiSearching(true)
        setAiError('')
        try {
            const payload = { query: naturalQuery.trim() }
            if (filterOverrides) payload.filters = filterOverrides
            const data = await aiApi.search(payload)
            setAiFilters(data.filters)
            setAiResults(data.products || [])
            setAiMode(true)
        } catch {
            setAiMode(false)
            setAiFilters(null)
            setAiResults(null)
            setAiError('AI search is temporarily unavailable. Try the regular search.')
        } finally {
            setAiSearching(false)
        }
    }

    const removeAiFilter = (field) => {
        if (!aiFilters) return
        runAiSearch({ ...aiFilters, [field]: null })
    }

    const handleNormalSearchChange = (value) => {
        if (aiMode) leaveAiSearch()
        setPage(1)
        const nextParams = {}
        if (value) nextParams.search = value
        if (category) nextParams.category = category
        setSearchParams(nextParams, { replace: true })
    }

    const handleCategoryChange = (value) => {
        leaveAiSearch()
        setCategory(value)
        setPage(1)
        const nextParams = {}
        if (search) nextParams.search = search
        if (value) nextParams.category = value
        setSearchParams(nextParams, { replace: true })
    }
    const displayedListings = aiMode ? aiResults || [] : listings

    const interpretedFilters = aiFilters ? [
        aiFilters.searchText && { field: 'searchText', label: `Search: ${aiFilters.searchText}` },
        aiFilters.category && { field: 'category', label: `Category: ${aiFilters.category}` },
        aiFilters.condition && { field: 'condition', label: `Condition: ${aiFilters.condition}` },
        aiFilters.minPrice !== null && { field: 'minPrice', label: `Minimum price: ${formatInr(aiFilters.minPrice)}` },
        aiFilters.maxPrice !== null && { field: 'maxPrice', label: `Maximum price: ${formatInr(aiFilters.maxPrice)}` },
    ].filter(Boolean) : []

    return (
        <section className="marketplace-page">
            <div className="marketplace-heading">
                <div>
                    <p className="eyebrow">Your campus, in one place</p>
                    <h1>Marketplace</h1>
                    <p className="lead">Find your next useful thing from someone nearby.</p>
                </div>
                <SearchBar value={search} onChange={handleNormalSearchChange} />
            </div>

            <form className="ai-search-form" onSubmit={(event) => { event.preventDefault(); runAiSearch() }}>
                <label className="ai-search-input-label">
                    <span>Search products naturally</span>
                    <input
                        type="search"
                        value={naturalQuery}
                        maxLength={300}
                        onChange={(event) => { setNaturalQuery(event.target.value); setAiError('') }}
                        placeholder="Try: calculator under ₹1000"
                    />
                </label>
                <button className="primary-button ai-search-button" type="submit" disabled={aiSearching || loading}>
                    {aiSearching ? 'Searching...' : '✨ AI Search'}
                </button>
            </form>

            {aiError && <div className="ai-search-error" role="alert"><span>{aiError}</span><button className="secondary-button" type="button" onClick={leaveAiSearch}>Use regular search</button></div>}

            {aiMode && aiFilters && (
                <section className="ai-interpreted-filters" aria-label="AI interpreted filters">
                    <div className="ai-interpreted-heading">
                        <div>
                            <p className="eyebrow">Interpreted filters</p>
                            <h2>Real marketplace matches</h2>
                        </div>
                        <button className="secondary-button" type="button" onClick={leaveAiSearch}>Use regular search</button>
                    </div>
                    {interpretedFilters.length > 0 ? (
                        <div className="ai-filter-chips">
                            {interpretedFilters.map((filter) => (
                                <button key={filter.field} className="ai-filter-chip" type="button" onClick={() => removeAiFilter(filter.field)} disabled={aiSearching} aria-label={`Remove ${filter.label} filter`}>
                                    {filter.label}<span aria-hidden="true">×</span>
                                </button>
                            ))}
                        </div>
                    ) : <p className="ai-no-filters">No specific filters were inferred; showing available products.</p>}
                </section>
            )}

            {flashMessage && <div className="form-success marketplace-success" role="status">{flashMessage}</div>}

            {!aiMode && <CategoryStrip categories={marketCategories} activeCategory={category} onSelect={(value) => { setSubcategory(''); handleCategoryChange(value) }} />}

            {!aiMode && <div className="marketplace-toolbar">
                <p><strong>{resultCount}</strong> listings</p>
                <div className="filter-row">
                    {marketCategories.find((item) => item.name === category)?.subcategories?.length > 0 && (
                        <select value={subcategory} onChange={(event) => { setSubcategory(event.target.value); setPage(1) }} aria-label="Filter by subcategory">
                            <option value="">All subcategories</option>
                            {marketCategories.find((item) => item.name === category).subcategories.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                    )}
                    <input type="search" value={campus} onChange={(event) => { setCampus(event.target.value); setPage(1) }} placeholder="Campus or pickup location" aria-label="Filter by campus or pickup location" />
                    <select value={price} onChange={(event) => { leaveAiSearch(); setPrice(event.target.value); setPage(1) }} aria-label="Filter by price">
                        <option value="">Any price</option>
                        <option value="under-500">Under ₹500</option>
                        <option value="500-1000">₹500–₹1,000</option>
                        <option value="1000-5000">₹1,000–₹5,000</option>
                        <option value="above-5000">Above ₹5,000</option>
                    </select>
                    <select value={condition} onChange={(event) => { leaveAiSearch(); setCondition(event.target.value); setPage(1) }} aria-label="Filter by condition">
                        <option value="">Any condition</option>
                        <option>New</option>
                        <option>Like New</option>
                        <option>Good</option>
                        <option>Fair</option>
                    </select>
                    <select value={sort} onChange={(event) => { leaveAiSearch(); setSort(event.target.value); setPage(1) }} aria-label="Sort listings">
                        <option value="newest">Newest</option>
                        <option value="price-low">Price: Low to High</option>
                        <option value="price-high">Price: High to Low</option>
                    </select>
                </div>
            </div>}

            {wishlistError && <p className="form-error" role="alert">Saved products could not be loaded: {wishlistError}</p>}

            {aiSearching ? <div className="empty-state" role="status">Searching real marketplace listings...</div>
                : loading ? <div className="empty-state">Loading listings...</div>
                : error ? <div className="empty-state" role="alert"><strong>Listings could not be loaded.</strong><span>{error}</span></div>
                    : displayedListings.length > 0 ? (
                        <div className="product-grid">
                            {displayedListings.map((listing) => (
                                <ProductCard key={listing._id} listing={listing} isSaved={savedIds.includes(listing._id)} isSaving={wishlistLoading || pendingIds.includes(listing._id)} onToggleSave={handleToggleSave} />
                            ))}
                        </div>
                    ) : <div className="empty-state"><strong>{aiMode ? 'No real listings match those interpreted filters.' : 'No products found.'}</strong></div>}
            {!aiMode && pages > 1 && !loading && !error && (
                <nav className="notification-pagination" aria-label="Marketplace pages">
                    <button type="button" className="secondary-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button>
                    <span>Page {page} of {pages}</span>
                    <button type="button" className="secondary-button" onClick={() => setPage((current) => Math.min(pages, current + 1))} disabled={page >= pages}>Next</button>
                </nav>
            )}
        </section>
    )
}

export default Marketplace