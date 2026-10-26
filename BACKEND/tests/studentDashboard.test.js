const test = require('node:test')
const assert = require('node:assert/strict')
const User = require('../models/User')
const Product = require('../models/Product')
const LostFoundReport = require('../models/LostFoundReport')
const LostFoundClaim = require('../models/LostFoundClaim')
const CampusVoice = require('../models/CampusVoice')
const authController = require('../controllers/authController')
const { getStudentDashboard } = require('../controllers/studentDashboardController')
const campusVoiceController = require('../controllers/campusVoiceController')

function responseStub() {
    return {
        statusCode: 200,
        status(code) { this.statusCode = code; return this },
        json(body) { this.body = body; return this },
    }
}

test('a student can edit only their own optional profile fields', async () => {
    const studentA = {
        _id: 'student-a',
        name: 'Student A',
        email: 'student-a@example.edu',
        college: 'Example College',
        role: 'student',
        isVerified: false,
        tokenVersion: 2,
        save: async () => {},
    }
    const studentB = { _id: 'student-b', name: 'Student B' }
    const req = {
        user: studentA,
        body: {
            name: 'Updated Student',
            college: '',
            course: 'Engineering',
            branch: 'Computer Science',
            academicYear: '2',
            themePreference: 'dark',
        },
    }
    const res = responseStub()
    let nextError

    await authController.updateProfile(req, res, (error) => { nextError = error })

    assert.equal(nextError, undefined)
    assert.equal(res.statusCode, 200)
    assert.equal(studentA.name, 'Updated Student')
    assert.equal(studentA.college, '')
    assert.equal(studentA.course, 'Engineering')
    assert.equal(studentA.branch, 'Computer Science')
    assert.equal(studentA.academicYear, '2')
    assert.equal(studentA.themePreference, 'dark')
    assert.equal(studentA.role, 'student')
    assert.equal(studentA.isVerified, false)
    assert.equal(studentA.tokenVersion, 2)
    assert.equal(studentB.name, 'Student B')
    assert.equal(res.body.user.email, studentA.email)
    assert.equal(Object.hasOwn(res.body.user, 'googleId'), false)
})

test('profile updates reject identity, role, verification, and moderation fields', async () => {
    const user = {
        _id: 'student-a',
        name: 'Student A',
        college: '',
        role: 'student',
        isVerified: false,
        save: async () => assert.fail('invalid profile update must not be saved'),
    }

    for (const body of [
        { role: 'admin' },
        { isVerified: true },
        { googleId: 'attacker-controlled-id' },
        { userId: 'student-b', name: 'Changed' },
        { moderationStatus: 'approved' },
    ]) {
        const res = responseStub()
        await authController.updateProfile({ user, body }, res, (error) => { throw error })
        assert.equal(res.statusCode, 400)
        assert.equal(user.role, 'student')
        assert.equal(user.isVerified, false)
    }
})

test('profile images require a size-bounded supported type and matching image signature', () => {
    assert.equal(authController.validateProfileImage({
        mimetype: 'image/jpeg',
        size: 4,
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    }), null)
    assert.match(authController.validateProfileImage({
        mimetype: 'image/png',
        size: 4,
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    }), /valid JPG, PNG, or WEBP/)
    assert.match(authController.validateProfileImage({
        mimetype: 'image/jpeg',
        size: authController.MAX_PROFILE_IMAGE_BYTES + 1,
        buffer: Buffer.from([0xff, 0xd8, 0xff]),
    }), /3MB or smaller/)
    assert.match(authController.validateProfileImage({
        mimetype: 'image/svg+xml',
        size: 4,
        buffer: Buffer.from('<svg/>'),
    }), /valid JPG, PNG, or WEBP/)
})

test('private dashboard queries are bound to the authenticated user and omit confession identifiers', async () => {
    const models = [Product, LostFoundReport, LostFoundClaim, CampusVoice]
    const originals = models.map((model) => ({
        model,
        find: model.find,
        countDocuments: model.countDocuments,
    }))
    const filters = []
    const privatePost = {
        _id: 'post-id',
        author: 'student-a',
        content: 'A private activity entry',
        likes: ['student-b'],
        __v: 4,
        status: 'active',
    }
    const dataByModel = new Map([
        [Product, [{ _id: 'product-id', title: 'Notebook' }]],
        [LostFoundReport, [{ _id: 'report-id', title: 'Lost keys' }]],
        [LostFoundClaim, [{ _id: 'claim-id', report: { title: 'Found keys' }, message: 'They are mine', status: 'pending' }]],
        [CampusVoice, [privatePost]],
    ])
    const req = { user: { _id: 'student-a' }, query: { userId: 'student-b' } }
    const res = responseStub()
    let nextError

    for (const model of models) {
        model.find = (filter) => {
            filters.push({ model, filter })
            const result = dataByModel.get(model)
            const query = {
                select() { return query },
                populate() { return query },
                sort() { return query },
                limit() { return query },
                lean: async () => result,
            }
            return query
        }
        model.countDocuments = async (filter) => {
            filters.push({ model, filter })
            return 1
        }
    }

    try {
        await getStudentDashboard(req, res, (error) => { nextError = error })
        assert.equal(nextError, undefined)
        assert.equal(res.statusCode, 200)
        assert.equal(filters.length, 8)
        assert.deepEqual(filters.filter(({ model }) => model === Product).map(({ filter }) => filter), [
            { seller: 'student-a' },
            { seller: 'student-a' },
        ])
        assert.deepEqual(filters.filter(({ model }) => model === LostFoundReport).map(({ filter }) => filter), [
            { reportedBy: 'student-a' },
            { reportedBy: 'student-a' },
        ])
        assert.deepEqual(filters.filter(({ model }) => model === LostFoundClaim).map(({ filter }) => filter), [
            { claimant: 'student-a' },
            { claimant: 'student-a' },
        ])
        assert.deepEqual(filters.filter(({ model }) => model === CampusVoice).map(({ filter }) => filter), [
            { author: 'student-a' },
            { author: 'student-a' },
        ])
        const [confession] = res.body.activity.confessions
        assert.equal(confession.isMine, true)
        assert.equal(confession.isAnonymous, true)
        assert.equal(Object.hasOwn(confession, 'author'), false)
        assert.equal(Object.hasOwn(confession, 'likes'), false)
        assert.equal(Object.hasOwn(confession, '__v'), false)
        assert.equal(Object.hasOwn(confession, 'status'), false)
    } finally {
        for (const { model, find, countDocuments } of originals) {
            model.find = find
            model.countDocuments = countDocuments
        }
    }
})

test('student dashboard endpoint rejects unauthenticated requests even with a supplied user ID', async () => {
    const app = require('../app')
    const server = await new Promise((resolve) => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
    })
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/dashboard?userId=student-b`)
        assert.equal(response.status, 401)
        assert.equal((await response.json()).message, 'Authentication required')
    } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
})

test('student academic and theme fields default privately and use bounded values', async () => {
    assert.equal(User.schema.path('course').options.default, '')
    assert.equal(User.schema.path('branch').options.default, '')
    assert.equal(User.schema.path('academicYear').options.default, '')
    assert.equal(User.schema.path('themePreference').options.default, 'light')
    assert.deepEqual(authController.validateProfileUpdate({ themePreference: 'system' }).themePreference, 'Choose light or dark mode.')
    assert.deepEqual(authController.validateProfileUpdate({ course: 'x'.repeat(121) }).course, 'Use no more than 120 characters.')
})

test('public anonymous confession serialization never exposes the author or liker IDs', () => {
    const post = campusVoiceController.serializePost({
        _id: 'post-id',
        author: 'private-author-id',
        likes: ['private-liker-id'],
        content: 'A campus confession',
        category: 'confession',
    }, null)

    assert.equal(post.authorLabel, 'Anonymous Student')
    assert.equal(post.isAnonymous, true)
    assert.equal(Object.hasOwn(post, 'author'), false)
    assert.equal(Object.hasOwn(post, 'likes'), false)
    assert.equal(JSON.stringify(post).includes('private-author-id'), false)
    assert.equal(JSON.stringify(post).includes('private-liker-id'), false)
})
