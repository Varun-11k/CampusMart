const mongoose = require('mongoose')
const CampusVoice = require('../models/CampusVoice')
const { moderateCampusVoice } = require('../services/campusVoiceModerationService')

const categories = ['confession', 'question', 'suggestion', 'experience', 'opinion']
const moderationStatuses = ['pending', 'active', 'hidden', 'rejected', 'removed']
const moderatorActionStatuses = ['active', 'hidden', 'rejected', 'removed']
const MIN_CONTENT_LENGTH = 10
const MAX_CONTENT_LENGTH = 3000

function serializePost(post, userId) {
    const data = typeof post.toObject === 'function' ? post.toObject() : { ...post }
    const likes = Array.isArray(data.likes) ? data.likes : []
    const authorId = data.author
    return {
        _id: data._id,
        content: data.content,
        category: data.category,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        isAnonymous: true,
        authorLabel: 'Anonymous Student',
        isMine: Boolean(userId && authorId && authorId.toString() === userId.toString()),
        likeCount: likes.length,
        likedByMe: Boolean(userId && likes.some((id) => id.toString() === userId.toString())),
    }
}

function serializePrivatePost(post, userId) {
    return {
        ...serializePost(post, userId),
        moderationStatus: post.status,
        deletedByAuthor: Boolean(post.authorDeletedAt),
    }
}

function serializeAdminPost(post) {
    const data = typeof post.toObject === 'function' ? post.toObject() : { ...post }
    return {
        _id: data._id,
        content: data.content,
        category: data.category,
        moderationStatus: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        moderationHistory: (data.moderationHistory || []).map((entry) => ({
            action: entry.action,
            note: entry.note || '',
            createdAt: entry.createdAt,
        })),
    }
}

function normalizeContent(content) {
    return content.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function containsPrivateContactInformation(content) {
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(content)) return true
    const phoneCandidates = content.match(/\+?\d[\d\s().-]{8,}\d/g) || []
    return phoneCandidates.some((candidate) => {
        const digitCount = candidate.replace(/\D/g, '').length
        return digitCount >= 10 && digitCount <= 15
    })
}

function validateBody(body, partial = false) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 'A JSON request body is required'
    const allowed = ['content', 'category']
    if (Object.keys(body).some((field) => !allowed.includes(field))) return 'Only content and category are accepted'
    if (!partial && (!Object.hasOwn(body, 'content') || !Object.hasOwn(body, 'category'))) return 'content and category are required'
    if (Object.hasOwn(body, 'content') && (typeof body.content !== 'string' || !body.content.trim())) return 'content must be a non-empty string'
    if (typeof body.content === 'string' && body.content.trim().length > MAX_CONTENT_LENGTH) return `content must be ${MAX_CONTENT_LENGTH} characters or fewer`
    if (Object.hasOwn(body, 'category') && !categories.includes(body.category)) return `category must be one of: ${categories.join(', ')}`
    if (partial && Object.keys(body).length === 0) return 'Provide content or category to update'
    if (typeof body.content === 'string' && body.content.trim().length < MIN_CONTENT_LENGTH) return 'content must be at least ' + MIN_CONTENT_LENGTH + ' characters'
    if (typeof body.content === 'string' && containsPrivateContactInformation(body.content)) return 'Remove email addresses and phone numbers before posting'
    return null
}

function buildQuery(query) {
    const filter = { status: 'active' }
    if (query.category) filter.category = query.category
    const search = typeof query.search === 'string' ? query.search.trim().slice(0, 200) : ''
    if (search) filter.$text = { $search: search }
    return filter
}

async function listPosts(req, res, next) {
    try {
        if (req.query.category && !categories.includes(req.query.category)) return res.status(400).json({ success: false, message: `category must be one of: ${categories.join(', ')}` })
        const sort = req.query.sort || 'recent'
        if (!['recent', 'most_liked'].includes(sort)) return res.status(400).json({ success: false, message: 'sort must be recent or most_liked' })
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10))
        const filter = buildQuery(req.query)
        const postsQuery = sort === 'most_liked' && !filter.$text
            ? CampusVoice.aggregate([{ $match: filter }, { $addFields: { _likesCount: { $size: { $ifNull: ['$likes', []] } } } }, { $sort: { _likesCount: -1, createdAt: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: { author: 0, likes: 0, status: 0, __v: 0 } }])
            : CampusVoice.find(filter).select('-author -likes -status -__v').sort(filter.$text ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()
        const [posts, total] = await Promise.all([
            postsQuery,
            CampusVoice.countDocuments(filter),
        ])
        const likeEntries = req.user && posts.length
            ? await CampusVoice.find({ _id: { $in: posts.map((post) => post._id) }, likes: req.user._id }).select('_id').lean()
            : []
        const likedIds = new Set(likeEntries.map((post) => post._id.toString()))
        const safePosts = posts.map((post) => {
            const { _likesCount, ...postWithoutCount } = post
            const publicPost = serializePost(postWithoutCount, null)
            return { ...publicPost, isMine: false, likeCount: Number.isInteger(_likesCount) ? _likesCount : undefined, likedByMe: likedIds.has(post._id.toString()) }
        })
        // Count likes without selecting or returning liker identities.
        const counts = posts.length && sort !== 'most_liked' ? await CampusVoice.aggregate([
            { $match: { _id: { $in: posts.map((post) => post._id) } } },
            { $project: { count: { $size: { $ifNull: ['$likes', []] } } } },
        ]) : []
        const countById = new Map(counts.map((item) => [item._id.toString(), item.count]))
        const serialized = safePosts.map((post) => ({ ...post, likeCount: Number.isInteger(post.likeCount) ? post.likeCount : countById.get(post._id.toString()) || 0 }))
        res.json({ success: true, posts: serialized, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) { next(error) }
}

async function createPost(req, res, next) {
    try {
        const validation = validateBody(req.body)
        if (validation) return res.status(400).json({ success: false, message: validation })
        const content = req.body.content.trim()
        if (req.body.category === 'confession') {
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
            const recentPosts = await CampusVoice.find({
                author: req.user._id,
                category: 'confession',
                createdAt: { $gte: since },
            }).select('content').sort({ createdAt: -1 }).limit(100).lean()
            if (recentPosts.some((post) => normalizeContent(post.content) === normalizeContent(content))) {
                return res.status(409).json({ success: false, message: 'You already shared this confession recently' })
            }
        }
        const post = await CampusVoice.create({
            author: req.user._id,
            content,
            category: req.body.category,
            isAnonymous: true,
            status: req.body.category === 'confession' ? 'pending' : 'active',
        })
        res.status(201).json({ success: true, post: serializePrivatePost(post, req.user._id) })
    } catch (error) { next(error) }
}

async function getPost(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const post = await CampusVoice.findById(req.params.id).select('+author +likes +authorDeletedAt').lean()
        if (!post || (post.status !== 'active' && post.author.toString() !== req.user?._id?.toString())) return res.status(404).json({ success: false, message: 'Post not found' })
        const isMine = post.author.toString() === req.user?._id?.toString()
        res.json({ success: true, post: isMine ? serializePrivatePost(post, req.user?._id) : serializePost(post, req.user?._id) })
    } catch (error) { next(error) }
}

async function updatePost(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const validation = validateBody(req.body, true)
        if (validation) return res.status(400).json({ success: false, message: validation })
        const post = await CampusVoice.findById(req.params.id).select('+author +authorDeletedAt')
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' })
        if (post.author.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only the post author can edit this post' })
        if (!['active', 'pending', 'hidden'].includes(post.status)) return res.status(409).json({ success: false, message: 'This post can no longer be edited' })
        if (post.category === 'confession' && req.body.category && req.body.category !== 'confession') {
            return res.status(400).json({ success: false, message: 'A confession cannot be changed to a different post category' })
        }
        if (Object.hasOwn(req.body, 'content')) post.content = req.body.content.trim()
        if (Object.hasOwn(req.body, 'category')) post.category = req.body.category
        const finalValidation = validateBody({ content: post.content, category: post.category })
        if (finalValidation) return res.status(400).json({ success: false, message: finalValidation })
        if (post.category === 'confession') post.status = 'pending'
        await post.save()
        res.json({ success: true, post: serializePrivatePost(post, req.user._id) })
    } catch (error) { next(error) }
}

async function deletePost(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const post = await CampusVoice.findById(req.params.id).select('+author +authorDeletedAt')
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' })
        if (post.author.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only the post author can delete this post' })
        if (post.status === 'removed') return res.status(409).json({ success: false, message: 'This post has already been removed' })
        if (post.category === 'confession') {
            post.status = 'removed'
            post.authorDeletedAt = new Date()
            await post.save()
        } else {
            await post.deleteOne()
        }
        res.json({ success: true, message: 'Post deleted' })
    } catch (error) { next(error) }
}

async function toggleLike(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const post = await CampusVoice.findOne({ _id: req.params.id, status: 'active' }).select('+likes')
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' })
        const userId = req.user._id
        const wasLiked = post.likes.some((id) => id.toString() === userId.toString())
        await CampusVoice.updateOne(
            { _id: post._id, status: 'active', likes: wasLiked ? userId : { $ne: userId } },
            wasLiked ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } }
        )
        const updated = await CampusVoice.findOne({ _id: post._id, status: 'active' }).select('+likes')
        if (!updated) return res.status(404).json({ success: false, message: 'Post not found' })
        res.json({ success: true, likeCount: updated.likes.length, likedByMe: updated.likes.some((id) => id.toString() === userId.toString()) })
    } catch (error) { next(error) }
}

async function myPosts(req, res, next) {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20))
        const filter = { author: req.user._id }
        const [posts, total] = await Promise.all([
            CampusVoice.find(filter).select('+status +authorDeletedAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            CampusVoice.countDocuments(filter),
        ])
        const counts = posts.length ? await CampusVoice.aggregate([
            { $match: { _id: { $in: posts.map((post) => post._id) } } },
            { $project: { count: { $size: { $ifNull: ['$likes', []] } }, likedByMe: { $in: [req.user._id, { $ifNull: ['$likes', []] }] } } },
        ]) : []
        const countById = new Map(counts.map((item) => [item._id.toString(), item.count]))
        const likedById = new Map(counts.map((item) => [item._id.toString(), item.likedByMe]))
        res.json({ success: true, posts: posts.map((post) => ({
            ...serializePrivatePost(post, req.user._id),
            isMine: true,
            likeCount: countById.get(post._id.toString()) || 0,
            likedByMe: Boolean(likedById.get(post._id.toString())),
        })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) { next(error) }
}

async function listAdminPosts(req, res, next) {
    try {
        if (req.query.status && !moderationStatuses.includes(req.query.status)) {
            return res.status(400).json({ success: false, message: 'status must be one of: ' + moderationStatuses.join(', ') })
        }
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20))
        const filter = { category: 'confession' }
        if (req.query.status) filter.status = req.query.status
        const [posts, total] = await Promise.all([
            CampusVoice.find(filter).select('+moderationHistory').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            CampusVoice.countDocuments(filter),
        ])
        res.json({ success: true, posts: posts.map(serializeAdminPost), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) { next(error) }
}

async function moderateAdminPost(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const body = req.body
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['status', 'note'].includes(key))) {
            return res.status(400).json({ success: false, message: 'Only status and note are accepted' })
        }
        if (!moderatorActionStatuses.includes(body.status)) return res.status(400).json({ success: false, message: 'status must be active, hidden, rejected, or removed' })
        if (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 1000)) return res.status(400).json({ success: false, message: 'note must be a string of at most 1000 characters' })
        const confession = await CampusVoice.exists({ _id: req.params.id, category: 'confession' })
        if (!confession) return res.status(404).json({ success: false, message: 'Confession not found' })
        const post = await moderateCampusVoice(req.params.id, body.status, req.user._id, (body.note || '').trim())
        if (!post) return res.status(404).json({ success: false, message: 'Confession not found' })
        res.json({ success: true, post: serializeAdminPost(post) })
    } catch (error) { next(error) }
}

module.exports = {
    listPosts, createPost, getPost, updatePost, deletePost, toggleLike, myPosts,
    listAdminPosts, moderateAdminPost, validateBody, serializePost, serializePrivatePost,
    serializeAdminPost, categories, moderationStatuses, MIN_CONTENT_LENGTH, MAX_CONTENT_LENGTH,
}
