const mongoose = require('mongoose')
const CampusFeedPost = require('../models/CampusFeedPost')
const CampusFeedComment = require('../models/CampusFeedComment')
const CampusFeedFollow = require('../models/CampusFeedFollow')
const User = require('../models/User')
const Report = require('../models/Report')
const cloudinary = require('../config/cloudinary')
const { createAndEmitNotification } = require('../services/notificationService')
const { isAuthorizedAdmin } = require('../middleware/adminMiddleware')

const MAX_MEDIA = 6
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_VIDEO_BYTES = 40 * 1024 * 1024
const MAX_CONTENT = 3000
const MAX_COMMENT = 1000

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const allowedVideoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime'])

const imageSignatures = {
    'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    'image/png': (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/webp': (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
    'image/gif': (buffer) => buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6)),
}

function validateMediaFile(file) {
    if (!file) return null
    const isImage = allowedImageTypes.has(file.mimetype)
    const isVideo = allowedVideoTypes.has(file.mimetype)
    if (!isImage && !isVideo) return 'Only JPG, PNG, WEBP, GIF images and MP4, WEBM, MOV videos are allowed.'
    const limit = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES
    if (file.size > limit) return `Each ${isImage ? 'image' : 'video'} must be ${Math.round(limit / (1024 * 1024))}MB or smaller.`
    if (isImage && file.buffer && !imageSignatures[file.mimetype]?.(file.buffer)) return 'The uploaded image contents do not match a supported format.'
    return null
}

async function uploadMediaFiles(files) {
    const validated = (files || []).map((file) => {
        const error = validateMediaFile(file)
        if (error) throw Object.assign(new Error(error), { statusCode: 400 })
        return file
    })
    return Promise.all(validated.map((file) => new Promise((resolve, reject) => {
        const isVideo = allowedVideoTypes.has(file.mimetype)
        const stream = cloudinary.uploader.upload_stream({
            folder: 'campusmart/feed',
            resource_type: isVideo ? 'video' : 'image',
        }, (error, result) => {
            if (error) return reject(error)
            resolve({
                url: result.secure_url,
                publicId: result.public_id,
                type: isVideo ? 'video' : 'image',
                width: result.width || 0,
                height: result.height || 0,
                duration: result.duration || 0,
            })
        })
        stream.end(file.buffer)
    })))
}

function parseJsonField(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback
    if (typeof value !== 'string') return value
    try { return JSON.parse(value) } catch { return fallback }
}

const allowedPostCategories = ['general', 'update', 'meme', 'food', 'sports', 'study', 'event', 'club', 'marketplace', 'lostfound', 'question']
const allowedPostTypes = ['text', 'photo', 'video', 'poll', 'reel']
const allowedVisibilities = ['campus', 'public']

function parsePollInput(value) {
    if (value === undefined || value === null || value === '') return null
    if (typeof value === 'string') {
        try { return JSON.parse(value) } catch { return undefined }
    }
    if (typeof value === 'object' && !Array.isArray(value)) return value
    return undefined
}

function validateBody(body, partial = false) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 'A JSON or multipart request body is required'
    const allowed = ['content', 'category', 'hashtags', 'campusTag', 'visibility', 'postType', 'poll']
    if (Object.keys(body).some((field) => !allowed.includes(field))) {
        return 'Only content, category, hashtags, campusTag, visibility, postType, and poll are accepted; request contains unsupported fields'
    }
    if (partial && Object.keys(body).length === 0) return 'Provide at least one field to update'
    if (Object.hasOwn(body, 'content')) {
        if (typeof body.content !== 'string') return 'content must be a string'
        if (body.content.length > MAX_CONTENT) return `content must be ${MAX_CONTENT} characters or fewer`
    }
    if (Object.hasOwn(body, 'category') && !allowedPostCategories.includes(body.category)) {
        return `category must be one of: ${allowedPostCategories.join(', ')}`
    }
    if (Object.hasOwn(body, 'campusTag')) {
        if (typeof body.campusTag !== 'string') return 'campusTag must be a string'
        if (body.campusTag.length > 120) return 'campusTag must be 120 characters or fewer'
    }
    if (Object.hasOwn(body, 'visibility') && !allowedVisibilities.includes(body.visibility)) {
        return 'visibility must be campus or public'
    }
    if (Object.hasOwn(body, 'postType') && !allowedPostTypes.includes(body.postType)) {
        return `postType must be one of: ${allowedPostTypes.join(', ')}`
    }
    if (Object.hasOwn(body, 'hashtags')) {
        const value = body.hashtags
        if (typeof value !== 'string' && !Array.isArray(value)) return 'hashtags must be an array or string'
    }
    if (Object.hasOwn(body, 'poll') && body.poll !== null) {
        const poll = parsePollInput(body.poll)
        if (poll === undefined) return 'poll must be a JSON object'
        if (typeof poll !== 'object' || Array.isArray(poll)) return 'poll must be an object'
        if (poll.question !== undefined && (typeof poll.question !== 'string' || poll.question.length > 300)) {
            return 'poll question must be a string of at most 300 characters'
        }
        if (poll.options !== undefined) {
            if (!Array.isArray(poll.options) || poll.options.length < 2 || poll.options.length > 6 || poll.options.some((option) => typeof option !== 'string' || !option.trim())) {
                return 'poll options must contain 2 to 6 non-empty strings'
            }
        }
        if (poll.expiresAt !== undefined && poll.expiresAt !== null) {
            const date = new Date(poll.expiresAt)
            if (Number.isNaN(date.getTime())) return 'poll expiresAt must be a valid date'
        }
    }
    return null
}


function normalizeHashtags(input) {
    const raw = Array.isArray(input) ? input : (typeof input === 'string' ? input.split(/[\s,]+/) : [])
    return [...new Set(raw.map((tag) => String(tag).trim().replace(/^#/, '').toLowerCase()).filter(Boolean).slice(0, 20))]
}

function serializePost(post, userId) {
    const data = typeof post.toObject === 'function' ? post.toObject() : { ...post }
    const likes = Array.isArray(data.likes) ? data.likes : []
    const saves = Array.isArray(data.saves) ? data.saves : []
    const author = data.author && typeof data.author === 'object' ? data.author : null
    return {
        _id: data._id,
        content: data.content || '',
        postType: data.postType || 'text',
        category: data.category || 'general',
        hashtags: data.hashtags || [],
        campusTag: data.campusTag || '',
        visibility: data.visibility || 'campus',
        media: data.media || [],
        poll: data.poll ? {
            question: data.poll.question || '',
            options: (data.poll.options || []).map((option) => ({
                _id: option._id,
                text: option.text,
                votes: Array.isArray(option.votes) ? option.votes.length : 0,
                votedByMe: Boolean(userId && Array.isArray(option.votes) && option.votes.some((id) => id.toString() === userId.toString())),
            })),
            expiresAt: data.poll.expiresAt || null,
        } : null,
        author: author ? {
            _id: author._id,
            name: author.name,
            college: author.college,
            profileImage: author.profileImage,
        } : data.author,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        likeCount: likes.length,
        likedByMe: Boolean(userId && likes.some((id) => id.toString() === userId.toString())),
        savedByMe: Boolean(userId && saves.some((id) => id.toString() === userId.toString())),
        saveCount: saves.length,
        commentCount: data.commentCount || 0,
        isMine: Boolean(userId && data.author && (data.author._id || data.author).toString() === userId.toString()),
    }
}
async function followUser(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ success: false, message: 'Invalid user ID' })
        if (req.params.userId === req.user._id.toString()) return res.status(400).json({ success: false, message: 'You cannot follow yourself' })
        const target = await User.findById(req.params.userId).select('_id name')
        if (!target) return res.status(404).json({ success: false, message: 'User not found' })
        await CampusFeedFollow.updateOne({ follower: req.user._id, following: target._id }, { $setOnInsert: { follower: req.user._id, following: target._id } }, { upsert: true })
        try { await createAndEmitNotification({ recipient: target._id, type: 'system', title: 'New follower', message: `${req.user.name} started following you.` }) } catch {}
        res.json({ success: true, following: true })
    } catch (error) { next(error) }
}

async function unfollowUser(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ success: false, message: 'Invalid user ID' })
        await CampusFeedFollow.deleteOne({ follower: req.user._id, following: req.params.userId })
        res.json({ success: true, following: false })
    } catch (error) { next(error) }
}

async function savedPosts(req, res, next) {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 15))
        const posts = await CampusFeedPost.find({ status: 'active', saves: req.user._id }).populate('author', 'name college profileImage').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('+likes +saves')
        const total = await CampusFeedPost.countDocuments({ status: 'active', saves: req.user._id })
        res.json({ success: true, posts: posts.map((post) => serializePost(post, req.user._id)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) { next(error) }
}

async function myPosts(req, res, next) {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 15))
        const posts = await CampusFeedPost.find({ author: req.user._id, status: { $ne: 'removed' } }).populate('author', 'name college profileImage').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('+likes +saves')
        const total = await CampusFeedPost.countDocuments({ author: req.user._id, status: { $ne: 'removed' } })
        res.json({ success: true, posts: posts.map((post) => serializePost(post, req.user._id)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) { next(error) }
}

async function trendingHashtags(req, res, next) {
    try {
        const result = await CampusFeedPost.aggregate([
            { $match: { status: 'active', visibility: 'public' } },
            { $unwind: '$hashtags' },
            { $group: { _id: '$hashtags', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 15 },
        ])
        res.json({ success: true, hashtags: result.map((item) => ({ tag: item._id, count: item.count })) })
    } catch (error) { next(error) }
}

async function reportPost(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const post = await CampusFeedPost.findById(req.params.id)
        if (!post || post.status !== 'active') return res.status(404).json({ success: false, message: 'Post not found' })
        const reason = req.body?.reason
        const allowedReasons = ['spam', 'harassment', 'inappropriate_content', 'scam', 'personal_information', 'other']
        if (!allowedReasons.includes(reason)) return res.status(400).json({ success: false, message: 'Invalid report reason' })
        const existing = await Report.findOne({ reporter: req.user._id, campusFeedPost: post._id, status: { $in: ['pending', 'reviewing'] } })
        if (existing) return res.status(409).json({ success: false, message: 'You already reported this post' })
        await Report.create({ reporter: req.user._id, campusFeedPost: post._id, reason, description: String(req.body?.description || '').trim().slice(0, 1000) })
        res.status(201).json({ success: true, message: 'Report submitted' })
    } catch (error) { next(error) }
}

async function reportComment(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.commentId)) return res.status(400).json({ success: false, message: 'Invalid comment ID' })
        const comment = await CampusFeedComment.findById(req.params.commentId)
        if (!comment || comment.status !== 'active') return res.status(404).json({ success: false, message: 'Comment not found' })
        const reason = req.body?.reason
        const allowedReasons = ['spam', 'harassment', 'inappropriate_content', 'scam', 'personal_information', 'other']
        if (!allowedReasons.includes(reason)) return res.status(400).json({ success: false, message: 'Invalid report reason' })
        const existing = await Report.findOne({ reporter: req.user._id, campusFeedComment: comment._id, status: { $in: ['pending', 'reviewing'] } })
        if (existing) return res.status(409).json({ success: false, message: 'You already reported this comment' })
        await Report.create({ reporter: req.user._id, campusFeedComment: comment._id, reason, description: String(req.body?.description || '').trim().slice(0, 1000) })
        res.status(201).json({ success: true, message: 'Report submitted' })
    } catch (error) { next(error) }
}
async function listComments(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const postFilter = { _id: req.params.id, status: 'active' }
        if (!req.user) postFilter.visibility = 'public'
        const post = await CampusFeedPost.findOne(postFilter).select('_id').lean()
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' })
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 30))
        const comments = await CampusFeedComment.find({ post: req.params.id, status: 'active' }).populate('author', 'name college profileImage').sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit).select('+likes')
        const total = await CampusFeedComment.countDocuments({ post: req.params.id, status: 'active' })
        res.json({ success: true, comments: comments.map((comment) => serializeComment(comment, req.user?._id)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) { next(error) }
}

async function createComment(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const post = await CampusFeedPost.findById(req.params.id)
        if (!post || post.status !== 'active') return res.status(404).json({ success: false, message: 'Post not found' })
        const content = String(req.body?.content || '').trim()
        if (!content) return res.status(400).json({ success: false, message: 'Comment cannot be empty' })
        if (content.length > MAX_COMMENT) return res.status(400).json({ success: false, message: `Comment must be ${MAX_COMMENT} characters or fewer` })
        const parentComment = req.body?.parentComment && mongoose.isValidObjectId(req.body.parentComment) ? req.body.parentComment : null
        const comment = await CampusFeedComment.create({
            post: post._id,
            author: req.user._id,
            parentComment,
            content,
        })
        post.commentCount = (post.commentCount || 0) + 1
        await post.save()
        const populated = await CampusFeedComment.findById(comment._id).populate('author', 'name college profileImage').select('+likes')
        if (post.author.toString() !== req.user._id.toString()) {
            try { await createAndEmitNotification({ recipient: post.author, type: 'system', title: 'New comment', message: `${req.user.name} commented on your post.` }) } catch {}
        }
        res.status(201).json({ success: true, comment: serializeComment(populated, req.user._id) })
    } catch (error) { next(error) }
}

async function deleteComment(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.commentId)) return res.status(400).json({ success: false, message: 'Invalid comment ID' })
        const comment = await CampusFeedComment.findById(req.params.commentId)
        if (!comment || comment.status !== 'active') return res.status(404).json({ success: false, message: 'Comment not found' })
        if (comment.author.toString() !== req.user._id.toString() && !isAuthorizedAdmin(req.user)) return res.status(403).json({ success: false, message: 'You can only delete your own comments' })
        comment.status = 'removed'
        await comment.save()
        await CampusFeedPost.updateOne({ _id: comment.post }, { $inc: { commentCount: -1 } })
        res.json({ success: true, message: 'Comment deleted' })
    } catch (error) { next(error) }
}

async function toggleCommentLike(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.commentId)) return res.status(400).json({ success: false, message: 'Invalid comment ID' })
        const comment = await CampusFeedComment.findById(req.params.commentId).select('+likes')
        if (!comment || comment.status !== 'active') return res.status(404).json({ success: false, message: 'Comment not found' })
        const userId = req.user._id.toString()
        const index = comment.likes.findIndex((id) => id.toString() === userId)
        if (index >= 0) comment.likes.splice(index, 1)
        else comment.likes.push(req.user._id)
        await comment.save()
        res.json({ success: true, likeCount: comment.likes.length, likedByMe: index < 0 })
    } catch (error) { next(error) }
}
async function toggleLike(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const post = await CampusFeedPost.findById(req.params.id).select('+likes')
        if (!post || post.status !== 'active') return res.status(404).json({ success: false, message: 'Post not found' })
        const userId = req.user._id.toString()
        const index = post.likes.findIndex((id) => id.toString() === userId)
        if (index >= 0) post.likes.splice(index, 1)
        else post.likes.push(req.user._id)
        await post.save()
        if (index < 0 && post.author.toString() !== userId) {
            try { await createAndEmitNotification({ recipient: post.author, type: 'system', title: 'New like', message: `${req.user.name} liked your post.`, }) } catch {}
        }
        res.json({ success: true, likeCount: post.likes.length, likedByMe: index < 0 })
    } catch (error) { next(error) }
}

async function toggleSave(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const post = await CampusFeedPost.findById(req.params.id).select('+saves')
        if (!post || post.status !== 'active') return res.status(404).json({ success: false, message: 'Post not found' })
        const userId = req.user._id.toString()
        const index = post.saves.findIndex((id) => id.toString() === userId)
        if (index >= 0) post.saves.splice(index, 1)
        else post.saves.push(req.user._id)
        await post.save()
        res.json({ success: true, saveCount: post.saves.length, savedByMe: index < 0 })
    } catch (error) { next(error) }
}

async function votePoll(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const optionId = req.body?.optionId
        if (!mongoose.isValidObjectId(optionId)) return res.status(400).json({ success: false, message: 'Invalid option ID' })
        const post = await CampusFeedPost.findById(req.params.id).select('+likes +saves')
        if (!post || post.status !== 'active' || !post.poll) return res.status(404).json({ success: false, message: 'Poll not found' })
        const option = post.poll.options.id(optionId)
        if (!option) return res.status(404).json({ success: false, message: 'Option not found' })
        // remove previous vote
        for (const opt of post.poll.options) {
            opt.votes = opt.votes.filter((id) => id.toString() !== req.user._id.toString())
        }
        option.votes.push(req.user._id)
        await post.save()
        const populated = await CampusFeedPost.findById(post._id).populate('author', 'name college profileImage').select('+likes +saves')
        res.json({ success: true, post: serializePost(populated, req.user._id) })
    } catch (error) { next(error) }
}
async function getPost(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const postFilter = { _id: req.params.id, status: 'active' }
        if (!req.user) postFilter.visibility = 'public'
        const post = await CampusFeedPost.findOne(postFilter).populate('author', 'name college profileImage').select('+likes +saves')
        if (!post || post.status !== 'active') return res.status(404).json({ success: false, message: 'Post not found' })
        res.json({ success: true, post: serializePost(post, req.user?._id) })
    } catch (error) { next(error) }
}

async function updatePost(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const post = await CampusFeedPost.findById(req.params.id).select('+likes +saves')
        if (!post || post.status !== 'active') return res.status(404).json({ success: false, message: 'Post not found' })
        if (post.author.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'You can only edit your own posts' })
        const body = req.body || {}
        const validation = validateBody(body, true)
        if (validation) return res.status(400).json({ success: false, message: validation })
        if (Object.prototype.hasOwnProperty.call(body, 'content')) {
            const content = String(body.content || '').trim()
            if (!content && !(post.media && post.media.length)) return res.status(400).json({ success: false, message: 'Content is required' })
            if (content.length > MAX_CONTENT) return res.status(400).json({ success: false, message: `Content must be ${MAX_CONTENT} characters or fewer` })
            post.content = content
        }
        if (body.category) {
            const allowedCategories = ['general', 'update', 'meme', 'food', 'sports', 'study', 'event', 'club', 'marketplace', 'lostfound', 'question']
            if (!allowedCategories.includes(body.category)) return res.status(400).json({ success: false, message: 'Invalid category' })
            post.category = body.category
        }
        if (Object.prototype.hasOwnProperty.call(body, 'hashtags')) post.hashtags = normalizeHashtags(parseJsonField(body.hashtags, body.hashtags))
        if (Object.prototype.hasOwnProperty.call(body, 'campusTag')) post.campusTag = String(body.campusTag || '').trim().slice(0, 120)
        if (Object.prototype.hasOwnProperty.call(body, 'visibility')) post.visibility = body.visibility === 'public' ? 'public' : 'campus'
        await post.save()
        const populated = await CampusFeedPost.findById(post._id).populate('author', 'name college profileImage').select('+likes +saves')
        res.json({ success: true, post: serializePost(populated, req.user._id) })
    } catch (error) { next(error) }
}

async function deletePost(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid post ID' })
        const post = await CampusFeedPost.findById(req.params.id)
        if (!post || post.status !== 'active') return res.status(404).json({ success: false, message: 'Post not found' })
        if (post.author.toString() !== req.user._id.toString() && !isAuthorizedAdmin(req.user)) return res.status(403).json({ success: false, message: 'You can only delete your own posts' })
        post.status = 'removed'
        await post.save()
        await CampusFeedComment.updateMany({ post: post._id }, { $set: { status: 'removed' } })
        res.json({ success: true, message: 'Post deleted' })
    } catch (error) { next(error) }
}
async function createPost(req, res, next) {
    try {
        const userId = req.user._id
        const body = req.body || {}
        const validation = validateBody(body)
        if (validation) return res.status(400).json({ success: false, message: validation })
        const content = typeof body.content === 'string' ? body.content.trim() : ''
        const category = body.category || 'general'
        const allowedCategories = ['general', 'update', 'meme', 'food', 'sports', 'study', 'event', 'club', 'marketplace', 'lostfound', 'question']
        if (!allowedCategories.includes(category)) return res.status(400).json({ success: false, message: 'Invalid category' })
        const hashtags = normalizeHashtags(parseJsonField(body.hashtags, body.hashtags))
        const pollInput = parseJsonField(body.poll, null)
        const files = req.files || []
        if (files.length > MAX_MEDIA) return res.status(400).json({ success: false, message: `You can upload up to ${MAX_MEDIA} media files` })
        if (!content && files.length === 0 && !pollInput) return res.status(400).json({ success: false, message: 'Add text, media, or a poll before posting' })
        if (content.length > MAX_CONTENT) return res.status(400).json({ success: false, message: `Content must be ${MAX_CONTENT} characters or fewer` })
        const media = await uploadMediaFiles(files)
        const hasVideo = media.some((item) => item.type === 'video')
        const postType = body.postType && ['text', 'photo', 'video', 'poll', 'reel'].includes(body.postType)
            ? body.postType
            : (hasVideo ? (media.length === 1 && media[0].height > media[0].width ? 'reel' : 'video') : (media.length ? 'photo' : (pollInput ? 'poll' : 'text')))
        let poll = undefined
        if (pollInput && typeof pollInput === 'object') {
            const question = String(pollInput.question || '').trim().slice(0, 300)
            const options = Array.isArray(pollInput.options) ? pollInput.options.map((option) => String(option).trim()).filter(Boolean).slice(0, 6) : []
            if (options.length < 2) return res.status(400).json({ success: false, message: 'Polls need at least two options' })
            poll = { question, options: options.map((text) => ({ text, votes: [] })), expiresAt: pollInput.expiresAt ? new Date(pollInput.expiresAt) : null }
        }
        const post = await CampusFeedPost.create({
            author: userId,
            content,
            postType,
            category,
            hashtags,
            campusTag: String(body.campusTag || '').trim().slice(0, 120),
            visibility: body.visibility === 'public' ? 'public' : 'campus',
            media,
            poll,
        })
        const populated = await CampusFeedPost.findById(post._id).populate('author', 'name college profileImage').select('+likes +saves')
        res.status(201).json({ success: true, post: serializePost(populated, userId) })
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })
        next(error)
    }
}
function serializeComment(comment, userId) {
    const data = typeof comment.toObject === 'function' ? comment.toObject() : { ...comment }
    const likes = Array.isArray(data.likes) ? data.likes : []
    const author = data.author && typeof data.author === 'object' ? data.author : null
    return {
        _id: data._id,
        post: data.post,
        parentComment: data.parentComment || null,
        content: data.content,
        author: author ? { _id: author._id, name: author.name, college: author.college, profileImage: author.profileImage } : data.author,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        likeCount: likes.length,
        likedByMe: Boolean(userId && likes.some((id) => id.toString() === userId.toString())),
        isMine: Boolean(userId && data.author && (data.author._id || data.author).toString() === userId.toString()),
    }
}

async function listPosts(req, res, next) {
    try {
        const userId = req.user?._id
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 15))
        const filter = { status: 'active' }
        if (!userId) filter.visibility = 'public'
        if (req.query.type) filter.postType = req.query.type
        if (req.query.category) filter.category = req.query.category
        if (req.query.hashtag) filter.hashtags = String(req.query.hashtag).toLowerCase().replace(/^#/, '')
        if (req.query.campusTag) filter.campusTag = req.query.campusTag
        if (req.query.reels === 'true') filter.postType = { $in: ['video', 'reel'] }
        const tab = req.query.tab || 'latest'
        if (tab === 'following' && userId) {
            const follows = await CampusFeedFollow.find({ follower: userId }).select('following').lean()
            filter.author = { $in: follows.map((item) => item.following) }
        }
        if (req.query.search) {
            const term = String(req.query.search).trim()
            if (term) filter.$or = [{ content: new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { hashtags: term.toLowerCase().replace(/^#/, '') }]
        }
        let sort = { createdAt: -1 }
        if (tab === 'trending') sort = { commentCount: -1, createdAt: -1 }
        const [posts, total] = await Promise.all([
            CampusFeedPost.find(filter).populate('author', 'name college profileImage').sort(sort).skip((page - 1) * limit).limit(limit).lean(),
            CampusFeedPost.countDocuments(filter),
        ])
        // hydrate likes/saves not in lean? need select +likes? likes select false, so fetch separately? We'll store counts via aggregation.
        const postIds = posts.map((post) => post._id)
        const fullPosts = postIds.length ? await CampusFeedPost.find({ _id: { $in: postIds } }).select('+likes +saves').lean() : []
        const byId = new Map(fullPosts.map((post) => [post._id.toString(), post]))
        const hydrated = posts.map((post) => ({ ...post, likes: byId.get(post._id.toString())?.likes || [], saves: byId.get(post._id.toString())?.saves || [] }))
        res.json({ success: true, posts: hydrated.map((post) => serializePost(post, userId)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) { next(error) }
}
module.exports = {
    listPosts,
    createPost,
    getPost,
    updatePost,
    deletePost,
    toggleLike,
    toggleSave,
    votePoll,
    listComments,
    createComment,
    deleteComment,
    toggleCommentLike,
    followUser,
    unfollowUser,
    savedPosts,
    myPosts,
    trendingHashtags,
    reportPost,
    reportComment,
    serializePost,
    serializeComment,
    uploadMediaFiles,
    validateBody,
    MAX_MEDIA,
    MAX_CONTENT,
    MAX_COMMENT,
}
