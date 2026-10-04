import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { chatApi, productApi, reportApi, wishlistApi } from '../services/api'
import SellerOfferManager from '../components/SellerOfferManager'

const formatInr = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
}).format(Number(value || 0))

const formatDate = (value) => {
    if (!value) return 'Recently listed'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Recently listed'
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)
}

function ProductDetails() {
    const { productId } = useParams()
    const navigate = useNavigate()
    const { user, token } = useAuth()
    const [product, setProduct] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [saved, setSaved] = useState(false)
    const [saveError, setSaveError] = useState('')
    const [checkingSaved, setCheckingSaved] = useState(false)
    const [saving, setSaving] = useState(false)
    const [reportOpen, setReportOpen] = useState(false)
    const [reportReason, setReportReason] = useState('')
    const [reportDescription, setReportDescription] = useState('')
    const [reportError, setReportError] = useState('')
    const [submittingReport, setSubmittingReport] = useState(false)
    const [actionMessage, setActionMessage] = useState('')
    const [isMarkingSold, setIsMarkingSold] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        let active = true

        if (!productId) {
            setError('Product not found')
            setLoading(false)
            return () => { active = false }
        }

        setLoading(true)
        setError('')
        setActionMessage('')

        productApi.byId(productId)
            .then((data) => {
                if (active) setProduct(data.product)
            })
            .catch((requestError) => {
                if (!active) return
                if (requestError.status === 400 || requestError.status === 404 || requestError.message.toLowerCase().includes('not found')) {
                    setError('Product not found')
                    return
                }
                setError(requestError.message)
            })
            .finally(() => {
                if (active) setLoading(false)
            })

        return () => { active = false }
    }, [productId])

    useEffect(() => {
        if (!token || !productId) return undefined

        productApi.trackView(token, productId).catch(() => {})
        return undefined
    }, [productId, token])

    useEffect(() => {
        let active = true

        if (!token || !productId) {
            setSaved(false)
            setCheckingSaved(false)
            return () => { active = false }
        }

        setCheckingSaved(true)
        setSaveError('')
        wishlistApi.check(token, productId)
            .then((data) => {
                if (active) setSaved(Boolean(data.saved))
            })
            .catch((requestError) => {
                if (active) setSaveError(requestError.message)
            })
            .finally(() => {
                if (active) setCheckingSaved(false)
            })

        return () => { active = false }
    }, [productId, token])

    const productSellerId = product?.seller?._id || product?.seller?.id || product?.seller
    const currentUserId = user?._id || user?.id
    const isSeller = Boolean(productSellerId && currentUserId && String(productSellerId) === String(currentUserId))

    const handleContact = () => {
        if (!user) {
            navigate('/login', { state: { from: `/products/${productId}` } })
            return
        }

        if (isSeller) {
            setActionMessage('This is your listing. Use the messages inbox to manage your conversations.')
            return
        }

        if (!product || !product._id) {
            setActionMessage('This product is unavailable right now.')
            return
        }

        setActionMessage('Opening a secure conversation with the seller...')
        chatApi.startConversation(token, product._id).then((data) => {
            if (data?.conversation?._id) {
                navigate(`/messages/${data.conversation._id}`)
                return
            }
            setActionMessage('Unable to open a chat right now.')
        }).catch((requestError) => {
            setActionMessage(requestError.message)
        })
    }

    const handleSave = async () => {
        if (!user || !token) {
            navigate('/login', { state: { from: `/products/${productId}` } })
            return
        }

        if (!product || saving || checkingSaved) return

        setSaving(true)
        setSaveError('')
        setActionMessage('')
        try {
            if (saved) {
                await wishlistApi.remove(token, product._id)
                setSaved(false)
                setActionMessage('Removed from saved products.')
            } else {
                await wishlistApi.add(token, product._id)
                setSaved(true)
                setActionMessage('Added to saved products.')
            }
        } catch (requestError) {
            setSaveError(requestError.message)
        } finally {
            setSaving(false)
        }
    }

    const handleReport = () => {
        if (!user || !token) {
            navigate('/login', { state: { from: `/products/${productId}` } })
            return
        }
        setReportError('')
        setReportOpen(true)
    }

    const submitReport = async (event) => {
        event.preventDefault()
        if (!product || !reportReason || submittingReport) return

        setSubmittingReport(true)
        setReportError('')
        try {
            await reportApi.create(token, {
                productId: product._id,
                reason: reportReason,
                description: reportDescription,
            })
            setReportOpen(false)
            setReportReason('')
            setReportDescription('')
            setActionMessage('Report submitted successfully.')
        } catch (requestError) {
            setReportError(requestError.message)
        } finally {
            setSubmittingReport(false)
        }
    }

    const handleMarkSold = async () => {
        if (!product || !token) return

        try {
            setIsMarkingSold(true)
            const data = await productApi.update(token, product._id, { status: 'sold' })
            setProduct((current) => ({ ...current, ...data.product }))
            setActionMessage('Listing marked as sold.')
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setIsMarkingSold(false)
        }
    }

    const handleDelete = async () => {
        if (!product || !token) return

        const confirmed = window.confirm('Delete this listing? This action cannot be undone.')
        if (!confirmed) return

        try {
            setIsDeleting(true)
            await productApi.remove(token, product._id)
            setActionMessage('Listing deleted successfully.')
            navigate('/marketplace')
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setIsDeleting(false)
        }
    }

    if (loading) return <section className="placeholder"><strong>Loading product...</strong></section>
    if (error) {
        return (
            <section className="placeholder" role="alert">
                <strong>Product not found</strong>
                <span>{error}</span>
                <p><Link className="secondary-button" to="/marketplace">Back to marketplace</Link></p>
            </section>
        )
    }
    if (!product) return null

    const images = Array.isArray(product.images) ? product.images.filter((item) => item && item.trim()) : []
    const primaryImage = images[0]

    return (
        <section className="product-detail-page">
            <div className="product-detail-header">
                <Link className="secondary-button" to="/marketplace">← Back to marketplace</Link>
            </div>

            <article className="product-detail-card">
                <div className="product-detail-visual">
                    {primaryImage ? <img src={primaryImage} alt={product.title} /> : <span className="product-image-placeholder">No photo provided</span>}
                </div>

                <div className="product-detail-content">
                    <p className="eyebrow">{product.category} · {product.condition}</p>
                    <h1>{product.title}</h1>
                    <p className="product-detail-price">{formatInr(product.price)}</p>

                    <div className="product-detail-actions">
                        <button className="primary-button" type="button" onClick={handleContact}>Contact Seller</button>
                        <button className={`secondary-button${saved ? ' is-saved' : ''}`} type="button" onClick={handleSave} disabled={saving || checkingSaved} aria-pressed={saved}>
                            {checkingSaved ? 'Checking...' : saving ? 'Saving...' : saved ? '♥ Saved' : '♡ Save'}
                        </button>
                        <button className="secondary-button" type="button" onClick={handleReport}>Report Listing</button>
                    </div>

                    {actionMessage && <p className="form-success" role="status">{actionMessage}</p>}
                    {saveError && <p className="form-error" role="alert">{saveError}</p>}

                    <div className="product-meta-grid">
                        <div>
                            <span className="meta-label">Condition</span>
                            <strong>{product.condition}</strong>
                        </div>
                        <div>
                            <span className="meta-label">College</span>
                            <strong>{product.college}</strong>
                        </div>
                        <div>
                            <span className="meta-label">Status</span>
                            <strong>{product.status || 'available'}</strong>
                        </div>
                        <div>
                            <span className="meta-label">Listed</span>
                            <strong>{formatDate(product.createdAt)}</strong>
                        </div>
                    </div>

                    <div className="product-detail-section">
                        <h2>About this item</h2>
                        <p>{product.description}</p>
                    </div>

                    <div className="seller-card">
                        <p className="eyebrow">Seller</p>
                        <div className="seller-line">
                            <strong>{product.seller?.name || 'Student seller'}</strong>
                            <span>{product.seller?.college || product.college}</span>
                        </div>
                    </div>

                    {isSeller && (
                        <div className="seller-actions">
                            <button className="secondary-button" type="button" onClick={() => navigate('/sell')}>Edit Listing</button>
                            <button className="secondary-button" type="button" onClick={handleMarkSold} disabled={isMarkingSold}>
                                {isMarkingSold ? 'Updating...' : 'Mark as Sold'}
                            </button>
                            <button className="secondary-button danger-button" type="button" onClick={handleDelete} disabled={isDeleting}>
                                {isDeleting ? 'Deleting...' : 'Delete Listing'}
                            </button>
                        </div>
                    )}
                    {isSeller && token && product.status === 'available' && <SellerOfferManager product={product} token={token} />}
                </div>
            </article>

            {images.length > 1 && (
                <div className="product-gallery">
                    {images.map((image, index) => (
                        <img key={`${image}-${index}`} src={image} alt={`${product.title} ${index + 1}`} />
                    ))}
                </div>
            )}

            {reportOpen && (
                <div className="modal-backdrop" onMouseDown={() => !submittingReport && setReportOpen(false)}>
                    <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title" onMouseDown={(event) => event.stopPropagation()}>
                        <p className="eyebrow">Community safety</p>
                        <h2 id="report-title">Report listing</h2>
                        <p className="form-copy">Reports are reviewed by CampusMart admins.</p>
                        <form className="form-stack" onSubmit={submitReport}>
                            <label>
                                Reason
                                <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} required>
                                    <option value="">Choose a reason</option>
                                    <option value="scam">Scam</option>
                                    <option value="incorrect_information">Incorrect information</option>
                                    <option value="spam">Spam</option>
                                    <option value="prohibited_item">Prohibited item</option>
                                    <option value="harassment">Harassment</option>
                                    <option value="other">Other</option>
                                </select>
                            </label>
                            <label>
                                Description (optional)
                                <textarea maxLength={1000} value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} placeholder="Add helpful context for the review team." />
                            </label>
                            {reportError && <p className="form-error" role="alert">{reportError}</p>}
                            <div className="report-modal-actions">
                                <button className="secondary-button" type="button" onClick={() => setReportOpen(false)} disabled={submittingReport}>Cancel</button>
                                <button className="primary-button" type="submit" disabled={submittingReport || !reportReason}>
                                    {submittingReport ? 'Submitting...' : 'Submit Report'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </section>
    )
}

export default ProductDetails
