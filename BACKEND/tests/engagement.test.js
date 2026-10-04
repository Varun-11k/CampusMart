const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const SellerOffer = require('../models/SellerOffer')
const Coupon = require('../models/Coupon')
const CouponRedemption = require('../models/CouponRedemption')
const CampusPoll = require('../models/CampusPoll')
const CampusPointTransaction = require('../models/CampusPointTransaction')
const PriceDropNotice = require('../models/PriceDropNotice')
const controller = require('../controllers/engagementController')

function resRecorder() { return { statusCode: 200, data: null, status(code) { this.statusCode = code; return this }, json(body) { this.data = body; return this } } }

test('engagement models define bounded values and dedupe keys', async () => {
    assert.deepEqual(SellerOffer.schema.path('status').enumValues, ['scheduled', 'active', 'expired', 'cancelled'])
    assert.deepEqual(Coupon.schema.path('type').enumValues, ['percentage', 'fixed'])
    assert.ok(CouponRedemption.schema.indexes().some(([keys, options]) => keys.coupon === 1 && keys.user === 1 && options.unique))
    assert.ok(CampusPoll.schema.indexes().some(([keys]) => keys.status === 1 && keys.createdAt === -1))
    assert.ok(CampusPointTransaction.schema.indexes().some(([keys, options]) => keys.user === 1 && keys.action === 1 && options.unique))
    assert.ok(PriceDropNotice.schema.indexes().some(([keys, options]) => keys.user === 1 && keys.product === 1 && options.unique))
    await assert.rejects(new SellerOffer({ product: new mongoose.Types.ObjectId(), seller: new mongoose.Types.ObjectId(), offerPrice: 10, startTime: new Date(), endTime: new Date(Date.now() - 1) }).validate(), /endTime/)
})

test('offer status is derived from dates and never reactivates terminal states', () => {
    const now = new Date('2026-10-01T12:00:00Z')
    assert.equal(controller.offerIsActive({ status: 'scheduled', startTime: new Date('2026-10-01T11:00:00Z'), endTime: new Date('2026-10-01T13:00:00Z') }, now), true)
    assert.equal(controller.offerIsActive({ status: 'expired', startTime: new Date('2026-10-01T11:00:00Z'), endTime: new Date('2026-10-01T13:00:00Z') }, now), false)
    assert.equal(controller.offerIsActive({ status: 'active', startTime: new Date('2026-10-01T11:00:00Z'), endTime: new Date('2026-10-01T11:30:00Z') }, now), false)
})

test('poll serialization exposes aggregate totals and never voter identity', () => {
    const voter = new mongoose.Types.ObjectId(); const author = new mongoose.Types.ObjectId()
    const serialized = controller.serializePoll({ _id: new mongoose.Types.ObjectId(), question: 'Library hours?', options: ['Longer', 'Same'], author, votes: [{ user: voter, optionIndex: 0 }, { user: author, optionIndex: 1 }] }, voter)
    assert.deepEqual(serialized.counts, [1, 1])
    assert.equal(serialized.totalVotes, 2)
    assert.equal(serialized.voted, true)
    assert.equal(JSON.stringify(serialized).includes(voter.toString()), false)
})

test('poll voting derives identity from auth and refuses a duplicate/closed vote atomically', async () => {
    const user = new mongoose.Types.ObjectId(); const id = new mongoose.Types.ObjectId()
    const original = CampusPoll.findOneAndUpdate; let query
    CampusPoll.findOneAndUpdate = async (filter) => { query = filter; return null }
    try {
        const res = resRecorder()
        await controller.votePoll({ params: { id: String(id) }, body: { optionIndex: 0, user: new mongoose.Types.ObjectId() }, user: { _id: user } }, res, (error) => { throw error })
        assert.equal(res.statusCode, 409)
        assert.equal(query.votes.$not.$elemMatch.user, user)
        assert.equal(query.status, 'active')
    } finally { CampusPoll.findOneAndUpdate = original }
})

test('offer creation rejects an offer made for another seller product', async () => {
    const user = new mongoose.Types.ObjectId(); const otherSeller = new mongoose.Types.ObjectId(); const productId = new mongoose.Types.ObjectId()
    const originalFind = require('../models/Product').findOne; const originalOfferCreate = SellerOffer.create; let saved = false
    require('../models/Product').findOne = () => ({ select: async () => ({ _id: productId, seller: otherSeller, price: 100 }) })
    SellerOffer.create = async () => { saved = true }
    try {
        const res = resRecorder()
        await controller.createOffer({ body: { product: String(productId), offerPrice: 50, startTime: new Date().toISOString(), endTime: new Date(Date.now() + 60000).toISOString() }, user: { _id: user } }, res, (error) => { throw error })
        assert.equal(res.statusCode, 403)
        assert.equal(saved, false)
    } finally { require('../models/Product').findOne = originalFind; SellerOffer.create = originalOfferCreate }
})
