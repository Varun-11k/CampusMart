const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const CampusVoice = require('../models/CampusVoice')
const controller = require('../controllers/campusVoiceController')
const createUserRateLimiter = require('../middleware/createUserRateLimiter')

const userA = new mongoose.Types.ObjectId()
const userB = new mongoose.Types.ObjectId()

function responseMock() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this },
        json(body) { this.body = body; return this },
    }
}

test('voice schema contains only the required author reference and moderation fields', () => {
    assert.equal(CampusVoice.schema.path('author').instance, 'ObjectId')
    assert.equal(CampusVoice.schema.path('content').options.maxlength, 3000)
    assert.equal(CampusVoice.schema.path('isAnonymous').defaultValue, true)
    assert.deepEqual(CampusVoice.schema.path('category').enumValues, ['confession', 'question', 'suggestion', 'experience', 'opinion'])
    assert.deepEqual(CampusVoice.schema.path('status').enumValues, ['active', 'hidden', 'removed'])
    assert.ok(CampusVoice.schema.indexes().some(([keys]) => keys.status === 1 && keys.category === 1 && keys.createdAt === -1))
    assert.ok(CampusVoice.schema.indexes().some(([keys]) => keys.content === 'text'))
})

test('post validation rejects author, likes, status, and other frontend controlled fields', () => {
    assert.equal(controller.validateBody({ content: 'A campus thought', category: 'opinion' }), null)
    assert.match(controller.validateBody({ content: 'x', category: 'opinion', author: userA }), /Only content and category/)
    assert.match(controller.validateBody({ content: 'x', category: 'opinion', status: 'removed' }), /Only content and category/)
    assert.match(controller.validateBody({ content: 'x', category: 'opinion', likes: [userA] }), /Only content and category/)
    assert.match(controller.validateBody({ content: 'x', category: 'invalid' }), /category must be one of/)
    assert.match(controller.validateBody({ content: ' '.repeat(3001), category: 'question' }), /non-empty string/)
    assert.match(controller.validateBody({ content: 'x'.repeat(3001), category: 'question' }), /3000 characters or fewer/)
})

test('public serialization omits author and liker IDs while preserving safe like metadata', () => {
    const safe = controller.serializePost({
        _id: userA,
        author: userB,
        content: 'Campus thought',
        category: 'opinion',
        isAnonymous: false,
        likes: [userA, userB],
        status: 'active',
        __v: 0,
    }, userA)
    assert.equal(safe.author, undefined)
    assert.equal(safe.likes, undefined)
    assert.equal(safe.__v, undefined)
    assert.equal(safe.isAnonymous, true)
    assert.equal(safe.authorLabel, 'Anonymous Student')
    assert.equal(safe.likeCount, 2)
    assert.equal(safe.likedByMe, true)
    assert.equal(safe.isMine, false)
})

test('a user cannot update or delete another author’s post by changing the ID', async () => {
    const originalFindById = CampusVoice.findById
    const post = {
        _id: userA,
        author: userA,
        status: 'active',
        saveCalled: false,
        async save() { this.saveCalled = true },
        async deleteOne() { this.deleteCalled = true },
    }
    CampusVoice.findById = async () => post
    try {
        const updateRes = responseMock()
        await controller.updatePost({ params: { id: userA.toString() }, user: { _id: userB }, body: { content: 'tamper' } }, updateRes, (error) => { throw error })
        assert.equal(updateRes.statusCode, 403)
        assert.equal(post.saveCalled, false)

        const deleteRes = responseMock()
        await controller.deletePost({ params: { id: userA.toString() }, user: { _id: userB } }, deleteRes, (error) => { throw error })
        assert.equal(deleteRes.statusCode, 403)
        assert.equal(post.deleteCalled, undefined)
    } finally { CampusVoice.findById = originalFindById }
})

test('creation takes its author only from req.user and returns an anonymous response', async () => {
    const originalCreate = CampusVoice.create
    let created
    CampusVoice.create = async (document) => { created = document; return { _id: userA, ...document, likes: [], createdAt: new Date() } }
    try {
        const res = responseMock()
        await controller.createPost({ user: { _id: userA }, body: { content: 'A thought', category: 'confession', author: userB } }, res, (error) => { throw error })
        assert.equal(res.statusCode, 400)

        const validRes = responseMock()
        await controller.createPost({ user: { _id: userA }, body: { content: ' A thought ', category: 'confession' } }, validRes, (error) => { throw error })
        assert.equal(created.author.toString(), userA.toString())
        assert.equal(validRes.body.post.author, undefined)
        assert.equal(validRes.body.post.likes, undefined)
        assert.equal(validRes.body.post.authorLabel, 'Anonymous Student')
    } finally { CampusVoice.create = originalCreate }
})

test('user rate limiter enforces the configured per-user threshold', () => {
    const middleware = createUserRateLimiter({ windowMs: 60_000, maxRequests: 1, message: 'slow down' })
    let passed = 0
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
    middleware({ user: { _id: userA } }, res, () => { passed += 1 })
    middleware({ user: { _id: userA } }, res, () => { passed += 1 })
    assert.equal(passed, 1)
    assert.equal(res.statusCode, 429)
})
