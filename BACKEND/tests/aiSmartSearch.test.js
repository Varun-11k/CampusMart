const test = require('node:test')
const assert = require('node:assert/strict')

const { normalizeSearchFilters } = require('../services/aiService')
const { buildProductQuery } = require('../controllers/aiSearchController')

const validFilters = {
    searchText: 'calculator',
    category: 'Electronics',
    condition: 'Good',
    minPrice: null,
    maxPrice: 1000,
}

test('accepts only valid structured AI search filters', () => {
    assert.deepEqual(normalizeSearchFilters(validFilters), validFilters)
})

test('accepts bounded admin-managed category names and rejects invalid conditions, extra fields, and price ranges', () => {
    assert.equal(normalizeSearchFilters({ ...validFilters, category: 'Computers' }).category, 'Computers')
    assert.throws(() => normalizeSearchFilters({ ...validFilters, category: 'x'.repeat(81) }))
    assert.throws(() => normalizeSearchFilters({ ...validFilters, condition: 'Used' }))
    assert.throws(() => normalizeSearchFilters({ ...validFilters, productId: 'invented' }))
    assert.throws(() => normalizeSearchFilters({ ...validFilters, minPrice: 1500, maxPrice: 1000 }))
    assert.throws(() => normalizeSearchFilters({ ...validFilters, maxPrice: '1000' }))
})

test('builds a real-product query with escaped text, active availability, exact filters and numeric bounds', () => {
    const query = buildProductQuery({
        searchText: 'lap.top',
        category: 'Electronics',
        condition: 'Good',
        minPrice: 500,
        maxPrice: 1000,
    })

    assert.equal(query.status, 'available')
    assert.ok(query.$and.some((clause) => clause.$or?.some((condition) => condition.moderationStatus === 'active')))
    assert.ok(query.$and.some((clause) => clause.$or?.some((condition) => condition.title?.$regex === 'lap\\.top')))
    assert.ok(query.$and.some((clause) => clause.category?.$in?.includes('Electronics')))
    assert.ok(query.$and.some((clause) => conditionEquals(clause, 'condition', 'Good')))
    assert.ok(query.$and.some((clause) => clause.price?.$gte === 500 && clause.price?.$lte === 1000))
})

function conditionEquals(clause, field, value) {
    return clause[field]?.$in?.length === 1 && clause[field].$in[0] === value
}
