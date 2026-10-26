import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { aiApi, productApi } from '../services/api'

const conditions = ['New', 'Like New', 'Good', 'Fair']
const MAX_IMAGES = 5
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const formatInr = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
}).format(Number(value || 0))

const initialForm = {
    title: '',
    description: '',
    price: '',
    category: '',
    subcategory: '',
    condition: '',
    college: '',
    location: '',
    brand: '',
    specifications: '',
    quantity: '1',
    negotiable: false,
    salePreference: 'sale',
}

function SellProduct() {
    const { user, token, loading } = useAuth()
    const navigate = useNavigate()
    const { productId } = useParams()
    const [form, setForm] = useState(initialForm)
    const [categories, setCategories] = useState([])
    const [existingImages, setExistingImages] = useState([])
    const [showPreview, setShowPreview] = useState(false)
    const [loadingProduct, setLoadingProduct] = useState(Boolean(productId))
    const [selectedFiles, setSelectedFiles] = useState([])
    const [previewUrls, setPreviewUrls] = useState([])
    const [detailsForAI, setDetailsForAI] = useState('')
    const [itemAge, setItemAge] = useState('')
    const [originalPrice, setOriginalPrice] = useState('')
    const [priceEstimate, setPriceEstimate] = useState(null)
    const [priceEstimateError, setPriceEstimateError] = useState('')
    const [error, setError] = useState('')
    const [aiError, setAiError] = useState('')
    const [success, setSuccess] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [uploadingImages, setUploadingImages] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(null)
    const [generatingDescription, setGeneratingDescription] = useState(false)
    const [estimatingPrice, setEstimatingPrice] = useState(false)

    useEffect(() => {
        if (loading) return undefined
        let active = true
        productApi.categories().then((data) => {
            if (active) setCategories(data.categories || [])
        }).catch((requestError) => {
            if (active) setError(requestError.message)
        })
        if (productId) {
            productApi.byId(productId).then((data) => {
                const product = data.product
                const ownerId = product.seller?._id || product.seller
                if (String(ownerId) !== String(user?._id || user?.id)) throw new Error('Only the owner can edit this listing.')
                if (!active) return
                setForm({
                    ...initialForm,
                    ...Object.fromEntries(Object.keys(initialForm).map((key) => [key, product[key] ?? initialForm[key]])),
                    price: String(product.price),
                    quantity: String(product.quantity ?? 1),
                })
                setExistingImages(product.images || [])
            }).catch((requestError) => {
                if (active) setError(requestError.message)
            }).finally(() => {
                if (active) setLoadingProduct(false)
            })
        }
        return () => { active = false }
    }, [loading, productId, user?._id, user?.id])

    useEffect(() => {
        if (user?.college && !form.college) {
            setForm((current) => ({ ...current, college: user.college }))
        }
    }, [form.college, user?.college])

    useEffect(() => {
        return () => {
            previewUrls.forEach((url) => URL.revokeObjectURL(url))
        }
    }, [previewUrls])

    const imagePreviewBlocks = useMemo(() => previewUrls.map((url, index) => ({
        id: selectedFiles[index]?.name || `${url}-${index}`,
        url,
    })), [previewUrls, selectedFiles])

    if (loading) return <section className="placeholder">Loading your account...</section>
    if (!user || !token) return <Navigate to="/login" replace />

    const updateField = (event) => {
        const { name, value } = event.target
        setForm((current) => ({ ...current, [name]: value }))
        setAiError('')
        if (name === 'category') setForm((current) => ({ ...current, category: value, subcategory: '' }))
        if (['title', 'category', 'condition'].includes(name)) setPriceEstimate(null)
    }

    const generateDescription = async () => {
        const college = form.college.trim() || user.college || ''
        if (!form.title.trim() || !form.category || !form.condition || !detailsForAI.trim()) {
            setAiError('Enter a title, category, condition, and item details first.')
            return
        }

        setGeneratingDescription(true)
        setAiError('')
        try {
            const result = await aiApi.generateDescription(token, {
                title: form.title.trim(),
                category: form.category,
                condition: form.condition,
                college: college.trim() || 'Campus marketplace',
                details: detailsForAI.trim(),
            })
            setForm((current) => ({ ...current, description: result.description }))
        } catch (requestError) {
            setAiError(requestError.message)
        } finally {
            setGeneratingDescription(false)
        }
    }

    const estimatePrice = async () => {
        if (!form.title.trim() || !form.category || !form.condition || !itemAge.trim() || !originalPrice || !detailsForAI.trim()) {
            setPriceEstimateError('Enter the title, category, condition, age, original price, and item details first.')
            return
        }

        setEstimatingPrice(true)
        setPriceEstimateError('')
        setPriceEstimate(null)
        try {
            const estimate = await aiApi.estimatePrice(token, {
                title: form.title.trim(),
                category: form.category,
                condition: form.condition,
                age: itemAge.trim(),
                originalPrice,
                details: detailsForAI.trim(),
                brand: form.brand.trim(),
                model: form.specifications.trim(),
            })
            setPriceEstimate(estimate)
        } catch (requestError) {
            setPriceEstimateError(requestError.message)
        } finally {
            setEstimatingPrice(false)
        }
    }

    const useSuggestedPrice = () => {
        if (!priceEstimate) return
        setForm((current) => ({ ...current, price: String(priceEstimate.suggestedPrice) }))
        setPriceEstimate(null)
        setPriceEstimateError('')
    }

    const handleImageSelection = (event) => {
        const files = Array.from(event.target.files || [])

        if (files.length === 0) {
            setSelectedFiles([])
            setPreviewUrls([])
            return
        }

        if (files.length > MAX_IMAGES) {
            setError(`You can upload up to ${MAX_IMAGES} images.`)
            event.target.value = ''
            return
        }

        const invalidFile = files.find((file) => !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type))
        if (invalidFile) {
            setError('Only JPG, PNG, WEBP, and GIF images are allowed.')
            event.target.value = ''
            return
        }

        const oversizedFile = files.find((file) => file.size > MAX_IMAGE_SIZE)
        if (oversizedFile) {
            setError('Each image must be 5MB or smaller.')
            event.target.value = ''
            return
        }

        setError('')
        setSelectedFiles(files)
        setPreviewUrls(files.map((file) => URL.createObjectURL(file)))
    }

    const validateForm = () => {
        if (!form.title.trim()) return 'Please enter a product title.'
        if (!form.description.trim()) return 'Please enter a product description.'
        if (form.price === '' || Number(form.price) < 0) return 'Please enter a valid non-negative price.'
        if (!form.category) return 'Please choose a category.'
        if (!conditions.includes(form.condition)) return 'Please choose a valid product condition.'
        if (form.subcategory && !categories.find((item) => item.name === form.category)?.subcategories?.includes(form.subcategory)) return 'Choose a valid subcategory.'
        if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 0) return 'Enter a valid whole-number quantity.'
        if (existingImages.length + selectedFiles.length > MAX_IMAGES) return `You can have up to ${MAX_IMAGES} images on a listing.`
        return ''
    }

    const submit = async (event) => {
        event.preventDefault()
        setError('')
        setSuccess('')

        const validationError = validateForm()
        if (validationError) {
            setError(validationError)
            return
        }
        if (!showPreview) {
            setShowPreview(true)
            return
        }

        setSubmitting(true)
        setUploadingImages(selectedFiles.length > 0)
        if (selectedFiles.length > 0) setUploadProgress(0)

        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim(),
                price: Number(form.price),
                category: form.category,
                subcategory: form.subcategory,
                condition: form.condition,
                location: form.location.trim(),
                brand: form.brand.trim(),
                specifications: form.specifications.trim(),
                quantity: Number(form.quantity),
                negotiable: form.negotiable,
                salePreference: form.salePreference,
                contactMethod: 'chat',
                ...(productId ? { images: existingImages } : {}),
            }
            if (productId) await productApi.updateWithImages(token, productId, payload, selectedFiles, setUploadProgress)
            else await productApi.create(token, payload, selectedFiles, setUploadProgress)

            setSuccess(`${productId ? 'Listing updated' : 'Listing published'} successfully. Redirecting...`)
            navigate(productId ? `/products/${productId}` : '/marketplace', {
                replace: true,
                state: { successMessage: productId ? 'Your listing was updated.' : 'Your product was listed successfully.' },
            })
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setSubmitting(false)
            setUploadingImages(false)
            setUploadProgress(null)
        }
    }

    const selectedCategory = categories.find((item) => item.name === form.category)
    if (loadingProduct) return <section className="placeholder">Loading listing...</section>

    return (
        <section className="sell-page">
            <div className="form-panel">
                <p className="eyebrow">Pass it on</p>
                <h1>{productId ? 'Edit your listing' : 'Sell an item'}</h1>
                <p className="form-copy">List permitted goods for your campus community and connect through secure in-app chat.</p>

                {!showPreview ? <form className="form-stack" onSubmit={submit} noValidate>
                    <label>
                        Product title
                        <input type="text" name="title" maxLength="120" value={form.title} onChange={updateField} placeholder="e.g. Physics lab notebook" />
                    </label>

                    <label>
                        Category
                        <select name="category" value={form.category} onChange={updateField}>
                            <option value="">Choose a category</option>
                            {categories.map((category) => (
                                <option key={category._id || category.name} value={category.name}>{category.name}</option>
                            ))}
                        </select>
                    </label>
                    {selectedCategory?.subcategories?.length > 0 && <label>Subcategory
                        <select name="subcategory" value={form.subcategory} onChange={updateField}>
                            <option value="">Choose a subcategory</option>
                            {selectedCategory.subcategories.map((subcategory) => <option key={subcategory}>{subcategory}</option>)}
                        </select>
                    </label>}

                    <div className="form-grid">
                        <label>Brand (optional)<input name="brand" maxLength="80" value={form.brand} onChange={updateField} placeholder="Brand or maker" /></label>
                        <label>Quantity<input name="quantity" type="number" min="0" max="10000" step="1" value={form.quantity} onChange={updateField} /></label>
                    </div>
                    <label>Model or specifications (optional)<textarea name="specifications" maxLength="1200" value={form.specifications} onChange={updateField} placeholder="Model, size, included accessories, or relevant details." /></label>

                    <label>
                        Details for description
                        <textarea maxLength="2000" value={detailsForAI} onChange={(event) => { setDetailsForAI(event.target.value); setAiError('') }} placeholder="Describe the item's features and what's included." />
                    </label>

                    <div className="sell-description-field">
                        <div className="sell-description-heading">
                            <label htmlFor="product-description">Description</label>
                            <button className="secondary-button ai-generate-button" type="button" onClick={generateDescription} disabled={generatingDescription || submitting}>
                                {generatingDescription ? 'Generating...' : '✨ Generate with AI'}
                            </button>
                        </div>
                        <textarea id="product-description" name="description" value={form.description} onChange={updateField} placeholder="Write a clear description or generate one from your details." />
                        {aiError && <p className="form-error" role="alert">{aiError}</p>}
                    </div>

                    <label>
                        Price
                        <input type="number" name="price" min="0" step="0.01" value={form.price} onChange={updateField} placeholder="499" />
                    </label>
                    <label className="checkbox-label"><input type="checkbox" name="negotiable" checked={Boolean(form.negotiable)} onChange={(event) => setForm((current) => ({ ...current, negotiable: event.target.checked }))} /> Price is negotiable</label>
                    <label>Selling or exchange preference
                        <select name="salePreference" value={form.salePreference} onChange={updateField}>
                            <option value="sale">For sale</option>
                            <option value="exchange">Exchange only</option>
                            <option value="both">Sale or exchange</option>
                        </select>
                    </label>

                    <label>
                        Item age
                        <input type="text" maxLength="100" value={itemAge} onChange={(event) => { setItemAge(event.target.value); setPriceEstimate(null); setPriceEstimateError('') }} placeholder="e.g. 8 months" />
                    </label>

                    <label>
                        Original purchase price (₹)
                        <input type="number" min="1" step="0.01" value={originalPrice} onChange={(event) => { setOriginalPrice(event.target.value); setPriceEstimate(null); setPriceEstimateError('') }} placeholder="1200" />
                    </label>

                    <section className="price-estimator" aria-label="AI price estimator">
                        <button className="secondary-button ai-generate-button" type="button" onClick={estimatePrice} disabled={estimatingPrice || submitting || generatingDescription}>
                            {estimatingPrice ? 'Estimating...' : '💡 Estimate Price'}
                        </button>
                        {priceEstimateError && <p className="form-error" role="alert">{priceEstimateError}</p>}
                        {priceEstimate && (
                            <div className="price-estimate-result" aria-live="polite">
                                <p className="eyebrow">AI price estimate</p>
                                <strong className="price-estimate-range">{formatInr(priceEstimate.estimatedLow)} – {formatInr(priceEstimate.estimatedHigh)}</strong>
                                <p className="price-estimate-suggested">Suggested: <strong>{formatInr(priceEstimate.suggestedPrice)}</strong></p>
                                <p className="price-estimate-explanation">{priceEstimate.explanation}</p>
                                <div className="price-estimate-actions">
                                    <button className="primary-button" type="button" onClick={useSuggestedPrice}>Use {formatInr(priceEstimate.suggestedPrice)}</button>
                                    <button className="secondary-button" type="button" onClick={() => setPriceEstimate(null)}>Keep My Price</button>
                                </div>
                            </div>
                        )}
                    </section>

                    <label>
                        Condition
                        <select name="condition" value={form.condition} onChange={updateField}>
                            <option value="">Choose condition</option>
                            {conditions.map((condition) => (
                                <option key={condition} value={condition}>{condition}</option>
                            ))}
                        </select>
                    </label>

                    <label>Campus or pickup location (optional)
                        <input type="text" name="location" maxLength="160" value={form.location} onChange={updateField} placeholder="General location, not a personal address" />
                    </label>

                    <label>
                        Product images
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleImageSelection} />
                        <small className="form-note">Up to {MAX_IMAGES} images, 5MB each.</small>
                    </label>

                    {(existingImages.length > 0 || imagePreviewBlocks.length > 0) && (
                        <div className="image-preview-grid">
                            {existingImages.map((image, index) => <div className="image-preview-tile" key={image}>
                                <img src={image} alt={`Current listing photo ${index + 1}`} />
                                <button type="button" className="secondary-button" onClick={() => setExistingImages((current) => current.filter((item) => item !== image))} aria-label={`Remove current photo ${index + 1}`}>Remove</button>
                            </div>)}
                            {imagePreviewBlocks.map((item) => (
                                <div className="image-preview-tile" key={item.id}>
                                    <img src={item.url} alt="Product preview" />
                                </div>
                            ))}
                        </div>
                    )}

                    {error && <p className="form-error" role="alert">{error}</p>}
                    {success && <p className="form-success" role="status">{success}</p>}

                    {uploadingImages && <div className="student-upload-progress" role="status"><span>Uploading images: {uploadProgress ?? 0}%</span><progress max="100" value={uploadProgress ?? 0} aria-label="Product image upload progress" /></div>}

                    <button className="primary-button" type="submit" disabled={submitting || uploadingImages || generatingDescription || estimatingPrice}>
                        Preview listing
                    </button>
                </form> : <div className="listing-preview" aria-label="Listing preview">
                    {existingImages[0] && <img src={existingImages[0]} alt={form.title} />}
                    {imagePreviewBlocks[0] && <img src={imagePreviewBlocks[0].url} alt={form.title} />}
                    <p className="eyebrow">{form.category}{form.subcategory ? ` · ${form.subcategory}` : ''} · {form.condition}</p>
                    <h2>{form.title}</h2>
                    <p className="product-detail-price">{formatInr(form.price)} {form.negotiable && <span>· Negotiable</span>}</p>
                    <p>{form.description}</p>
                    {form.brand && <p><strong>Brand:</strong> {form.brand}</p>}
                    {form.specifications && <p><strong>Specifications:</strong> {form.specifications}</p>}
                    <p><strong>Quantity:</strong> {form.quantity} · <strong>Preference:</strong> {form.salePreference}</p>
                    {form.location && <p><strong>Pickup:</strong> {form.location}</p>}
                    <p>Buyers can contact you through secure CampusMart chat.</p>
                    {error && <p className="form-error" role="alert">{error}</p>}
                    <div className="price-estimate-actions">
                        <button className="secondary-button" type="button" onClick={() => setShowPreview(false)} disabled={submitting}>Back to edit</button>
                        <button className="primary-button" type="button" onClick={submit} disabled={submitting || uploadingImages}>
                            {submitting ? 'Saving...' : productId ? 'Save changes' : 'Publish listing'}
                        </button>
                    </div>
                </div>}
            </div>
        </section>
    )
}

export default SellProduct