const test = require('node:test')
const assert = require('node:assert/strict')
const aiService = require('../services/aiResourceSearchService')
const searchService = require('../services/resourceSearchService')
const resourceController = require('../controllers/resourceController')
const aiController = require('../controllers/aiResourceController')
const Resource = require('../models/Resource')

function interpreted(overrides = {}) {
    return { query: 'DBMS', type: 'notes', subject: 'DBMS', course: null, semester: '4', year: null, ...overrides }
}
function responseMock() { return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } } }

test('resource intent validation accepts only the schema fields and supported type values', () => {
    assert.deepEqual(aiService.normalizeFilters(interpreted()), interpreted())
    assert.deepEqual(aiService.normalizeFilters(interpreted({ type: 'previous_paper', year: 2025 }), new Date('2026-10-01T00:00:00Z')), { ...interpreted(), type: 'previous_paper', year: 2025 })
    assert.throws(() => aiService.normalizeFilters({ ...interpreted(), mongo: { $where: 'true' } }), aiService.AIResourceSearchError)
    assert.throws(() => aiService.normalizeFilters(interpreted({ type: 'unknown' })), aiService.AIResourceSearchError)
    assert.throws(() => aiService.normalizeFilters(interpreted({ year: '2025' })), aiService.AIResourceSearchError)
    assert.throws(() => aiService.normalizeFilters(interpreted({ year: 2027 }), new Date('2026-10-01T00:00:00Z')), aiService.AIResourceSearchError)
    assert.throws(() => aiService.normalizeFilters(interpreted({ semester: 'x'.repeat(51) })), aiService.AIResourceSearchError)
    assert.throws(() => aiService.normalizeFilters(interpreted({ query: 'x'.repeat(101) })), aiService.AIResourceSearchError)
})

test('shared resource filter restricts active records, validates year, and safely handles text/filters', () => {
    const filter = searchService.buildResourceFilter({ query: 'DBMS.*', type: 'notes', subject: 'DBMS', course: 'CSE', semester: '4', year: '2025' })
    assert.equal(filter.status, 'active')
    assert.equal(filter.type, 'notes')
    assert.equal(filter.subject.toString(), '/^DBMS$/i')
    assert.equal(filter.course.toString(), '/^CSE$/i')
    assert.equal(filter.semester.toString(), '/^4$/i')
    assert.deepEqual(filter.year, 2025)
    assert.deepEqual(filter.$text, { $search: 'DBMS.*' })
    assert.equal(searchService.buildResourceFilter({ year: 'invalid' }), null)
})

test('AI resource request rejects client filters and unsafe pagination', () => {
    assert.equal(aiController.validateRequest({ query: 'Find DBMS notes', page: 1, limit: 20 }), null)
    assert.match(aiController.validateRequest({ query: 'DBMS', filter: { $where: 'true' } }), /Only query/)
    assert.match(aiController.validateRequest({ query: 'DBMS', limit: 1000 }), /limit must/)
    assert.match(aiController.validateRequest({ query: 'x'.repeat(301) }), /300 characters/)
})

test('AI resource results reuse paginated active Resource search and expose only public fields', async () => {
    const originalParser = aiService.parseResourceQuery
    const originalSearch = searchService.searchResources
    let capturedFilter
    let capturedPage
    let capturedLimit
    aiService.parseResourceQuery = async () => interpreted()
    searchService.searchResources = async ({ filter, page, limit }) => {
        capturedFilter = filter; capturedPage = page; capturedLimit = limit
        return { resources: [{ _id: 'real-resource', title: 'DBMS Notes', type: 'notes', status: 'active' }], total: 1 }
    }
    try {
        const res = responseMock()
        await aiController.searchResources({ body: { query: 'Find DBMS notes for semester 4' } }, res)
        assert.equal(res.statusCode, 200)
        assert.equal(res.body.results[0]._id, 'real-resource')
        assert.equal(res.body.total, 1)
        assert.equal(capturedFilter.status, 'active')
        assert.equal(capturedFilter.subject.toString(), '/^DBMS$/i')
        assert.equal(capturedPage, 1)
        assert.equal(capturedLimit, 20)
        assert.deepEqual(res.body.pagination, { page: 1, limit: 20, total: 1, totalPages: 1 })
    } finally { aiService.parseResourceQuery = originalParser; searchService.searchResources = originalSearch }
})

test('AI resource search uses a limited projection without uploader identity or hidden records', async () => {
    const originalFind = Resource.find
    const originalCount = Resource.countDocuments
    let projection
    let filter
    Resource.find = (query) => {
        filter = query
        return { select(fields) { projection = fields; return this }, sort() { return this }, skip() { return this }, limit() { return this }, async lean() { return [] } }
    }
    Resource.countDocuments = async () => 0
    try {
        await searchService.searchResources({ filter: searchService.buildResourceFilter({ type: 'syllabus' }), page: 1, limit: 20 })
        assert.equal(filter.status, 'active')
        assert.match(projection, /title/)
        assert.doesNotMatch(projection, /uploadedBy|email|phone|password|__v/)
    } finally { Resource.find = originalFind; Resource.countDocuments = originalCount }
})

test('normal Resource listing delegates to the shared search and preserves public response pagination', async () => {
    const originalSearch = searchService.searchResources
    searchService.searchResources = async ({ filter, page, limit }) => {
        assert.equal(filter.status, 'active')
        assert.equal(filter.type, 'notes')
        assert.equal(page, 2)
        assert.equal(limit, 3)
        return { resources: [{ _id: 'actual', title: 'Notes' }], total: 4 }
    }
    try {
        const res = responseMock()
        await resourceController.listResources({ query: { type: 'notes', page: '2', limit: '3' } }, res, (error) => { throw error })
        assert.equal(res.body.resources[0]._id, 'actual')
        assert.equal(res.body.pagination.pages, 2)
    } finally { searchService.searchResources = originalSearch }
})

test('provider failure returns the Resources fallback and performs no resource writes', async () => {
    const originalParser = aiService.parseResourceQuery
    const originalError = console.error
    aiService.parseResourceQuery = async () => { throw new aiService.AIResourceSearchError() }
    console.error = () => {}
    try {
        const res = responseMock()
        await aiController.searchResources({ body: { query: 'DBMS resources' } }, res)
        assert.equal(res.statusCode, 503)
        assert.equal(res.body.success, false)
        assert.match(res.body.message, /search Resources directly/)
    } finally { aiService.parseResourceQuery = originalParser; console.error = originalError }
})
