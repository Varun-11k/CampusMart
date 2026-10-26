const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const CampusFeedPost = require('../models/CampusFeedPost')
const CampusPoll = require('../models/CampusPoll')
const feedController = require('../controllers/campusFeedController')
const engagementController = require('../controllers/engagementController')
const adminMiddleware = require('../middleware/adminMiddleware')

function responseStub() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this },
        json(body) { this.body = body; return this },
    }
}

test('admin authorization requires both the trusted role and configured email', () => {
    const originalEmail = process.env.ADMIN_EMAIL
    process.env.ADMIN_EMAIL = 'admin@example.edu'
    try {
        assert.equal(adminMiddleware.isAuthorizedAdmin({ role: 'admin', email: ' ADMIN@example.edu ' }), true)
        assert.equal(adminMiddleware.isAuthorizedAdmin({ role: 'admin', email: 'other@example.edu' }), false)
        assert.equal(adminMiddleware.isAuthorizedAdmin({ role: 'student', email: 'admin@example.edu' }), false)
    } finally {
        if (originalEmail === undefined) delete process.env.ADMIN_EMAIL
        else process.env.ADMIN_EMAIL = originalEmail
    }
})

test('a role-only account cannot delete another student post or close their poll', async () => {
    const originalEmail = process.env.ADMIN_EMAIL
    const originalFindPost = CampusFeedPost.findById
    const originalFindPoll = CampusPoll.findById
    const owner = new mongoose.Types.ObjectId()
    const actor = new mongoose.Types.ObjectId()
    const postId = new mongoose.Types.ObjectId()
    const pollId = new mongoose.Types.ObjectId()
    let postSaved = false
    let pollSaved = false
    const post = { _id: postId, author: owner, status: 'active', async save() { postSaved = true } }
    const poll = { _id: pollId, author: owner, status: 'active', async save() { pollSaved = true } }
    process.env.ADMIN_EMAIL = 'admin@example.edu'
    CampusFeedPost.findById = async () => post
    CampusPoll.findById = async () => poll
    try {
        const user = { _id: actor, role: 'admin', email: 'not-admin@example.edu' }
        const postRes = responseStub()
        await feedController.deletePost({ params: { id: postId.toString() }, user }, postRes, (error) => { throw error })
        assert.equal(postRes.statusCode, 403)
        assert.equal(postSaved, false)

        const pollRes = responseStub()
        await engagementController.closePoll({ params: { id: pollId.toString() }, user }, pollRes, (error) => { throw error })
        assert.equal(pollRes.statusCode, 403)
        assert.equal(pollSaved, false)
    } finally {
        CampusFeedPost.findById = originalFindPost
        CampusPoll.findById = originalFindPoll
        if (originalEmail === undefined) delete process.env.ADMIN_EMAIL
        else process.env.ADMIN_EMAIL = originalEmail
    }
})
