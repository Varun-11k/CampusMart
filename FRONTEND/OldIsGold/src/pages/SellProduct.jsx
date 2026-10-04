import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { aiApi, productApi } from '../services/api'

const categories = ['Books', 'Electronics', 'Hostel', 'Fashion', 'Accessories', 'Sports', 'Other']
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
    condition: '',
    college: '',
}

function SellProduct() {
    const { user, token, loading } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState(initialForm)
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
    const [generatingDescription, setGeneratingDescription] = useState(false)
    const [estimatingPrice, setEstimatingPrice] = useState(false)

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
        if (['title', 'category', 'condition'].includes(name)) setPriceEstimate(null)
    }

    const generateDescription = async () => {
        const college = form.college.trim() || user.college || ''
        if (!form.title.trim() || !form.category || !form.condition || !college.trim() || !detailsForAI.trim()) {
            setAiError('Enter a title, category, condition, college, and item details first.')
            return
        }

        setGeneratingDescription(true)
        setAiError('')
        try {
            const result = await aiApi.generateDescription(token, {
                title: form.title.trim(),
                category: form.category,
                condition: form.condition,
                college: college.trim(),
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

        const invalidFile = files.find((file) => !file.type.startsWith('image/'))
        if (invalidFile) {
            setError('Only image files are allowed.')
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
        if (!form.price || Number(form.price) <= 0) return 'Please enter a valid price greater than 0.'
        if (!form.category) return 'Please choose a category.'
        if (!conditions.includes(form.condition)) return 'Please choose a valid product condition.'
        if (!form.college.trim()) return 'Please enter your college name.'
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

        setSubmitting(true)
        setUploadingImages(selectedFiles.length > 0)

        try {
            await productApi.create(token, {
                title: form.title.trim(),
                description: form.description.trim(),
                price: Number(form.price),
                category: form.category,
                condition: form.condition,
                college: form.college.trim() || user.college,
            }, selectedFiles)

            setSuccess('Listing published successfully. Redirecting to marketplace...')
            navigate('/marketplace', {
                replace: true,
                state: { successMessage: 'Your product was listed successfully.' },
            })
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setSubmitting(false)
            setUploadingImages(false)
        }
    }

    return (
        <section className="sell-page">
            <div className="form-panel">
                <p className="eyebrow">Pass it on</p>
                <h1>Sell a product</h1>
                <p className="form-copy">List an item for your campus community and make it available to buyers near you.</p>

                <form className="form-stack" onSubmit={submit} noValidate>
                    <label>
                        Product title
                        <input type="text" name="title" maxLength="120" value={form.title} onChange={updateField} placeholder="e.g. Physics lab notebook" />
                    </label>

                    <label>
                        Category
                        <select name="category" value={form.category} onChange={updateField}>
                            <option value="">Choose a category</option>
                            {categories.map((category) => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                    </label>

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
                        <input type="number" name="price" min="1" step="0.01" value={form.price} onChange={updateField} placeholder="499" />
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

                    <label>
                        College
                        <input type="text" name="college" value={form.college} onChange={updateField} placeholder="Your college or university" />
                    </label>

                    <label>
                        Product images
                        <input type="file" accept="image/*" multiple onChange={handleImageSelection} />
                        <small className="form-note">Up to {MAX_IMAGES} images, 5MB each.</small>
                    </label>

                    {imagePreviewBlocks.length > 0 && (
                        <div className="image-preview-grid">
                            {imagePreviewBlocks.map((item) => (
                                <div className="image-preview-tile" key={item.id}>
                                    <img src={item.url} alt="Product preview" />
                                </div>
                            ))}
                        </div>
                    )}

                    {error && <p className="form-error" role="alert">{error}</p>}
                    {success && <p className="form-success" role="status">{success}</p>}

                    {uploadingImages && <p className="form-success" role="status">Uploading images...</p>}

                    <button className="primary-button" type="submit" disabled={submitting || uploadingImages || generatingDescription || estimatingPrice}>
                        {submitting ? 'Publishing...' : 'Publish listing'}
                    </button>
                </form>
            </div>
        </section>
    )
}

export default SellProduct