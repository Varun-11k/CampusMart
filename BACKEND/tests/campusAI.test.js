const test = require('node:test')
const assert = require('node:assert/strict')
const campusAIService = require('../services/campusAIService')
const controller = require('../controllers/campusAIController')

function intent(overrides = {}) {
    return campusAIService.normalizeIntent({
        domain: 'marketplace', query: 'calculator', category: 'Electronics', condition: null, location: null,
        subject: null, course: null, semester: null, type: null, minPrice: null, maxPrice: 700,
        ...overrides,
    })
}

test('Campus AI intent accepts only the documented structured schema', () => {
    const parsed = intent()
    assert.equal(parsed.domain, 'marketplace')
    assert.equal(parsed.query, 'calculator')
    assert.equal(parsed.maxPrice, 700)
    assert.equal(parsed.subject, null)
    assert.throws(() => campusAIService.normalizeIntent({ ...parsed, mongoQuery: { $where: 'evil' } }), campusAIService.CampusAIError)
    assert.throws(() => campusAIService.normalizeIntent({ ...parsed, domain: 'admin' }), campusAIService.CampusAIError)
    assert.throws(() => campusAIService.normalizeIntent({ ...parsed, condition: '$where' }), campusAIService.CampusAIError)
    assert.throws(() => campusAIService.normalizeIntent({ ...parsed, minPrice: '0' }), campusAIService.CampusAIError)
    assert.throws(() => campusAIService.normalizeIntent({ ...parsed, minPrice: 800, maxPrice: 700 }), campusAIService.CampusAIError)
})

test('Campus AI validates endpoint input and rejects client-supplied database filters', () => {
    assert.equal(controller.validateRequest({ query: 'Find DBMS notes' }), null)
    assert.match(controller.validateRequest({ query: 'x', filters: { $where: 'true' } }), /Only query/)
    assert.match(controller.validateRequest({ query: ' ' }), /query is required/)
    assert.match(controller.validateRequest({ query: 'x'.repeat(301) }), /300 characters/)
})

test('marketplace interpretations reuse safe product filters and visibility rules', () => {
    const query = controller.resultQuery(intent(), 'marketplace')
    assert.equal(query.status, 'available')
    assert.equal(query.$and[0].$or[0].moderationStatus, 'active')
    assert.equal(query.$and[1].$or[0].title.$regex, 'calculator')
    assert.deepEqual(query.$and.at(-1), { price: { $lte: 700 } })
})

test('lost and found interpretations search only active reports with escaped filters', () => {
    const query = controller.resultQuery(intent({ domain: 'lost_found', query: 'black wallet', category: 'Wallets', location: 'Library', type: 'lost', maxPrice: null }), 'lost_found')
    assert.equal(query.status, 'active')
    assert.equal(query.type, 'lost')
    assert.equal(query.category.toString(), '/Wallets/i')
    assert.equal(query.location.toString(), '/Library/i')
    assert.equal(query.$or[0].title.toString(), '/black wallet/i')
})

test('resource interpretations use active resource type, subject, course and semester filters', () => {
    const query = controller.resultQuery(intent({ domain: 'resources', query: 'DBMS notes', category: null, type: 'notes', subject: 'DBMS', course: 'CSE', semester: '4', maxPrice: null }), 'resources')
    assert.equal(query.status, 'active')
    assert.equal(query.type, 'notes')
    assert.equal(query.subject.toString(), '/^DBMS$/i')
    assert.equal(query.course.toString(), '/^CSE$/i')
    assert.equal(query.semester.toString(), '/^4$/i')
    assert.equal(query.$text.$search, 'DBMS notes')
})

test('empty unrelated interpretations do not return broad recent database results', async () => {
    const noIntent = intent({ domain: 'all', query: '', category: null, maxPrice: null })
    const result = await controller.findResults(noIntent)
    assert.deepEqual(result, { marketplace: [], lostFound: [], resources: [], campusExchange: [] })
})

test('Campus Exchange AI intent builds an active, moderated, safe structured filter', () => {
    const exchangeIntent = intent({ domain: 'campus_exchange', query: 'calculator swap', category: 'Electronics', condition: 'Good', location: 'North Library', minPrice: null, maxPrice: null })
    const query = controller.resultQuery(exchangeIntent, 'campus_exchange')
    assert.equal(query.status, 'active')
    assert.equal(query.$or[0].moderationStatus, 'active')
    assert.deepEqual(query.$text, { $search: 'calculator swap' })
    assert.equal(query.category.toString(), '/^Electronics$/i')
    assert.equal(query.condition, 'Good')
    assert.equal(query.location.toString(), '/North Library/i')
})
