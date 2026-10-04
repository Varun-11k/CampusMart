const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const CampusExchange = require('../models/CampusExchange')
const CampusExchangeRequest = require('../models/CampusExchangeRequest')
const Conversation = require('../models/Conversation')
const controller = require('../controllers/campusExchangeController')

const image = 'https://res.cloudinary.com/demo/image/upload/sample.png'
const validListing = {
    title: 'Scientific calculator exchange', description: 'Looking for a similar calculator.',
    category: 'Electronics', condition: 'Good', offeredItem: 'Casio calculator',
    wantedItem: 'Engineering textbook', location: 'North campus library', images: [image],
}

function responseRecorder() {
    return {
        statusCode: 200, payload: null,
        status(code) { this.statusCode = code; return this },
        json(value) { this.payload = value; return this },
    }
}

test('Campus Exchange models validate listing/request states and indexes', async () => {
    assert.deepEqual(CampusExchange.schema.path('condition').enumValues, ['New', 'Like New', 'Good', 'Fair'])
    assert.deepEqual(CampusExchange.schema.path('status').enumValues, ['active', 'exchanged', 'closed'])
    assert.deepEqual(CampusExchangeRequest.schema.path('status').enumValues, ['pending', 'accepted', 'rejected', 'cancelled'])
    assert.ok(CampusExchange.schema.indexes().some(([keys]) => keys.status === 1 && keys.category === 1))
    assert.ok(CampusExchangeRequest.schema.indexes().some(([keys, options]) => keys.exchange === 1 && keys.requester === 1 && options.unique))
    await new CampusExchange({ ...validListing, owner: new mongoose.Types.ObjectId() }).validate()
    await assert.rejects(new CampusExchange({ ...validListing, owner: new mongoose.Types.ObjectId(), condition: 'Used' }).validate(), /condition/)
    await assert.rejects(new CampusExchangeRequest({ exchange: new mongoose.Types.ObjectId(), requester: new mongoose.Types.ObjectId(), message: 'x'.repeat(1001) }).validate(), /message/)
})

test('Campus Exchange body validation rejects owner spoofing, injected fields, bad categories and unsafe images', () => {
    assert.equal(controller.validateBody(validListing), null)
    assert.match(controller.validateBody({ ...validListing, owner: new mongoose.Types.ObjectId() }), /unsupported fields/)
    assert.match(controller.validateBody({ ...validListing, category: { $ne: '' } }), /category/)
    assert.match(controller.validateBody({ ...validListing, condition: 'Used' }), /condition/)
    assert.match(controller.validateBody({ ...validListing, images: ['javascript:alert(1)'] }), /Cloudinary URLs/)
    assert.match(controller.validateBody({ ...validListing, images: Array(6).fill(image) }), /up to 5/)
    assert.match(controller.validateBody({ ...validListing, description: 'x'.repeat(2001) }), /2000/)
})

test('public Campus Exchange filters only active content and safely escape text filters', () => {
    const query = controller.buildFilter({ search: 'calculator $where', category: 'Books.*', condition: 'invalid', location: 'North (campus)' })
    assert.equal(query.status, 'active')
    assert.equal(query.$or[0].moderationStatus, 'active')
    assert.deepEqual(query.$text, { $search: 'calculator where' })
    assert.equal(query.category.toString(), '/^Books\\.\\*$/i')
    assert.equal(query.condition, '__invalid_condition__')
    assert.equal(query.location.toString(), '/North \\(campus\\)/i')
})

test('public serialization removes moderation state and private owner fields', () => {
    const owner = new mongoose.Types.ObjectId()
    const result = controller.publicExchange({ ...validListing, _id: new mongoose.Types.ObjectId(), moderationStatus: 'hidden', owner: { _id: owner, name: 'Student', college: 'Campus', email: 'private@example.com', phone: 'private' } })
    assert.equal(result.moderationStatus, undefined)
    assert.equal(result.owner.email, undefined)
    assert.equal(result.owner.phone, undefined)
    assert.equal(result.owner.name, 'Student')
})

test('request endpoint uses req.user and rejects self-requests without creating a request', async () => {
    const owner = new mongoose.Types.ObjectId()
    const exchangeId = new mongoose.Types.ObjectId()
    const originalFindOne = CampusExchange.findOne
    const originalCreate = CampusExchangeRequest.create
    let created = false
    CampusExchange.findOne = async () => ({ _id: exchangeId, owner })
    CampusExchangeRequest.create = async () => { created = true }
    try {
        const res = responseRecorder()
        await controller.requestExchange({ params: { id: String(exchangeId) }, body: { message: 'I can trade a textbook' }, user: { _id: owner } }, res, (error) => { throw error })
        assert.equal(res.statusCode, 400)
        assert.match(res.payload.message, /own exchange/)
        assert.equal(created, false)
    } finally {
        CampusExchange.findOne = originalFindOne
        CampusExchangeRequest.create = originalCreate
    }
})

test('owner-only request access and edit authorization are enforced in controller handlers', async () => {
    const owner = new mongoose.Types.ObjectId()
    const intruder = new mongoose.Types.ObjectId()
    const exchangeId = new mongoose.Types.ObjectId()
    const originalFindById = CampusExchange.findById
    let requestQueryUsed = false
    const originalRequestFind = CampusExchangeRequest.find
    CampusExchange.findById = () => ({
        _id: exchangeId, owner: { toString: () => owner.toString() }, status: 'active', moderationStatus: 'active',
        select: async () => ({ _id: exchangeId, owner: { toString: () => owner.toString() } }),
    })
    CampusExchangeRequest.find = () => { requestQueryUsed = true; throw new Error('must not read private requests') }
    try {
        const reqRes = responseRecorder()
        await controller.getExchangeRequests({ params: { id: String(exchangeId) }, user: { _id: intruder } }, reqRes, (error) => { throw error })
        assert.equal(reqRes.statusCode, 403)
        assert.equal(requestQueryUsed, false)

        const updateRes = responseRecorder()
        await controller.updateExchange({ params: { id: String(exchangeId) }, body: { title: 'Intrusion attempt' }, files: [], user: { _id: intruder } }, updateRes, (error) => { throw error })
        assert.equal(updateRes.statusCode, 403)
        assert.match(updateRes.payload.message, /Only the owner/)

        const deleteRes = responseRecorder()
        await controller.deleteExchange({ params: { id: String(exchangeId) }, user: { _id: intruder } }, deleteRes, (error) => { throw error })
        assert.equal(deleteRes.statusCode, 403)
    } finally {
        CampusExchange.findById = originalFindById
        CampusExchangeRequest.find = originalRequestFind
    }
})

test('exchange chat target is supported by the existing conversation model', async () => {
    const users = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()]
    await new Conversation({ participants: users, campusExchange: new mongoose.Types.ObjectId() }).validate()
    await assert.rejects(new Conversation({ participants: users, campusExchange: new mongoose.Types.ObjectId(), product: new mongoose.Types.ObjectId() }).validate(), /exactly one/)
})
