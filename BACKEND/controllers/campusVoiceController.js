const mongoose = require('mongoose')
const CampusVoice = require('../models/CampusVoice')

const categories = ['confession', 'question', 'suggestion', 'experience', 'opinion']
const MAX_CONTENT_LENGTH = 3000

function serializePost(post, userId) {
    const data = typeof post.toObject === 'function' ? post.toObject() : { ...post }
    const likes = Array.isArray(data.likes) ? data.likes : []
    const authorId = data.author
    delete data.author
    delete data.likes
    delete data.__v
    return {
        ...data,
        isAnonymous: true,
        authorLabel: 'Anonymous Student',
        isMine: Boolean(userId && authorId && authorId.toString() === userId.toString()),
        likeCount: likes.length,
        likedByMe: Boolean(userId && likes.some((id) => id.toString() === userId.toString())),
    }
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
            ? CampusVoice.aggregate([{ $match: filter }, { $addFields: { _likesCount: { $size: { $ifNull: ['$likes', []] } } } }, { $sort: { _likesCount: -1, createdAt: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: { author: 0, likes: 0, __v: 0 } }])
            : CampusVoice.find(filter).select('-author -likes -__v').sort(filter.$text ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()
        const [posts, total] = await Promise.all([
            postsQuery,
            CampusVoice.countDocuments(filter),
        ])
        const likeEntries = req.user && posts.length
            ? await CampusVoice.find({ _id: { $in: posts.map((post) => post._id) }, likes: req.user._id }).select('_id').lean()
            : []
        const likedIds = new Set(likeEntries.map((post) => post._id.toString()))
        const safePosts = posts.map((post) => {
            const { _likesCount, ...publicPost } = post
            return { ...publicPost, isAnonymous: true, authorLabel: 'Anonymous Student', isMine: false, likeCount: Number.isInteger(_likesCount) ? _likesCount : undefined, likedByMe: likedIds.has(post._id.toString()) }
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
        const post = await CampusVoice.create({
            author: req.user._id,
            content: req.body.content.trim(),
            category: req.body.category,
            isAnonymous: true,
        })
        res.status(201).json({ success: true, post: serializePost(post, req.user._id) })
    } catch (error) { next(error) }
}

async function getPost(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const post = await CampusVoice.findById(req.params.id).select('+likes').lean()
        if (!post || (post.status !== 'active' && post.author.toString() !== req.user?._id?.toString())) return res.status(404).json({ success: false, message: 'Post not found' })
        res.json({ success: true, post: serializePost(post, req.user?._id) })
    } catch (error) { next(error) }
}

async function updatePost(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const validation = validateBody(req.body, true)
        if (validation) return res.status(400).json({ success: false, message: validation })
        const post = await CampusVoice.findById(req.params.id)
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' })
        if (post.author.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only the post author can edit this post' })
        if (post.status !== 'active') return res.status(409).json({ success: false, message: 'Only active posts can be edited' })
        if (Object.hasOwn(req.body, 'content')) post.content = req.body.content.trim()
        if (Object.hasOwn(req.body, 'category')) post.category = req.body.category
        await post.save()
        res.json({ success: true, post: serializePost(post, req.user._id) })
    } catch (error) { next(error) }
}

async function deletePost(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const post = await CampusVoice.findById(req.params.id)
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' })
        if (post.author.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only the post author can delete this post' })
        await post.deleteOne()
        res.json({ success: true, message: 'Post deleted' })
    } catch (error) { next(error) }
}

async function toggleLike(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const post = await CampusVoice.findOne({ _id: req.params.id, status: 'active' }).select('likes')
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' })
        const userId = req.user._id
        const wasLiked = post.likes.some((id) => id.toString() === userId.toString())
        await CampusVoice.updateOne(
            { _id: post._id, status: 'active', likes: wasLiked ? userId : { $ne: userId } },
            wasLiked ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } }
        )
        const updated = await CampusVoice.findOne({ _id: post._id, status: 'active' }).select('likes')
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
            CampusVoice.find(filter).select('-author -likes -__v').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            CampusVoice.countDocuments(filter),
        ])
        const counts = posts.length ? await CampusVoice.aggregate([
            { $match: { _id: { $in: posts.map((post) => post._id) } } },
            { $project: { count: { $size: { $ifNull: ['$likes', []] } }, likedByMe: { $in: [req.user._id, { $ifNull: ['$likes', []] }] } } },
        ]) : []
        const countById = new Map(counts.map((item) => [item._id.toString(), item.count]))
        const likedById = new Map(counts.map((item) => [item._id.toString(), item.likedByMe]))
        res.json({ success: true, posts: posts.map((post) => ({ ...post, isAnonymous: true, authorLabel: 'Anonymous Student', isMine: true, likeCount: countById.get(post._id.toString()) || 0, likedByMe: Boolean(likedById.get(post._id.toString())) })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) { next(error) }
}

module.exports = { listPosts, createPost, getPost, updatePost, deletePost, toggleLike, myPosts, validateBody, serializePost, categories, MAX_CONTENT_LENGTH }
