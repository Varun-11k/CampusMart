import { Link } from 'react-router-dom'

const formatInr = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
}).format(Number(value || 0))

function ProductCard({ listing, isSaved, isSaving = false, onToggleSave, recommendationReason }) {
    const id = listing._id
    const image = listing.images?.find((item) => item.trim())
    const sellerName = listing.seller?.name || 'Student seller'
    const status = listing.status === 'available' ? 'Available' : listing.status === 'sold' ? 'Sold' : 'Reserved'

    return (
        <article className="product-card">
            <Link className="product-image-wrap" to={`/products/${id}`}>
                {image ? <img src={image} alt={listing.title} className="product-image" loading="lazy" decoding="async" /> : <span className="product-image-placeholder">No photo</span>}
                <span className="condition-tag">{listing.condition}</span>{listing.offer && <span className="product-deal-tag">FLASH OFFER</span>}
                <span className={`product-status${listing.status === 'available' ? ' is-available' : ''}`}>{status}</span>
            </Link>
            <div className="product-card-body">
                <div className="product-card-topline">
                    <p className="product-category">{listing.category}</p>
                    {onToggleSave && <button className={`wishlist-button${isSaved ? ' is-saved' : ''}`} type="button" onClick={() => onToggleSave(id)} disabled={isSaving} aria-busy={isSaving} aria-label={`${isSaved ? 'Remove' : 'Add'} ${listing.title} ${isSaved ? 'from' : 'to'} wishlist`}>
                        {isSaved ? 'â™¥' : 'â™¡'}
                    </button>}
                </div>
                <Link className="product-title" to={`/products/${id}`}>{listing.title}</Link>
                <p className="product-price">{formatInr(listing.price)}</p>
                <p className="product-meta">{listing.college}</p>
                <p className="product-seller">Sold by <strong>{sellerName}</strong></p>
                {recommendationReason && <p className="recommendation-reason">{recommendationReason}</p>}
            </div>
        </article>
    )
}

export default ProductCard

