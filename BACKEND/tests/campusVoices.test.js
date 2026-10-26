const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const CampusVoice = require('../models/CampusVoice')
const Report = require('../models/Report')
const User = require('../models/User')
const controller = require('../controllers/campusVoiceController')
const reportController = require('../controllers/reportController')
const adminMiddleware = require('../middleware/adminMiddleware')
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
    assert.equal(CampusVoice.schema.path('author').options.select, false)
    assert.equal(CampusVoice.schema.path('content').options.maxlength, 3000)
    assert.equal(CampusVoice.schema.path('isAnonymous').defaultValue, true)
    assert.deepEqual(CampusVoice.schema.path('category').enumValues, ['confession', 'question', 'suggestion', 'experience', 'opinion'])
    assert.deepEqual(CampusVoice.schema.path('status').enumValues, ['pending', 'active', 'hidden', 'rejected', 'removed'])
    assert.equal(CampusVoice.schema.path('likes').options.select, false)
    assert.equal(CampusVoice.schema.path('moderationHistory').options.select, false)
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
    assert.match(controller.validateBody({ content: 'short', category: 'confession' }), /at least 10 characters/)
    assert.match(controller.validateBody({ content: 'Email me at student@example.edu please', category: 'confession' }), /Remove email addresses and phone numbers/)
    assert.match(controller.validateBody({ content: 'Call me at +91 9876543210', category: 'confession' }), /Remove email addresses and phone numbers/)
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
        authorDeletedAt: new Date(),
        moderationHistory: [{ moderator: userB, action: 'approved' }],
        email: 'private@example.edu',
        profileImage: 'private-photo',
    }, userA)
    assert.equal(safe.author, undefined)
    assert.equal(safe.likes, undefined)
    assert.equal(safe.__v, undefined)
    assert.equal(safe.status, undefined)
    assert.equal(safe.isAnonymous, true)
    assert.equal(safe.authorLabel, 'Anonymous Student')
    assert.equal(safe.likeCount, 2)
    assert.equal(safe.likedByMe, true)
    assert.equal(safe.isMine, false)
    assert.equal(safe.authorDeletedAt, undefined)
    assert.equal(safe.moderationHistory, undefined)
    assert.equal(safe.email, undefined)
    assert.equal(JSON.stringify(safe).includes(userB.toString()), false)
})

test('public and personal confession feeds omit author identifiers and moderation status', async () => {
    const originals = {
        find: CampusVoice.find,
        countDocuments: CampusVoice.countDocuments,
        aggregate: CampusVoice.aggregate,
    }
    const post = {
        _id: 'voice-id',
        author: userA,
        likes: [userB],
        content: 'Anonymous activity',
        category: 'confession',
        status: 'hidden',
        __v: 2,
        createdAt: new Date(),
    }
    let selectedFields = ''
    CampusVoice.find = () => {
        const query = {
            select(fields) { selectedFields = fields; return query },
            sort() { return query },
            skip() { return query },
            limit() { return query },
            lean: async () => [post],
        }
        return query
    }
    CampusVoice.countDocuments = async () => 1
    CampusVoice.aggregate = async () => [{ _id: post._id, count: 1, likedByMe: true }]
    try {
        const publicRes = responseMock()
        await controller.listPosts({ query: {}, user: null }, publicRes, (error) => { throw error })
        assert.match(selectedFields, /-status/)
        assert.equal(publicRes.body.posts[0].author, undefined)
        assert.equal(publicRes.body.posts[0].status, undefined)
        assert.equal(publicRes.body.posts[0].moderationHistory, undefined)

        const ownRes = responseMock()
        await controller.myPosts({ query: {}, user: { _id: userA } }, ownRes, (error) => { throw error })
        assert.match(selectedFields, /\+authorDeletedAt/)
        assert.equal(ownRes.body.posts[0].author, undefined)
        assert.equal(ownRes.body.posts[0].status, undefined)
        assert.equal(ownRes.body.posts[0].moderationStatus, 'hidden')
        assert.equal(ownRes.body.posts[0].isMine, true)
    } finally {
        CampusVoice.find = originals.find
        CampusVoice.countDocuments = originals.countDocuments
        CampusVoice.aggregate = originals.aggregate
    }
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
    CampusVoice.findById = () => ({ select: async () => post })
    try {
        const updateRes = responseMock()
        await controller.updatePost({ params: { id: userA.toString() }, user: { _id: userB }, body: { content: 'tampered text' } }, updateRes, (error) => { throw error })
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
    const originalFind = CampusVoice.find
    let created
    CampusVoice.find = () => ({ select() { return this }, sort() { return this }, limit() { return this }, lean: async () => [] })
    CampusVoice.create = async (document) => { created = document; return { _id: userA, ...document, likes: [], createdAt: new Date() } }
    try {
        const res = responseMock()
        await controller.createPost({ user: { _id: userA }, body: { content: 'A thought', category: 'confession', author: userB } }, res, (error) => { throw error })
        assert.equal(res.statusCode, 400)

        const validRes = responseMock()
        await controller.createPost({ user: { _id: userA }, body: { content: ' A campus thought ', category: 'confession' } }, validRes, (error) => { throw error })
        assert.equal(created.author.toString(), userA.toString())
        assert.equal(created.status, 'pending')
        assert.equal(validRes.body.post.author, undefined)
        assert.equal(validRes.body.post.likes, undefined)
        assert.equal(validRes.body.post.moderationStatus, 'pending')
        assert.equal(validRes.body.post.authorLabel, 'Anonymous Student')
    } finally { CampusVoice.create = originalCreate; CampusVoice.find = originalFind }
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

test('duplicate confession content is rejected without storing or logging it again', async () => {
    const originalFind = CampusVoice.find
    const originalCreate = CampusVoice.create
    let createCalled = false
    CampusVoice.find = () => ({
        select() { return this },
        sort() { return this },
        limit() { return this },
        lean: async () => [{ content: 'A repeated campus confession' }],
    })
    CampusVoice.create = async () => { createCalled = true }
    try {
        const res = responseMock()
        await controller.createPost({ user: { _id: userA }, body: { content: ' A repeated   campus confession ', category: 'confession' } }, res, (error) => { throw error })
        assert.equal(res.statusCode, 409)
        assert.equal(createCalled, false)
        assert.equal(JSON.stringify(res.body).includes('A repeated campus confession'), false)
    } finally {
        CampusVoice.find = originalFind
        CampusVoice.create = originalCreate
    }
})

test('public list serialization returns only allowlisted post fields', async () => {
    const originals = { find: CampusVoice.find, countDocuments: CampusVoice.countDocuments, aggregate: CampusVoice.aggregate }
    const post = {
        _id: 'public-voice-id',
        author: userA,
        likes: [userB],
        content: 'A public anonymous confession',
        category: 'confession',
        status: 'active',
        moderationHistory: [{ moderator: userB, action: 'approved', note: 'private' }],
        authorDeletedAt: new Date(),
        email: 'student@example.edu',
        profileImage: 'private-image',
        createdAt: new Date(),
        __v: 2,
    }
    CampusVoice.find = () => ({
        select() { return this },
        sort() { return this },
        skip() { return this },
        limit() { return this },
        lean: async () => [post],
    })
    CampusVoice.countDocuments = async () => 1
    CampusVoice.aggregate = async () => [{ _id: post._id, count: 1 }]
    try {
        const res = responseMock()
        await controller.listPosts({ query: {}, user: null }, res, (error) => { throw error })
        const payload = JSON.stringify(res.body.posts[0])
        for (const privateValue of [userA.toString(), userB.toString(), 'student@example.edu', 'private-image', 'moderationHistory', 'authorDeletedAt']) {
            assert.equal(payload.includes(privateValue), false)
        }
        assert.equal(res.body.posts[0].content, post.content)
        assert.equal(res.body.posts[0].likeCount, 1)
    } finally {
        CampusVoice.find = originals.find
        CampusVoice.countDocuments = originals.countDocuments
        CampusVoice.aggregate = originals.aggregate
    }
})

test('public detail and reaction APIs return no author or liker identifiers', async () => {
    const originals = {
        findById: CampusVoice.findById,
        findOne: CampusVoice.findOne,
        updateOne: CampusVoice.updateOne,
    }
    const post = {
        _id: userA,
        author: userB,
        likes: [userA],
        content: 'An approved confession',
        category: 'confession',
        status: 'active',
        createdAt: new Date(),
        privateField: 'not-for-viewers',
    }
    CampusVoice.findById = () => ({ select() { return { lean: async () => post } } })
    let lookup = 0
    CampusVoice.findOne = () => ({
        select: async () => {
            lookup += 1
            return { _id: userA, likes: lookup === 1 ? [userB] : [userA, userB] }
        },
    })
    CampusVoice.updateOne = async () => ({ modifiedCount: 1 })
    try {
        const detailRes = responseMock()
        await controller.getPost({ params: { id: userA.toString() }, user: null }, detailRes, (error) => { throw error })
        const detail = JSON.stringify(detailRes.body.post)
        assert.equal(detail.includes(userB.toString()), false)
        assert.equal(detail.includes('not-for-viewers'), false)
        assert.equal(detailRes.body.post.status, undefined)

        const likeRes = responseMock()
        await controller.toggleLike({ params: { id: userA.toString() }, user: { _id: userA } }, likeRes, (error) => { throw error })
        assert.deepEqual(likeRes.body, { success: true, likeCount: 2, likedByMe: true })
        assert.equal(JSON.stringify(likeRes.body).includes(userB.toString()), false)
    } finally {
        CampusVoice.findById = originals.findById
        CampusVoice.findOne = originals.findOne
        CampusVoice.updateOne = originals.updateOne
    }
})

test('moderation queue omits author and moderator IDs from its administrator response', async () => {
    const originals = { find: CampusVoice.find, countDocuments: CampusVoice.countDocuments }
    let selected = ''
    CampusVoice.find = () => ({
        select(fields) { selected = fields; return this },
        sort() { return this },
        skip() { return this },
        limit() { return this },
        lean: async () => [{
            _id: 'pending-id',
            author: userA,
            content: 'A pending campus confession',
            category: 'confession',
            status: 'pending',
            moderationHistory: [{ moderator: userB, action: 'hidden', note: 'review note' }],
        }],
    })
    CampusVoice.countDocuments = async () => 1
    try {
        const res = responseMock()
        await controller.listAdminPosts({ query: { status: 'pending' } }, res, (error) => { throw error })
        const payload = JSON.stringify(res.body.posts[0])
        assert.match(selected, /moderationHistory/)
        assert.equal(payload.includes(userA.toString()), false)
        assert.equal(payload.includes(userB.toString()), false)
        assert.equal(res.body.posts[0].moderationHistory[0].action, 'hidden')
    } finally {
        CampusVoice.find = originals.find
        CampusVoice.countDocuments = originals.countDocuments
    }
})

test('moderation records the trusted administrator action privately', async () => {
    const { moderateCampusVoice } = require('../services/campusVoiceModerationService')
    const originalFindById = CampusVoice.findById
    const post = {
        _id: userA,
        status: 'pending',
        moderationHistory: [],
        async save() { this.saved = true },
    }
    CampusVoice.findById = () => ({ select: async () => post })
    try {
        const moderated = await moderateCampusVoice(userA, 'active', userB, 'Reviewed for safety')
        assert.equal(moderated.status, 'active')
        assert.equal(moderated.saved, true)
        assert.deepEqual(moderated.moderationHistory[0], {
            action: 'approved',
            moderator: userB,
            note: 'Reviewed for safety',
        })
        const safe = controller.serializeAdminPost(moderated)
        assert.equal(safe.moderationHistory[0].moderator, undefined)
        assert.equal(safe.author, undefined)
    } finally {
        CampusVoice.findById = originalFindById
    }
})

test('confession moderation outcomes notify only the private author account', async () => {
    const { moderateCampusVoice } = require('../services/campusVoiceModerationService')
    const notifications = require('../services/notificationService')
    const originalFindById = CampusVoice.findById
    const originalNotify = notifications.createAndEmitNotification
    const post = {
        _id: userA,
        author: userA,
        category: 'confession',
        status: 'pending',
        moderationHistory: [],
        async save() { this.saved = true },
    }
    let notification
    CampusVoice.findById = () => ({ select: async () => post })
    notifications.createAndEmitNotification = async (data) => { notification = data }
    try {
        await moderateCampusVoice(userA, 'active', userB)
        assert.deepEqual(notification, {
            recipient: userA,
            type: 'system',
            title: 'Your confession was approved',
            message: 'Your anonymous confession is now visible in Campus Voices.',
        })
        assert.equal(JSON.stringify(notification).includes(post.content || 'private-author-data'), false)
    } finally {
        CampusVoice.findById = originalFindById
        notifications.createAndEmitNotification = originalNotify
    }
})

test('authenticated students cannot access administrator moderation routes', async () => {
    const jwt = require('jsonwebtoken')
    const originalFindById = User.findById
    const oldSecret = process.env.JWT_SECRET
    const oldAdminEmail = process.env.ADMIN_EMAIL
    const secret = 'campus-voice-test-secret-that-is-at-least-32-bytes'
    process.env.JWT_SECRET = secret
    process.env.ADMIN_EMAIL = 'admin@example.edu'
    User.findById = () => ({ select: async () => ({ _id: userA, email: 'student@example.edu', role: 'student', tokenVersion: 0 }) })
    try {
        const token = jwt.sign({ userId: userA.toString(), tokenVersion: 0 }, secret)
        const req = { headers: { authorization: 'Bearer ' + token } }
        const res = responseMock()
        let reachedRoute = false
        await adminMiddleware(req, res, () => { reachedRoute = true })
        assert.equal(res.statusCode, 403)
        assert.equal(reachedRoute, false)
    } finally {
        User.findById = originalFindById
        if (oldSecret === undefined) delete process.env.JWT_SECRET
        else process.env.JWT_SECRET = oldSecret
        if (oldAdminEmail === undefined) delete process.env.ADMIN_EMAIL
        else process.env.ADMIN_EMAIL = oldAdminEmail
    }
})

test('reporting supports threats and comments remain unavailable in the initial release', () => {
    assert.ok(Report.schema.path('reason').enumValues.includes('threats'))
    assert.ok(Report.schema.path('reason').enumValues.includes('bullying'))
    const routes = require('../routes/campusVoiceRoutes')
    assert.equal(routes.stack.some((layer) => layer.route?.path.includes('comments')), false)
})

test('students can submit a private safety report without exposing the confession author', async () => {
    const originals = {
        voiceExists: CampusVoice.exists,
        reportExists: Report.exists,
        reportCreate: Report.create,
    }
    let createdReport
    CampusVoice.exists = async () => true
    Report.exists = async () => false
    Report.create = async (document) => { createdReport = document; return { _id: userB, ...document } }
    try {
        const res = responseMock()
        await reportController.createReport({
            user: { _id: userB },
            body: { voicePostId: userA.toString(), reason: 'threats', description: 'A safety concern' },
        }, res, (error) => { throw error })
        assert.equal(res.statusCode, 201)
        assert.equal(createdReport.reporter.toString(), userB.toString())
        assert.equal(createdReport.voicePost.toString(), userA.toString())
        assert.equal(Object.hasOwn(createdReport, 'author'), false)
    } finally {
        CampusVoice.exists = originals.voiceExists
        Report.exists = originals.reportExists
        Report.create = originals.reportCreate
    }
})
