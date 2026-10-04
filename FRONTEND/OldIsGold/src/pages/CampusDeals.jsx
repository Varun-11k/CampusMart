import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { engagementApi } from '../services/api'
import { useAuth } from '../context/useAuth'

function CampusDealsListing() {
  const [deals, setDeals] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { let active = true; engagementApi.deals().then((data) => active && setDeals(data.deals || [])).catch((requestError) => active && setError(requestError.message)).finally(() => active && setLoading(false)); return () => { active = false } }, [])
  return <section className="resources-page"><div className="resources-heading"><div><p className="eyebrow">Seller-created offers</p><h1>Campus Deals</h1><p>Active offers on real marketplace listings.</p></div><Link className="secondary-button" to="/marketplace">Browse marketplace</Link></div>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <div className="empty-state">Loading active offers...</div> : deals.length ? <div className="product-grid">{deals.map((product) => <div key={product._id}><span className="resource-type">FLASH OFFER · {product.offer.endTime && `Ends ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(product.offer.endTime))}`}</span><ProductCard listing={{ ...product, price: product.offer.offerPrice }} /><p>Original listed price: ₹{Number(product.price).toLocaleString('en-IN')}{product.discountPercent > 0 && ` · ${product.discountPercent}% below listed price`}</p></div>)}</div> : <div className="empty-state">No active deals right now.</div>}</section>
}

function CampusCoupons() {
  const { token } = useAuth(); const [coupons, setCoupons] = useState([]); const [amounts, setAmounts] = useState({}); const [message, setMessage] = useState('')
  useEffect(() => { engagementApi.coupons().then((data) => setCoupons(data.coupons || [])).catch(() => {}) }, [])
  return <section className="resources-page"><div className="resources-heading"><div><p className="eyebrow">Available codes</p><h2>Campus Coupons</h2><p>Coupon claims are informational and do not process payment.</p></div></div>{message && <p role="status">{message}</p>}{coupons.length ? <div className="resource-grid">{coupons.map((coupon) => <article className="resource-card" key={coupon._id}><span className="resource-type">{coupon.code}</span><h3>{coupon.type === 'percentage' ? `${coupon.value}% off` : `₹${coupon.value} off`}</h3><p>Minimum listed amount: ₹{coupon.minimumPurchase}{coupon.maximumDiscount ? ` · Max discount ₹${coupon.maximumDiscount}` : ''}</p><p>Expires {new Date(coupon.expiryDate).toLocaleDateString()}</p>{token && <div><label>Amount<input type="number" min={coupon.minimumPurchase} value={amounts[coupon._id] || ''} onChange={(event) => setAmounts((current) => ({ ...current, [coupon._id]: event.target.value }))} /></label><button type="button" className="secondary-button" disabled={!amounts[coupon._id]} onClick={async () => { try { const result = await engagementApi.claimCoupon(token, coupon.code, Number(amounts[coupon._id])); setMessage(`Informational discount estimate: ₹${result.redemption.discountAmount}. It is not applied to a purchase.`) } catch (error) { setMessage(error.message) } }}>Claim estimate</button></div>}</article>)}</div> : <p className="empty-state">No active coupons right now.</p>}</section>
}

function CampusDeals() { return <><CampusDealsListing /><CampusCoupons /></> }

export default CampusDeals
