import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import LoadingSkeletons from '../components/LoadingSkeletons'
import { useAuth } from '../context/useAuth'
import { engagementApi, productApi } from '../services/api'

function Profile() {
    const { user, token, loading, logout } = useAuth()
    const [products, setProducts] = useState([])
    const [community, setCommunity] = useState(null)
    const [productsLoading, setProductsLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!token) { setProductsLoading(false); setCommunity(null); return undefined }
        let active = true
        productApi.mine(token).then((data) => { if (active) setProducts(data.products || []) }).catch((requestError) => { if (active) setError(requestError.message) }).finally(() => { if (active) setProductsLoading(false) })
        engagementApi.points(token).then((data) => { if (active) setCommunity(data) }).catch(() => {})
        return () => { active = false }
    }, [token])

    if (loading) return <section className="placeholder"><LoadingSkeletons variant="profile" count={3} label="Loading your profile" /></section>
    if (!user) return <Navigate to="/login" replace />

    return <section className="profile-page">
        <div className="profile-cover"><div className="profile-overview"><div className="profile-avatar" aria-hidden="true">{user.name?.trim().charAt(0).toUpperCase()}</div><div><p className="eyebrow">Your CampusMart profile</p><h1>{user.name}</h1><p>{user.college}</p><span className="profile-verification">{user.isVerified ? 'Verified student' : 'Student account'}</span></div><button className="secondary-button profile-logout" type="button" onClick={logout}>Log out</button></div>
          <div className="profile-community-stats"><div><strong>{community?.balance ?? '—'}</strong><span>Campus points</span></div><div><strong>{community?.reputation?.completedExchanges ?? 0}</strong><span>Completed exchanges</span></div><div><strong>{community?.reputation?.sharedResources ?? 0}</strong><span>Resources shared</span></div></div>
          {community?.badges?.length > 0 && <div className="profile-badges" aria-label="Earned badges">{community.badges.map((badge) => <span className="profile-badge" key={badge._id}><span aria-hidden="true">{badge.icon || '✦'}</span>{badge.name}</span>)}</div>}
        </div>
        <nav className="profile-shortcuts" aria-label="Your CampusMart pages"><Link to="/wishlist"><span aria-hidden="true">♡</span>Wishlist</Link><Link to="/campus-exchange/my-exchanges"><span aria-hidden="true">⇄</span>My Exchanges</Link><Link to="/resources/my-resources"><span aria-hidden="true">▤</span>My Resources</Link><Link to="/lost-found/my-reports"><span aria-hidden="true">⌕</span>My Reports</Link></nav>
        <div className="profile-listings-heading" id="listings"><div><p className="eyebrow">Your activity</p><h2>My listings</h2></div><Link className="primary-button" to="/sell">List a product</Link></div>
        {error ? <div className="empty-state" role="alert"><strong>Your listings could not be loaded.</strong><span>{error}</span></div> : productsLoading ? <LoadingSkeletons variant="product" count={3} label="Loading your listings" /> : products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product._id} listing={product} />)}</div> : <div className="empty-state"><strong>You haven’t listed anything yet.</strong><span>Your products will appear here after you publish them.</span><Link className="primary-button" to="/sell">List your first item</Link></div>}
    </section>
}

export default Profile
