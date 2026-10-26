const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const CampusFeedPost = require('../models/CampusFeedPost')
const CampusFeedComment = require('../models/CampusFeedComment')
const controller = require('../controllers/campusFeedController')

function responseStub() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this },
        json(body) { this.body = body; return this },
    }
}

test('anonymous feed reads are scoped to public posts and comments', async () => {
    const originals = {
        find: CampusFeedPost.find,
        findOne: CampusFeedPost.findOne,
        countDocuments: CampusFeedPost.countDocuments,
        aggregate: CampusFeedPost.aggregate,
        commentFind: CampusFeedComment.find,
    }
    const postId = new mongoose.Types.ObjectId()
    const authorId = new mongoose.Types.ObjectId()
    const publicPost = {
        _id: postId,
        author: { _id: authorId, name: 'Student', college: 'Campus' },
        content: 'Public update',
        postType: 'text',
        category: 'general',
        visibility: 'public',
        media: [],
        likes: [],
        saves: [],
        createdAt: new Date(),
    }
    let findCount = 0
    let listFilter
    let detailFilter
    let commentsFilter
    let countFilter
    let trendPipeline
    let queriedComments = false

    CampusFeedPost.find = (filter) => {
        if (findCount++ === 0) {
            listFilter = filter
            return {
                populate() { return this },
                sort() { return this },
                skip() { return this },
                limit() { return this },
                lean: async () => [publicPost],
            }
        }
        return {
            select() { return this },
            lean: async () => [publicPost],
        }
    }
    CampusFeedPost.countDocuments = async (filter) => { countFilter = filter; return 1 }
    CampusFeedPost.findOne = (filter) => {
        if (!detailFilter) {
            detailFilter = filter
            return { populate() { return this }, select: async () => null }
        }
        commentsFilter = filter
        return { select() { return this }, lean: async () => null }
    }
    CampusFeedPost.aggregate = async (pipeline) => { trendPipeline = pipeline; return [] }
    CampusFeedComment.find = () => { queriedComments = true; return [] }

    try {
        const listRes = responseStub()
        await controller.listPosts({ query: {}, user: null }, listRes, (error) => { throw error })
        assert.equal(listRes.statusCode, 200)
        assert.equal(listRes.body.posts.length, 1)
        assert.equal(listFilter.visibility, 'public')
        assert.equal(countFilter.visibility, 'public')

        const detailRes = responseStub()
        await controller.getPost({ params: { id: postId.toString() }, user: null }, detailRes, (error) => { throw error })
        assert.equal(detailRes.statusCode, 404)
        assert.equal(detailFilter.visibility, 'public')

        const commentsRes = responseStub()
        await controller.listComments({ params: { id: postId.toString() }, query: {}, user: null }, commentsRes, (error) => { throw error })
        assert.equal(commentsRes.statusCode, 404)
        assert.equal(commentsFilter.visibility, 'public')
        assert.equal(queriedComments, false)

        await controller.trendingHashtags({}, responseStub(), (error) => { throw error })
        assert.deepEqual(trendPipeline[0].$match, { status: 'active', visibility: 'public' })
    } finally {
        CampusFeedPost.find = originals.find
        CampusFeedPost.findOne = originals.findOne
        CampusFeedPost.countDocuments = originals.countDocuments
        CampusFeedPost.aggregate = originals.aggregate
        CampusFeedComment.find = originals.commentFind
    }
})

test('authenticated campus feed reads can include campus-only posts', async () => {
    const originalFind = CampusFeedPost.find
    const originalCount = CampusFeedPost.countDocuments
    const userId = new mongoose.Types.ObjectId()
    let filter
    CampusFeedPost.find = (query) => {
        filter = query
        return {
            populate() { return this },
            sort() { return this },
            skip() { return this },
            limit() { return this },
            lean: async () => [],
        }
    }
    CampusFeedPost.countDocuments = async () => 0
    try {
        const res = responseStub()
        await controller.listPosts({ query: {}, user: { _id: userId } }, res, (error) => { throw error })
        assert.equal(res.statusCode, 200)
        assert.equal(filter.status, 'active')
        assert.equal(Object.hasOwn(filter, 'visibility'), false)
    } finally {
        CampusFeedPost.find = originalFind
        CampusFeedPost.countDocuments = originalCount
    }
})
