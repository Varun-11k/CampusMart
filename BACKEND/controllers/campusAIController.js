const Product = require('../models/Product')
const LostFoundReport = require('../models/LostFoundReport')
const Resource = require('../models/Resource')
const CampusExchange = require('../models/CampusExchange')
const campusAIService = require('../services/campusAIService')
const { buildProductQuery } = require('./aiSearchController')
const { reportQuery } = require('./lostFoundController')
const { buildFilter } = require('./resourceController')

const MAX_QUERY_LENGTH = 300
const RESULT_LIMIT = 8
const productCategories = ['Books', 'Electronics', 'Hostel', 'Fashion', 'Accessories', 'Sports', 'Other']
const resourceFields = 'title description type subject course semester year thumbnailUrl createdAt'

function validateRequest(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 'A JSON request body is required'
    if (Object.keys(body).some((field) => field !== 'query')) return 'Only query is accepted'
    if (typeof body.query !== 'string' || !body.query.trim()) return 'query is required'
    if (body.query.trim().length > MAX_QUERY_LENGTH) return `query must be ${MAX_QUERY_LENGTH} characters or fewer`
    return null
}

function resultQuery(intent, domain) {
    const query = intent.query
    if (domain === 'marketplace') {
        const category = productCategories.includes(intent.category) ? intent.category : null
        return buildProductQuery({ searchText: query || null, category, condition: null, minPrice: intent.minPrice, maxPrice: intent.maxPrice })
    }
    if (domain === 'lost_found') {
        const filterInput = { search: query, type: ['lost', 'found'].includes(intent.type) ? intent.type : undefined, category: intent.category || undefined, location: intent.location || undefined }
        return reportQuery({ query: filterInput })
    }
    if (domain === 'campus_exchange') {
        const filter = { status: 'active', $or: [{ moderationStatus: 'active' }, { moderationStatus: { $exists: false } }] }
        const terms = typeof query === 'string' ? query.normalize('NFKC').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().replace(/\s+/g, ' ').slice(0, 120) : ''
        if (terms) filter.$text = { $search: terms }
        if (intent.category && productCategories.includes(intent.category)) filter.category = new RegExp(`^${intent.category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        if (intent.condition) filter.condition = intent.condition
        if (intent.location) filter.location = new RegExp(intent.location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        return filter
    }
    const filterInput = {
        search: query,
        type: campusAIService.resourceTypes.includes(intent.type) ? intent.type : undefined,
        subject: intent.subject || undefined,
        course: intent.course || undefined,
        semester: intent.semester || undefined,
    }
    const filter = buildFilter(filterInput)
    // Resource's existing text index covers title, description, subject and course.
    return filter
}

async function findResults(intent) {
    const domains = intent.domain === 'all' ? ['marketplace', 'lost_found', 'resources', 'campus_exchange'] : [intent.domain]
    const results = {}
    const hasFilter = Boolean(intent.query || intent.category || intent.condition || intent.location || intent.subject || intent.course || intent.semester || intent.type || intent.minPrice !== null || intent.maxPrice !== null)
    if (!hasFilter) {
        if (domains.includes('marketplace')) results.marketplace = []
        if (domains.includes('lost_found')) results.lostFound = []
        if (domains.includes('resources')) results.resources = []
        if (domains.includes('campus_exchange')) results.campusExchange = []
        return results
    }
    for (const domain of domains) {
        const filter = resultQuery(intent, domain)
        if (domain === 'marketplace') {
            results.marketplace = await Product.find(filter).select('title description price category condition images college status createdAt').sort({ createdAt: -1 }).limit(RESULT_LIMIT).lean()
        } else if (domain === 'lost_found') {
            results.lostFound = await LostFoundReport.find(filter).select('type title category description location date images status createdAt').sort({ date: -1, createdAt: -1 }).limit(RESULT_LIMIT).lean()
        } else if (domain === 'resources') {
            results.resources = await Resource.find(filter).select(resourceFields).sort({ createdAt: -1 }).limit(RESULT_LIMIT).lean()
        } else {
            results.campusExchange = await CampusExchange.find(filter).select('title description category condition offeredItem wantedItem location images owner status createdAt').populate('owner', 'name college profileImage').sort(filter.$text ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 }).limit(RESULT_LIMIT).lean()
        }
    }
    return results
}

async function searchCampus(req, res) {
    const validation = validateRequest(req.body)
    if (validation) return res.status(400).json({ success: false, message: validation })
    try {
        const query = req.body.query.trim()
        const interpretation = await campusAIService.classifyQuery(query)
        const results = await findResults(interpretation)
        return res.json({ success: true, query, interpretation, results })
    } catch (error) {
        if (error instanceof campusAIService.CampusAIError) {
            console.error('Campus AI intent classification failed', { statusCode: error.statusCode })
            return res.status(error.statusCode).json({ success: false, message: 'Campus AI is temporarily unavailable. Please try regular search.' })
        }
        console.error('Campus AI database search failed', { name: error.name || 'Error' })
        return res.status(500).json({ success: false, message: 'Campus AI search failed. Please try regular search.' })
    }
}

module.exports = { searchCampus, validateRequest, resultQuery, findResults, MAX_QUERY_LENGTH, RESULT_LIMIT }
