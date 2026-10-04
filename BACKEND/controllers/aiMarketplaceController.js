const Product = require('../models/Product')
const aiMarketplaceSearchService = require('../services/aiMarketplaceSearchService')
const { buildProductQuery } = require('./aiSearchController')

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 20
const MAX_PAGE = 10_000
const sortOptions = {
    price_asc: { price: 1, createdAt: -1 },
    price_desc: { price: -1, createdAt: -1 },
    newest: { createdAt: -1 },
}

function validateRequest(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 'A JSON request body is required'
    if (Object.keys(body).some((field) => !['query', 'page', 'limit'].includes(field))) return 'Only query, page, and limit are accepted'
    if (typeof body.query !== 'string' || !body.query.trim()) return 'query is required'
    if (body.query.trim().length > 300) return 'query must be 300 characters or fewer'
    if (body.page !== undefined && (!Number.isInteger(body.page) || body.page < 1 || body.page > MAX_PAGE)) return `page must be an integer between 1 and ${MAX_PAGE}`
    if (body.limit !== undefined && (!Number.isInteger(body.limit) || body.limit < 1 || body.limit > MAX_LIMIT)) return `limit must be an integer between 1 and ${MAX_LIMIT}`
    return null
}

async function searchMarketplace(req, res) {
    const validation = validateRequest(req.body)
    if (validation) return res.status(400).json({ success: false, message: validation })
    try {
        const query = req.body.query.trim()
        const interpreted = await aiMarketplaceSearchService.parseMarketplaceQuery(query)
        const hasCollege = Boolean(req.user?.college)
        const filters = { ...interpreted, location: interpreted.location && hasCollege ? 'my_college' : null }
        const filter = buildProductQuery({
            searchText: filters.query,
            category: filters.category,
            condition: filters.condition,
            minPrice: filters.minPrice,
            maxPrice: filters.maxPrice,
        })
        if (filters.location === 'my_college') filter.$and.push({ college: req.user.college })
        const page = req.body.page || 1
        const limit = req.body.limit || DEFAULT_LIMIT
        const sort = sortOptions[filters.sort] || sortOptions.newest
        const [results, total] = await Promise.all([
            Product.find(filter).select('title description price category condition images college status createdAt').sort(sort).skip((page - 1) * limit).limit(limit).lean(),
            Product.countDocuments(filter),
        ])
        return res.json({
            success: true,
            query,
            filters,
            results,
            total,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        })
    } catch (error) {
        if (error instanceof aiMarketplaceSearchService.AIMarketplaceSearchError) {
            console.error('AI marketplace intent parsing failed', { statusCode: error.statusCode })
            return res.status(error.statusCode).json({ success: false, message: 'Campus AI is temporarily unavailable. Please try Marketplace search directly.' })
        }
        console.error('AI marketplace product search failed', { name: error.name || 'Error' })
        return res.status(500).json({ success: false, message: 'Marketplace search failed. Please try Marketplace directly.' })
    }
}

module.exports = { searchMarketplace, validateRequest, sortOptions, DEFAULT_LIMIT, MAX_LIMIT, MAX_PAGE }
