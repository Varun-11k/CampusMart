const Product = require('../models/Product')
const { parseSearchIntent, normalizeSearchFilters, AIServiceError } = require('../services/aiService')

const MAX_QUERY_LENGTH = 300
const MAX_SEARCH_RESULTS = 50
const categories = ['Books', 'Electronics', 'Hostel', 'Fashion', 'Accessories', 'Sports', 'Other']
const conditions = ['New', 'Like New', 'Good', 'Fair']
const filterFields = ['searchText', 'category', 'condition', 'minPrice', 'maxPrice']
const sellerFields = 'name college profileImage'

function validateRequest(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'A JSON request body is required'
    }

    if (Object.keys(body).some((field) => !['query', 'filters'].includes(field))) {
        return 'Only query and filters are accepted'
    }

    if (typeof body.query !== 'string' || !body.query.trim()) {
        return 'query is required'
    }
    if (body.query.trim().length > MAX_QUERY_LENGTH) {
        return `query must be ${MAX_QUERY_LENGTH} characters or fewer`
    }

    if (Object.hasOwn(body, 'filters')) {
        const validationError = validateClientFilters(body.filters)
        if (validationError) return validationError
    }

    return null
}

function validateClientFilters(filters) {
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
        return 'filters must be an object'
    }
    if (Object.keys(filters).length !== filterFields.length || filterFields.some((field) => !Object.hasOwn(filters, field))) {
        return 'filters must contain only searchText, category, condition, minPrice, and maxPrice'
    }

    try {
        normalizeSearchFilters(filters)
        return null
    } catch {
        return 'One or more search filters are invalid'
    }
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildProductQuery(filters) {
    const clauses = [{
        $or: [
            { moderationStatus: 'active' },
            { moderationStatus: { $exists: false } },
        ],
    }]

    const searchText = filters.searchText
        ?.replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, 100)

    if (searchText) {
        const safePattern = escapeRegex(searchText)
        clauses.push({
            $or: [
                { title: { $regex: safePattern, $options: 'i' } },
                { description: { $regex: safePattern, $options: 'i' } },
            ],
        })
    }

    if (filters.category !== null) {
        clauses.push({ category: { $in: categories.filter((category) => category === filters.category) } })
    }
    if (filters.condition !== null) {
        clauses.push({ condition: { $in: conditions.filter((condition) => condition === filters.condition) } })
    }

    const priceFilter = {}
    if (filters.minPrice !== null) priceFilter.$gte = filters.minPrice
    if (filters.maxPrice !== null) priceFilter.$lte = filters.maxPrice
    if (Object.keys(priceFilter).length > 0) clauses.push({ price: priceFilter })

    return { status: 'available', $and: clauses }
}

async function searchProducts(req, res) {
    const validationError = validateRequest(req.body)
    if (validationError) {
        return res.status(400).json({ success: false, message: validationError })
    }

    let filters
    try {
        filters = Object.hasOwn(req.body, 'filters')
            ? normalizeSearchFilters(req.body.filters)
            : await parseSearchIntent(req.body.query.trim())
    } catch (error) {
        const message = error instanceof AIServiceError
            ? 'AI search is temporarily unavailable. Try the regular search.'
            : 'AI search is temporarily unavailable. Try the regular search.'
        return res.status(error.statusCode || 503).json({ success: false, message })
    }

    try {
        const products = await Product.find(buildProductQuery(filters))
            .populate('seller', sellerFields)
            .sort({ createdAt: -1 })
            .limit(MAX_SEARCH_RESULTS)

        return res.json({ success: true, filters, products })
    } catch (error) {
        console.error('AI smart search product query failed:', error.message)
        return res.status(500).json({
            success: false,
            message: 'Product search is temporarily unavailable. Try the regular search.',
        })
    }
}

module.exports = { searchProducts, validateRequest, validateClientFilters, buildProductQuery }
