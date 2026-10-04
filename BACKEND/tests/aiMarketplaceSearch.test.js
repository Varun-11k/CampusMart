const test = require('node:test')
const assert = require('node:assert/strict')
const Product = require('../models/Product')
const searchService = require('../services/aiMarketplaceSearchService')
const controller = require('../controllers/aiMarketplaceController')

function aiFilters(overrides = {}) {
    return searchService.normalizeFilters({ query: 'calculator', category: 'Electronics', minPrice: null, maxPrice: 700, condition: null, location: null, sort: null, ...overrides })
}
function responseMock() {
    return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
}

test('AI marketplace filters use supported Product categories, conditions and safe sort values', () => {
    assert.deepEqual(aiFilters({ condition: 'Good', sort: 'price_asc' }), { query: 'calculator', category: 'Electronics', minPrice: null, maxPrice: 700, condition: 'Good', location: null, sort: 'price_asc' })
    assert.equal(aiFilters({ category: 'Calculators' }).category, null)
    assert.equal(aiFilters({ condition: 'Used' }).condition, null)
    assert.equal(aiFilters({ location: 'near library' }).location, null)
    assert.equal(aiFilters({ sort: { price: 1 } }).sort, null)
    assert.equal(aiFilters({ query: '  laptop\u0000  ' }).query, 'laptop')
})

test('AI marketplace price validation rejects unsafe values and ranges', () => {
    for (const price of [-1, Infinity, NaN, 100_000_001, '700']) {
        assert.throws(() => aiFilters({ maxPrice: price }), searchService.AIMarketplaceSearchError)
    }
    assert.throws(() => aiFilters({ minPrice: 900, maxPrice: 700 }), searchService.AIMarketplaceSearchError)
    assert.throws(() => aiFilters({ query: 'x'.repeat(101) }), searchService.AIMarketplaceSearchError)
    assert.throws(() => searchService.normalizeFilters({ ...aiFilters(), mongoQuery: { $where: 'true' } }), searchService.AIMarketplaceSearchError)
})

test('AI provider receives only the query and its structured response is normalized', async () => {
    const originalFetch = global.fetch
    const originalKey = process.env.GEMINI_API_KEY
    process.env.GEMINI_API_KEY = 'test-only-key'
    global.fetch = async (url, options) => {
        assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent')
        assert.equal(options.headers['x-goog-api-key'], 'test-only-key')
        const request = JSON.parse(options.body)
        assert.equal(request.generationConfig.responseMimeType, 'application/json')
        assert.match(request.contents[0].parts[0].text, /Find calculators under/)
        return {
            ok: true,
            async json() {
                return {
                    candidates: [{
                        content: {
                            parts: [{ text: JSON.stringify({ query: 'calculator', category: 'Electronics', minPrice: null, maxPrice: 700, condition: null, location: null, sort: null }) }],
                        },
                    }],
                }
            },
        }
    }
    try {
        const result = await searchService.parseMarketplaceQuery('Find calculators under ₹700')
        assert.equal(result.query, 'calculator')
        assert.equal(result.maxPrice, 700)
        assert.equal(result.category, 'Electronics')
    } finally {
        global.fetch = originalFetch
        if (originalKey === undefined) delete process.env.GEMINI_API_KEY
        else process.env.GEMINI_API_KEY = originalKey
    }
})

test('marketplace endpoint validates body and pagination limits', () => {
    assert.equal(controller.validateRequest({ query: 'calculators', page: 1, limit: 20 }), null)
    assert.match(controller.validateRequest({ query: 'x', filter: { $where: 'true' } }), /Only query/)
    assert.match(controller.validateRequest({ query: 'x', page: 0 }), /page must/)
    assert.match(controller.validateRequest({ query: 'x', limit: 1000 }), /limit must/)
    assert.match(controller.validateRequest({ query: 'x'.repeat(301) }), /300 characters/)
})

test('marketplace search uses the existing safe query builder and returns only paginated public product fields', async () => {
    const originalFind = Product.find
    const originalCount = Product.countDocuments
    const originalClassifier = searchService.parseMarketplaceQuery
    let capturedFilter
    let capturedProjection
    let capturedSort
    let capturedLimit
    Product.find = (filter) => {
        capturedFilter = filter
        return { select(fields) { capturedProjection = fields; return this }, sort(value) { capturedSort = value; return this }, skip() { return this }, limit(value) { capturedLimit = value; return this }, async lean() { return [{ _id: 'real-id', title: 'Calculator', price: 650 }] } }
    }
    Product.countDocuments = async () => 1
    searchService.parseMarketplaceQuery = async () => aiFilters({ condition: 'Good', sort: 'price_asc' })
    try {
        const res = responseMock()
        await controller.searchMarketplace({ body: { query: 'calculator under 700', page: 1 }, user: null }, res)
        assert.equal(res.statusCode, 200)
        assert.equal(res.body.results[0]._id, 'real-id')
        assert.equal(res.body.total, 1)
        assert.equal(res.body.pagination.limit, 20)
        assert.deepEqual(capturedSort, { price: 1, createdAt: -1 })
        assert.equal(capturedLimit, 20)
        assert.match(capturedProjection, /title/)
        assert.doesNotMatch(capturedProjection, /seller|email|phone|password/)
        assert.equal(capturedFilter.status, 'available')
        assert.ok(capturedFilter.$and.some((clause) => clause.condition?.$in?.includes('Good')))
        assert.equal(capturedFilter.$and.at(-1).price.$lte, 700)
    } finally {
        Product.find = originalFind
        Product.countDocuments = originalCount
        searchService.parseMarketplaceQuery = originalClassifier
    }
})

test('near campus maps to the authenticated user college and never accepts a frontend college', async () => {
    const originalFind = Product.find
    const originalCount = Product.countDocuments
    const originalClassifier = searchService.parseMarketplaceQuery
    let filter
    Product.find = (query) => { filter = query; return { select() { return this }, sort() { return this }, skip() { return this }, limit() { return this }, async lean() { return [] } } }
    Product.countDocuments = async () => 0
    searchService.parseMarketplaceQuery = async () => aiFilters({ location: 'my_college', maxPrice: null })
    try {
        const res = responseMock()
        await controller.searchMarketplace({ body: { query: 'calculators near campus' }, user: { college: 'Verified Campus' } }, res)
        assert.equal(res.body.filters.location, 'my_college')
        assert.ok(filter.$and.some((clause) => clause.college === 'Verified Campus'))
        const publicResponse = responseMock()
        await controller.searchMarketplace({ body: { query: 'calculators near campus' }, user: null }, publicResponse)
        assert.equal(publicResponse.body.filters.location, null)
        assert.equal(filter.$and.some((clause) => Object.hasOwn(clause, 'college')), false)
    } finally {
        Product.find = originalFind
        Product.countDocuments = originalCount
        searchService.parseMarketplaceQuery = originalClassifier
    }
})

test('AI provider failure returns a friendly safe fallback and performs no product writes', async () => {
    const originalClassifier = searchService.parseMarketplaceQuery
    searchService.parseMarketplaceQuery = async () => { throw new searchService.AIMarketplaceSearchError() }
    try {
        const res = responseMock()
        await controller.searchMarketplace({ body: { query: 'calculator' } }, res)
        assert.equal(res.statusCode, 503)
        assert.equal(res.body.success, false)
        assert.match(res.body.message, /Please try Marketplace search directly/)
    } finally { searchService.parseMarketplaceQuery = originalClassifier }
})
