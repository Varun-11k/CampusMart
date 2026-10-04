const aiResourceSearchService = require('../services/aiResourceSearchService')
const resourceSearchService = require('../services/resourceSearchService')

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 20
const MAX_PAGE = 10_000

function validateRequest(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 'A JSON request body is required'
    if (Object.keys(body).some((field) => !['query', 'page', 'limit'].includes(field))) return 'Only query, page, and limit are accepted'
    if (typeof body.query !== 'string' || !body.query.trim()) return 'query is required'
    if (body.query.trim().length > 300) return 'query must be 300 characters or fewer'
    if (body.page !== undefined && (!Number.isInteger(body.page) || body.page < 1 || body.page > MAX_PAGE)) return `page must be an integer between 1 and ${MAX_PAGE}`
    if (body.limit !== undefined && (!Number.isInteger(body.limit) || body.limit < 1 || body.limit > MAX_LIMIT)) return `limit must be an integer between 1 and ${MAX_LIMIT}`
    return null
}

async function searchResources(req, res) {
    const validation = validateRequest(req.body)
    if (validation) return res.status(400).json({ success: false, message: validation })
    try {
        const query = req.body.query.trim()
        const filters = await aiResourceSearchService.parseResourceQuery(query)
        const filter = resourceSearchService.buildResourceFilter(filters)
        if (!filter) return res.status(503).json({ success: false, message: 'Campus AI is temporarily unavailable. Please search Resources directly.' })
        const page = req.body.page || 1
        const limit = req.body.limit || DEFAULT_LIMIT
        const { resources, total } = await resourceSearchService.searchResources({ filter, page, limit })
        return res.json({ success: true, query, filters, results: resources, total, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
    } catch (error) {
        if (error instanceof aiResourceSearchService.AIResourceSearchError) {
            console.error('AI resource intent parsing failed', { statusCode: error.statusCode })
            return res.status(error.statusCode).json({ success: false, message: 'Campus AI is temporarily unavailable. Please search Resources directly.' })
        }
        console.error('AI resource search failed', { name: error.name || 'Error' })
        return res.status(500).json({ success: false, message: 'Resource search failed. Please search Resources directly.' })
    }
}

module.exports = { searchResources, validateRequest, DEFAULT_LIMIT, MAX_LIMIT, MAX_PAGE }
