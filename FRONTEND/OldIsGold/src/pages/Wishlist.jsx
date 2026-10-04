import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { useAuth } from '../context/useAuth'
import { wishlistApi } from '../services/api'

function Wishlist() {
  const navigate = useNavigate()
  const { user, token, loading: authLoading } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removingId, setRemovingId] = useState('')

  useEffect(() => {
    if (authLoading) return undefined
    if (!user || !token) {
      navigate('/login', { state: { from: '/wishlist' }, replace: true })
      return undefined
    }

    let active = true
    setLoading(true)
    setError('')
    wishlistApi.list(token)
      .then((data) => {
        if (active) setProducts(data.products || [])
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [authLoading, navigate, token, user])

  const removeProduct = async (productId) => {
    if (!token || removingId) return

    setRemovingId(productId)
    setError('')
    try {
      await wishlistApi.remove(token, productId)
      setProducts((current) => current.filter((product) => product._id !== productId))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setRemovingId('')
    }
  }

  if (authLoading || loading) {
    return <section className="placeholder"><strong>Loading your saved products...</strong></section>
  }

  if (error && products.length === 0) {
    return <section className="placeholder" role="alert"><strong>Unable to load your wishlist</strong><span>{error}</span></section>
  }

  return (
    <section className="wishlist-page">
      <div className="page-header-row">
        <div>
          <p className="eyebrow">Your shortlist</p>
          <h1>Saved products</h1>
        </div>
        <Link className="secondary-button" to="/marketplace">Browse marketplace</Link>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {products.length === 0 ? (
        <div className="empty-state">
          <strong>Your wishlist is empty.</strong>
          <span>Save a listing to keep it here.</span>
          <Link className="primary-button" to="/marketplace">Browse listings</Link>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard
              key={product._id}
              listing={product}
              isSaved
              isSaving={removingId === product._id}
              onToggleSave={removeProduct}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default Wishlist
