const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const LostFoundReport = require('../models/LostFoundReport')
const LostFoundClaim = require('../models/LostFoundClaim')
const Conversation = require('../models/Conversation')
const { validateBody, MAX_IMAGES } = require('../controllers/lostFoundController')

const validReport = {
    type: 'lost',
    title: 'Black wallet',
    category: 'Wallets & Cards',
    description: 'Small black wallet with a campus card inside.',
    location: 'Library',
    date: '2026-09-27',
    images: [],
}

test('accepts a valid report and rejects frontend ownership fields', () => {
    assert.equal(validateBody(validReport), null)
    assert.match(validateBody({ ...validReport, reportedBy: new mongoose.Types.ObjectId() }), /unsupported fields/)
})

test('validates report type, required fields, dates, and image URL safety', () => {
    assert.match(validateBody({ ...validReport, type: 'missing' }), /type must be lost or found/)
    assert.match(validateBody({ ...validReport, date: 'not-a-date' }), /valid date/)
    assert.match(validateBody({ ...validReport, images: ['http://res.cloudinary.com/example/image.png'] }), /secure Cloudinary URLs/)
    assert.match(validateBody({ ...validReport, images: ['https://example.com/image.png'] }), /secure Cloudinary URLs/)
    assert.equal(validateBody({ ...validReport, images: ['https://res.cloudinary.com/demo/image/upload/sample.png'] }), null)
})

test('caps report images and report description length', () => {
    assert.equal(MAX_IMAGES, 5)
    assert.match(validateBody({ ...validReport, images: Array.from({ length: 6 }, () => 'https://res.cloudinary.com/demo/image/upload/sample.png') }), /at most 5/)
    assert.match(validateBody({ ...validReport, description: 'x'.repeat(2001) }), /2000 characters or fewer/)
})

test('lost and found models define required states and scoped claim indexes', () => {
    assert.deepEqual(LostFoundReport.schema.path('type').enumValues, ['lost', 'found'])
    assert.deepEqual(LostFoundReport.schema.path('status').enumValues, ['active', 'claimed', 'returned', 'closed'])
    assert.deepEqual(LostFoundClaim.schema.path('status').enumValues, ['pending', 'approved', 'rejected'])
    assert.ok(LostFoundClaim.schema.indexes().some(([keys, options]) => keys.report === 1 && keys.claimant === 1 && options.unique))
})

test('chat conversations support exactly one product or lost and found target', async () => {
    const first = new mongoose.Types.ObjectId()
    const second = new mongoose.Types.ObjectId()
    await new Conversation({ participants: [first, second], product: first }).validate()
    await new Conversation({ participants: [first, second], lostFoundReport: first }).validate()
    await new Conversation({ participants: [first, second], campusExchange: first }).validate()
    await assert.rejects(new Conversation({ participants: [first, second] }).validate(), /exactly one/)
    await assert.rejects(new Conversation({ participants: [first, second], product: first, lostFoundReport: second }).validate(), /exactly one/)
})
