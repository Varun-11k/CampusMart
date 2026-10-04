const test = require('node:test')
const assert = require('node:assert/strict')
const recommendationService = require('../services/recommendationService')
const campusService = require('../services/campusRecommendationService')
const Resource = require('../models/Resource')
const controller = require('../controllers/campusRecommendationController')

function responseMock() { return { body: null, json(body) { this.body = body; return this } } }

test('new user receives no fabricated or generic recommendations without legitimate activity', async () => {
    const originalGet = recommendationService.getRecommendations
    recommendationService.getRecommendations = async () => ({ personalized: false, products: [] })
    try {
        const result = await campusService.getCampusRecommendations({ _id: 'user-a' })
        assert.deepEqual(result, { personalized: false, marketplace: [], resources: [], lostFound: [] })
    } finally { recommendationService.getRecommendations = originalGet }
})

test('Campus AI recommendations query only active, downloaded resources with a hard limit', async () => {
    const originalGet = recommendationService.getRecommendations
    const originalFind = Resource.find
    let filter
    let projection
    let limit
    recommendationService.getRecommendations = async (user) => {
        assert.equal(user._id, 'authenticated-user')
        return { personalized: true, products: [{ _id: 'product-id', title: 'Calculator', status: 'available', recommendationReason: 'Because you saved similar items.', moderationStatus: 'active', seller: { name: 'Seller', email: 'private@example.test' } }] }
    }
    Resource.find = (query) => {
        filter = query
        return { select(fields) { projection = fields; return this }, sort() { return this }, limit(value) { limit = value; return this }, async lean() { return [{ _id: 'resource-id', title: 'DBMS Notes', status: 'active', downloads: 4, uploadedBy: 'private-user-id' }] } }
    }
    try {
        const result = await campusService.getCampusRecommendations({ _id: 'authenticated-user' })
        assert.deepEqual(filter, { status: 'active', downloads: { $gt: 0 } })
        assert.equal(limit, 5)
        assert.doesNotMatch(projection, /uploadedBy|email|password|__v/)
        assert.equal(result.marketplace[0].recommendationReason, 'Because you saved similar items.')
        assert.equal(result.marketplace[0].moderationStatus, undefined)
        assert.equal(result.marketplace[0].seller.email, undefined)
        assert.equal(result.resources[0].recommendationReason, 'Frequently accessed campus resource.')
        assert.equal(result.resources[0].uploadedBy, undefined)
        assert.deepEqual(result.lostFound, [])
    } finally { recommendationService.getRecommendations = originalGet; Resource.find = originalFind }
})

test('recommendation endpoint derives identity from authenticated request and returns no activity context', async () => {
    const originalGet = campusService.getCampusRecommendations
    campusService.getCampusRecommendations = async (user) => ({ personalized: true, marketplace: [{ _id: user._id }], resources: [], lostFound: [] })
    try {
        const res = responseMock()
        await controller.getRecommendations({ user: { _id: 'request-user' }, query: { userId: 'other-user' } }, res, (error) => { throw error })
        assert.deepEqual(res.body.recommendations.marketplace, [{ _id: 'request-user' }])
        assert.equal(res.body.context, undefined)
    } finally { campusService.getCampusRecommendations = originalGet }
})
