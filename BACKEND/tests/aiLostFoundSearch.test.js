const test = require('node:test')
const assert = require('node:assert/strict')
const aiService = require('../services/aiLostFoundSearchService')
const searchService = require('../services/lostFoundSearchService')
const controller = require('../controllers/aiLostFoundController')
const LostFoundReport = require('../models/LostFoundReport')

function structured(overrides = {}) {
    return { type: 'lost', query: 'black wallet', category: 'Wallets & Cards', location: 'library', date: null, status: 'active', ...overrides }
}
function responseMock() { return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } } }

test('Lost & Found AI filters accept only known fields, types, categories, and public status', () => {
    const filters = aiService.normalizeFilters(structured(), 'I lost a black wallet near the library')
    assert.deepEqual(filters, { type: 'lost', query: 'black wallet', category: 'Wallets & Cards', location: 'library', date: null, status: 'active' })
    assert.equal(aiService.normalizeFilters(structured({ type: 'found', category: 'unknown category' }), 'Has anyone found a black wallet?').category, null)
    assert.throws(() => aiService.normalizeFilters({ ...structured(), mongoQuery: { $where: 'evil' } }, 'wallet'), aiService.AILostFoundSearchError)
    assert.throws(() => aiService.normalizeFilters(structured({ type: 'returned' }), 'wallet'), aiService.AILostFoundSearchError)
    assert.throws(() => aiService.normalizeFilters(structured({ status: 'removed' }), 'wallet'), aiService.AILostFoundSearchError)
    assert.throws(() => aiService.normalizeFilters(structured({ date: '2026-02-30' }), 'wallet'), aiService.AILostFoundSearchError)
})

test('relative and explicit dates use validated server UTC date and existing single-day support', () => {
    const now = new Date('2026-10-01T13:25:00.000Z')
    assert.equal(aiService.dateFromQuery('I lost it yesterday', now), '2026-09-30')
    assert.equal(aiService.dateFromQuery('found today', now), '2026-10-01')
    assert.equal(aiService.dateFromQuery('I lost my ID card on September 20', now), '2026-09-20')
    assert.equal(aiService.dateFromQuery('found on Monday', now), '2026-09-28')
    assert.equal(aiService.dateFromQuery('I lost it last week', now), null)
    assert.equal(aiService.dateFromQuery('found on 2026-02-30', now), null)
})

test('example query interpretations normalize to safe Lost & Found parameters', () => {
    const now = new Date('2026-10-01T12:00:00.000Z')
    const cases = [
        ['I lost a black wallet near the library', { type: 'lost', query: 'black wallet', category: 'Wallets & Cards', location: 'library', date: null, status: 'active' }],
        ['Has anyone found a black wallet?', { type: 'found', query: 'black wallet', category: 'Wallets & Cards', location: null, date: null, status: 'active' }],
        ['Find lost blue water bottles', { type: 'lost', query: 'blue water bottle', category: 'Other', location: null, date: null, status: 'active' }],
        ['Show found phones near the cafeteria', { type: 'found', query: 'phone', category: 'Electronics', location: 'cafeteria', date: null, status: 'active' }],
        ['I lost my calculator yesterday', { type: 'lost', query: 'calculator', category: null, location: null, date: '2026-09-30', status: 'active' }],
        ['Find ID cards', { type: null, query: 'ID card', category: 'Wallets & Cards', location: null, date: null, status: 'active' }],
        ['Show me everything', { type: null, query: null, category: null, location: null, date: null, status: 'active' }],
    ]
    for (const [query, expected] of cases) assert.deepEqual(aiService.normalizeFilters(expected, query, now), expected)
})

test('shared Lost & Found search always restricts results to active reports and escapes text', () => {
    const filter = searchService.buildLostFoundFilter({ type: 'found', query: 'wallet.*', category: 'Wallets & Cards', location: 'Library', date: '2026-09-30' })
    assert.equal(filter.status, 'active')
    assert.equal(filter.type, 'found')
    assert.equal(filter.$or[0].title.toString(), '/wallet\\.\\*/i')
    assert.equal(filter.category.toString(), '/Wallets & Cards/i')
    assert.deepEqual(filter.date, { $gte: new Date('2026-09-30T00:00:00.000Z'), $lt: new Date('2026-10-01T00:00:00.000Z') })
    assert.equal(searchService.buildLostFoundFilter({ date: '2026-02-30' }), null)
})

test('AI search projection excludes reporter identity and all claim data', async () => {
    const originalFind = LostFoundReport.find
    const originalCount = LostFoundReport.countDocuments
    let projection
    let populated = false
    LostFoundReport.find = () => ({
        select(fields) { projection = fields; return this },
        populate() { populated = true; return this },
        sort() { return this }, skip() { return this }, limit() { return this },
        async lean() { return [{ _id: 'public-report', title: 'Wallet' }] },
    })
    LostFoundReport.countDocuments = async () => 1
    try {
        await searchService.searchLostFoundReports({ filter: { status: 'active' }, publicOnly: true })
        assert.doesNotMatch(projection, /reportedBy|email|phone|claim|admin/)
        assert.equal(populated, false)
    } finally { LostFoundReport.find = originalFind; LostFoundReport.countDocuments = originalCount }
})

test('Lost & Found AI endpoint validates pagination and rejects client database fields', () => {
    assert.equal(controller.validateRequest({ query: 'I lost my wallet', page: 1, limit: 20 }), null)
    assert.match(controller.validateRequest({ query: 'wallet', filters: { $where: 'true' } }), /Only query/)
    assert.match(controller.validateRequest({ query: 'wallet', limit: 1000 }), /limit must/)
    assert.match(controller.validateRequest({ query: 'x'.repeat(301) }), /300 characters/)
})

test('Lost & Found controller returns only shared-search results and pagination', async () => {
    const originalParser = aiService.parseLostFoundQuery
    const originalSearch = searchService.searchLostFoundReports
    aiService.parseLostFoundQuery = async () => aiService.normalizeFilters(structured(), 'I lost a black wallet near the library')
    searchService.searchLostFoundReports = async ({ filter, page, limit }) => {
        assert.equal(filter.status, 'active')
        assert.equal(filter.type, 'lost')
        assert.equal(page, 1)
        assert.equal(limit, 20)
        return { reports: [{ _id: 'real-report-id', title: 'Black wallet', type: 'lost', status: 'active' }], total: 1 }
    }
    try {
        const res = responseMock()
        await controller.searchLostFound({ body: { query: 'I lost a black wallet near the library' } }, res)
        assert.equal(res.statusCode, 200)
        assert.equal(res.body.results[0]._id, 'real-report-id')
        assert.equal(res.body.total, 1)
        assert.equal(res.body.filters.status, 'active')
        assert.equal(res.body.pagination.limit, 20)
    } finally {
        aiService.parseLostFoundQuery = originalParser
        searchService.searchLostFoundReports = originalSearch
    }
})

test('AI provider failure returns a safe fallback and does not invoke report mutations', async () => {
    const originalParser = aiService.parseLostFoundQuery
    const originalError = console.error
    aiService.parseLostFoundQuery = async () => { throw new aiService.AILostFoundSearchError() }
    console.error = () => {}
    try {
        const res = responseMock()
        await controller.searchLostFound({ body: { query: 'lost wallet' } }, res)
        assert.equal(res.statusCode, 503)
        assert.equal(res.body.success, false)
        assert.match(res.body.message, /search Lost & Found directly/)
    } finally {
        aiService.parseLostFoundQuery = originalParser
        console.error = originalError
    }
})
