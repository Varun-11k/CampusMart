const aiLostFoundSearchService = require('../services/aiLostFoundSearchService')
const lostFoundSearchService = require('../services/lostFoundSearchService')

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

async function searchLostFound(req, res) {
    const validation = validateRequest(req.body)
    if (validation) return res.status(400).json({ success: false, message: validation })
    try {
        const query = req.body.query.trim()
        const filters = await aiLostFoundSearchService.parseLostFoundQuery(query)
        const filter = lostFoundSearchService.buildLostFoundFilter(filters)
        if (!filter) return res.status(503).json({ success: false, message: 'Campus AI is temporarily unavailable. Please search Lost & Found directly.' })
        const page = req.body.page || 1
        const limit = req.body.limit || DEFAULT_LIMIT
        const { reports, total } = await lostFoundSearchService.searchLostFoundReports({ filter, page, limit, publicOnly: true })
        return res.json({
            success: true,
            query,
            filters,
            results: reports,
            total,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        })
    } catch (error) {
        if (error instanceof aiLostFoundSearchService.AILostFoundSearchError) {
            console.error('AI Lost & Found intent parsing failed', { statusCode: error.statusCode })
            return res.status(error.statusCode).json({ success: false, message: 'Campus AI is temporarily unavailable. Please search Lost & Found directly.' })
        }
        console.error('AI Lost & Found report search failed', { name: error.name || 'Error' })
        return res.status(500).json({ success: false, message: 'Lost & Found search failed. Please search Lost & Found directly.' })
    }
}

module.exports = { searchLostFound, validateRequest, DEFAULT_LIMIT, MAX_LIMIT, MAX_PAGE }
