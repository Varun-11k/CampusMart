const mongoose = require('mongoose')
const CampusExchange = require('../models/CampusExchange')
const CampusExchangeRequest = require('../models/CampusExchangeRequest')
const cloudinary = require('../config/cloudinary')
const { createAndEmitNotification } = require('../services/notificationService')
const pointsService = require('../services/pointsService')

const categories = ['Books', 'Electronics', 'Hostel', 'Fashion', 'Accessories', 'Sports', 'Other']
const conditions = ['New', 'Like New', 'Good', 'Fair']
const ownerFields = 'name college profileImage'
const requesterFields = 'name college profileImage'
const publicFields = 'title description category condition offeredItem wantedItem openToOffers location images owner status createdAt updatedAt'
const editableFields = ['title', 'description', 'category', 'condition', 'offeredItem', 'wantedItem', 'openToOffers', 'location', 'images']
const MAX_IMAGES = 5
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_PAGE = 10000

function safeText(value, max) {
    return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max
}
function validId(id) { return mongoose.isValidObjectId(id) }
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function cleanSearch(value) { return value.normalize('NFKC').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().replace(/\s+/g, ' ').slice(0, 120) }

function normalizeImages(input) {
    if (input === undefined) return undefined
    if (typeof input === 'string') {
        try { input = JSON.parse(input) } catch { return null }
    }
    if (!Array.isArray(input) || input.length > MAX_IMAGES) return null
    for (const image of input) {
        if (typeof image !== 'string') return null
        try {
            const url = new URL(image)
            if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return null
        } catch { return null }
    }
    return input
}

function validateBody(body, { partial = false, fileCount = 0 } = {}) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 'A JSON or multipart request body is required'
    if (Object.keys(body).some((field) => !editableFields.includes(field))) return 'Request contains unsupported fields'
    if (!partial) {
        for (const field of ['title', 'category', 'condition', 'offeredItem', 'wantedItem', 'location']) {
            if (!Object.hasOwn(body, field)) return `${field} is required`
        }
    }
    const limits = { title: 120, description: 2000, offeredItem: 200, wantedItem: 200, location: 120 }
    for (const [field, max] of Object.entries(limits)) {
        if (Object.hasOwn(body, field) && !(field === 'description' && typeof body[field] === 'string' && body[field].length === 0) && !safeText(body[field], max)) return `${field} must be a non-empty string of at most ${max} characters`
        if (!partial && field !== 'description' && !safeText(body[field], max)) return `${field} is required`
        if (Object.hasOwn(body, field) && typeof body[field] === 'string' && body[field].trim().length > max) return `${field} must be ${max} characters or fewer`
        if (Object.hasOwn(body, field) && typeof body[field] !== 'string') return `${field} must be a string`
    }
    if (Object.hasOwn(body, 'category') && !categories.includes(body.category)) return `category must be one of: ${categories.join(', ')}`
    if (Object.hasOwn(body, 'condition') && !conditions.includes(body.condition)) return `condition must be one of: ${conditions.join(', ')}`
    if (Object.hasOwn(body, 'openToOffers') && typeof body.openToOffers !== 'boolean' && !['true', 'false'].includes(body.openToOffers)) return 'openToOffers must be a boolean'
    if (Object.hasOwn(body, 'images') && normalizeImages(body.images) === null) return 'images must contain up to 5 secure Cloudinary URLs'
    const existingImages = Object.hasOwn(body, 'images') ? normalizeImages(body.images) || [] : []
    if (fileCount + existingImages.length > MAX_IMAGES) return `You can upload up to ${MAX_IMAGES} images`
    if (partial && !Object.keys(body).length && !fileCount) return 'Provide at least one field to update'
    return null
}

function buildFilter(query = {}) {
    const filter = {
        status: 'active',
        $or: [{ moderationStatus: 'active' }, { moderationStatus: { $exists: false } }],
    }
    if (query.category) filter.category = new RegExp(`^${escapeRegex(String(query.category).slice(0, 80))}$`, 'i')
    if (query.condition) filter.condition = conditions.includes(query.condition) ? query.condition : '__invalid_condition__'
    if (query.location) filter.location = new RegExp(escapeRegex(String(query.location).slice(0, 120)), 'i')
    const text = typeof query.search === 'string' ? cleanSearch(query.search) : ''
    if (text) filter.$text = { $search: text }
    return filter
}

async function uploadImages(files = []) {
    if (files.length > MAX_IMAGES) throw Object.assign(new Error(`You can upload up to ${MAX_IMAGES} images`), { statusCode: 400 })
    for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) throw Object.assign(new Error('Only JPG, PNG, WEBP, and GIF images are allowed'), { statusCode: 400 })
        if (file.size > MAX_IMAGE_SIZE) throw Object.assign(new Error('Each image must be 5MB or smaller'), { statusCode: 400 })
    }
    return Promise.all(files.map((file) => new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: 'campusmart/exchanges', resource_type: 'image' }, (error, result) => error ? reject(error) : resolve(result.secure_url))
        stream.end(file.buffer)
    })))
}

function publicExchange(exchange) {
    const value = typeof exchange.toObject === 'function' ? exchange.toObject() : { ...exchange }
    delete value.__v
    delete value.moderationStatus
    if (value.owner && typeof value.owner === 'object') {
        value.owner = { _id: value.owner._id, name: value.owner.name, college: value.owner.college, profileImage: value.owner.profileImage }
    }
    return value
}

async function listExchanges(req, res, next) {
    try {
        const { search = '', category = '', condition = '', location = '' } = req.query
        if (category && !categories.includes(category)) return res.status(400).json({ success: false, message: 'Invalid category' })
        if (condition && !conditions.includes(condition)) return res.status(400).json({ success: false, message: 'Invalid condition' })
        const page = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(req.query.page, 10) || 1))
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 12))
        const filter = buildFilter({ search, category, condition, location })
        const [exchanges, total] = await Promise.all([
            CampusExchange.find(filter).select(publicFields).populate('owner', ownerFields)
                .sort(filter.$text ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 })
                .skip((page - 1) * limit).limit(limit).lean(),
            CampusExchange.countDocuments(filter),
        ])
        res.json({ success: true, exchanges, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) { next(error) }
}

async function getExchange(req, res, next) {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid exchange ID' })
        const exchange = await CampusExchange.findById(req.params.id).select(`${publicFields} moderationStatus`).populate('owner', ownerFields).lean()
        const isOwner = exchange?.owner?._id?.toString() === req.user?._id?.toString()
        if (!exchange || (exchange.status !== 'active' && !isOwner) || (exchange.moderationStatus !== 'active' && !isOwner)) return res.status(404).json({ success: false, message: 'Exchange listing not found' })
        const result = publicExchange(exchange)
        if (isOwner) result.isMine = true
        else if (req.user?._id) {
            const ownRequest = await CampusExchangeRequest.findOne({ exchange: exchange._id, requester: req.user._id }).select('status message createdAt').lean()
            if (ownRequest) result.myRequest = ownRequest
        }
        res.json({ success: true, exchange: result })
    } catch (error) { next(error) }
}

async function createExchange(req, res, next) {
    try {
        const body = req.body || {}
        const files = req.files || []
        const validation = validateBody(body, { fileCount: files.length })
        if (validation) return res.status(400).json({ success: false, message: validation })
        const images = normalizeImages(body.images) || []
        const uploaded = await uploadImages(files)
        const exchange = await CampusExchange.create({
            title: body.title.trim(), description: typeof body.description === 'string' ? body.description.trim() : '',
            category: body.category, condition: body.condition, offeredItem: body.offeredItem.trim(), wantedItem: body.wantedItem.trim(), openToOffers: body.openToOffers === true || body.openToOffers === 'true',
            location: body.location.trim(), images: [...images, ...uploaded], owner: req.user._id,
        })
        await exchange.populate('owner', ownerFields)
        res.status(201).json({ success: true, exchange: publicExchange(exchange) })
    } catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message }); next(error) }
}

async function updateExchange(req, res, next) {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid exchange ID' })
        const body = req.body || {}
        const files = req.files || []
        const validation = validateBody(body, { partial: true, fileCount: files.length })
        if (validation) return res.status(400).json({ success: false, message: validation })
        const exchange = await CampusExchange.findById(req.params.id)
        if (!exchange) return res.status(404).json({ success: false, message: 'Exchange listing not found' })
        if (exchange.owner.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only the owner can edit this exchange' })
        if (exchange.status !== 'active' || exchange.moderationStatus !== 'active') return res.status(409).json({ success: false, message: 'Only active exchange listings can be edited' })
        const retainedImages = Object.hasOwn(body, 'images') ? normalizeImages(body.images) : exchange.images
        if (retainedImages.length + files.length > MAX_IMAGES) return res.status(400).json({ success: false, message: `You can upload up to ${MAX_IMAGES} images` })
        const uploaded = await uploadImages(files)
        for (const field of ['title', 'description', 'category', 'condition', 'offeredItem', 'wantedItem', 'location']) if (Object.hasOwn(body, field)) exchange[field] = body[field].trim()
        if (Object.hasOwn(body, 'openToOffers')) exchange.openToOffers = body.openToOffers === true || body.openToOffers === 'true'
        if (Object.hasOwn(body, 'images')) exchange.images = retainedImages
        if (uploaded.length) exchange.images.push(...uploaded)
        if (exchange.images.length > MAX_IMAGES) return res.status(400).json({ success: false, message: `You can upload up to ${MAX_IMAGES} images` })
        await exchange.save()
        await exchange.populate('owner', ownerFields)
        res.json({ success: true, exchange: publicExchange(exchange) })
    } catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message }); next(error) }
}

async function deleteExchange(req, res, next) { return setOwnerStatus(req, res, next, 'closed') }
async function markExchanged(req, res, next) { return setOwnerStatus(req, res, next, 'exchanged') }
async function closeExchange(req, res, next) { return setOwnerStatus(req, res, next, 'closed') }

async function setOwnerStatus(req, res, next, status) {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid exchange ID' })
        const exchange = await CampusExchange.findById(req.params.id)
        if (!exchange) return res.status(404).json({ success: false, message: 'Exchange listing not found' })
        if (exchange.owner.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only the owner can change this exchange' })
        if (exchange.status !== 'active') return res.status(409).json({ success: false, message: 'Only active listings can be changed' })
        exchange.status = status
        await exchange.save()
        const pending = await CampusExchangeRequest.find({ exchange: exchange._id, status: 'pending' }).select('_id requester')
        await CampusExchangeRequest.updateMany({ exchange: exchange._id, status: 'pending' }, { $set: { status: 'rejected' } })
        await Promise.all(pending.map((request) => notify({ recipient: request.requester, title: status === 'exchanged' ? 'Exchange completed' : 'Exchange listing closed', message: `The exchange listing “${exchange.title}” is no longer accepting requests.`, campusExchange: exchange._id })))
        res.json({ success: true, exchange: publicExchange(exchange) })
    } catch (error) { next(error) }
}

async function myExchanges(req, res, next) {
    try {
        const page = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(req.query.page, 10) || 1))
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20))
        const status = req.query.status || ''
        if (status && !['active', 'exchanged', 'closed', 'pending_requests'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid exchange status filter' })
        const filter = { owner: req.user._id }
        if (status === 'pending_requests') {
            const pendingExchanges = await CampusExchangeRequest.aggregate([
                { $match: { status: 'pending' } },
                { $group: { _id: '$exchange' } },
                { $lookup: { from: CampusExchange.collection.name, let: { exchangeId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$_id', '$$exchangeId'] }, { $eq: ['$owner', req.user._id] }] } } }, { $project: { _id: 1 } }], as: 'ownedExchange' } },
                { $match: { 'ownedExchange.0': { $exists: true } } },
                { $project: { _id: 1 } },
            ])
            filter._id = { $in: pendingExchanges.map((item) => item._id) }
        } else if (status) filter.status = status
        const [exchanges, total] = await Promise.all([
            CampusExchange.find(filter).select(publicFields).populate('owner', ownerFields).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            CampusExchange.countDocuments(filter),
        ])
        const exchangeIds = exchanges.map((exchange) => exchange._id)
        const pendingCounts = exchangeIds.length ? await CampusExchangeRequest.aggregate([
            { $match: { exchange: { $in: exchangeIds }, status: 'pending' } },
            { $group: { _id: '$exchange', count: { $sum: 1 } } },
        ]) : []
        const pendingByExchange = new Map(pendingCounts.map((item) => [item._id.toString(), item.count]))
        res.json({ success: true, exchanges: exchanges.map((exchange) => ({ ...publicExchange(exchange), pendingRequests: pendingByExchange.get(exchange._id.toString()) || 0 })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) { next(error) }
}

async function requestExchange(req, res, next) {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid exchange ID' })
        const body = req.body || {}
        if (Object.keys(body).some((key) => !['message', 'proposal'].includes(key)) || !safeText(body.message, 1000) || (body.proposal !== undefined && (typeof body.proposal !== 'string' || body.proposal.trim().length > 200))) return res.status(400).json({ success: false, message: 'message and optional proposal must be within their character limits' })
        const exchange = await CampusExchange.findOne({ _id: req.params.id, status: 'active', moderationStatus: 'active' })
        if (!exchange) return res.status(404).json({ success: false, message: 'Active exchange listing not found' })
        if (exchange.owner.toString() === req.user._id.toString()) return res.status(400).json({ success: false, message: 'You cannot request your own exchange' })
        if (body.proposal && !exchange.openToOffers) return res.status(400).json({ success: false, message: 'This listing is not open to alternative offers' })
        const request = await CampusExchangeRequest.create({ exchange: exchange._id, requester: req.user._id, message: body.message.trim(), proposal: body.proposal?.trim() || '' })
        await notify({ recipient: exchange.owner, title: 'New exchange request', message: `A student is interested in “${exchange.title}”.`, campusExchange: exchange._id })
        res.status(201).json({ success: true, request: { _id: request._id, exchange: request.exchange, message: request.message, proposal: request.proposal, status: request.status, createdAt: request.createdAt } })
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'You already have a pending request for this exchange' })
        next(error)
    }
}

async function getExchangeRequests(req, res, next) {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid exchange ID' })
        const exchange = await CampusExchange.findById(req.params.id).select('owner')
        if (!exchange) return res.status(404).json({ success: false, message: 'Exchange listing not found' })
        if (exchange.owner.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only the exchange owner can view requests' })
        const requests = await CampusExchangeRequest.find({ exchange: exchange._id }).select('exchange requester message proposal status createdAt updatedAt').populate('requester', requesterFields).sort({ createdAt: -1 }).limit(100).lean()
        res.json({ success: true, requests })
    } catch (error) { next(error) }
}

async function findMatches(req, res, next) {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid exchange ID' })
        const source = await CampusExchange.findOne({ _id: req.params.id, status: 'active', moderationStatus: 'active' }).select('owner category condition offeredItem wantedItem location')
        if (!source) return res.status(404).json({ success: false, message: 'Active exchange listing not found' })
        const query = source.wantedItem.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2).slice(0, 6).join(' ')
        if (!query) return res.json({ success: true, matches: [] })
        const candidates = await CampusExchange.find({ status: 'active', moderationStatus: 'active', owner: { $ne: source.owner }, _id: { $ne: source._id }, $text: { $search: query } }).select(publicFields).populate('owner', ownerFields).sort({ score: { $meta: 'textScore' }, createdAt: -1 }).limit(30).lean()
        const terms = (value) => new Set(value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2))
        const sourceWanted = terms(source.wantedItem); const sourceOffered = terms(source.offeredItem)
        const ranked = candidates.map((candidate) => {
            const candidateOffered = terms(candidate.offeredItem); const candidateWanted = terms(candidate.wantedItem)
            const overlap = (first, second) => [...first].filter((word) => second.has(word)).length
            const reciprocal = overlap(sourceWanted, candidateOffered) + overlap(sourceOffered, candidateWanted)
            const score = reciprocal * 3 + (candidate.category === source.category ? 2 : 0) + (candidate.condition === source.condition ? 1 : 0) + (candidate.location.toLowerCase() === source.location.toLowerCase() ? 1 : 0)
            return { candidate, score }
        }).filter((match) => match.score > 0).sort((a, b) => b.score - a.score).slice(0, 8).map(({ candidate }) => publicExchange(candidate))
        res.json({ success: true, matches: ranked })
    } catch (error) { next(error) }
}

async function updateRequestStatus(req, res, next, action) {
    const session = await mongoose.startSession()
    let result
    let notification
    try {
        if (!validId(req.params.requestId)) return res.status(400).json({ success: false, message: 'Invalid exchange request ID' })
        const request = await CampusExchangeRequest.findById(req.params.requestId).populate('exchange').session(session)
        if (!request?.exchange) return res.status(404).json({ success: false, message: 'Exchange request not found' })
        const exchange = request.exchange
        const userId = req.user._id.toString()
        if (action === 'cancel') {
            if (request.requester.toString() !== userId) return res.status(403).json({ success: false, message: 'Only the requester can cancel this request' })
            if (request.status !== 'pending') return res.status(409).json({ success: false, message: 'Only pending requests can be cancelled' })
            request.status = 'cancelled'
            await request.save()
            notification = { recipient: exchange.owner, title: 'Exchange request cancelled', message: `A request for “${exchange.title}” was cancelled.`, campusExchange: exchange._id }
            result = request
        } else {
            if (exchange.owner.toString() !== userId) return res.status(403).json({ success: false, message: 'Only the exchange owner can manage requests' })
            if (request.status !== 'pending') return res.status(409).json({ success: false, message: 'This request is no longer pending' })
            if (action === 'reject') {
                request.status = 'rejected'
                await request.save()
                notification = { recipient: request.requester, title: 'Exchange request update', message: `Your request for “${exchange.title}” was not accepted.`, campusExchange: exchange._id }
                result = request
            } else {
                const competing = await CampusExchangeRequest.find({ exchange: exchange._id, status: 'pending', _id: { $ne: request._id } }).select('requester').lean()
                await session.withTransaction(async () => {
                    const claimed = await CampusExchange.updateOne({ _id: exchange._id, owner: req.user._id, status: 'active', moderationStatus: 'active' }, { $set: { status: 'exchanged' } }, { session })
                    if (claimed.modifiedCount !== 1) throw Object.assign(new Error('This exchange is no longer available'), { statusCode: 409 })
                    const accepted = await CampusExchangeRequest.findOneAndUpdate({ _id: request._id, exchange: exchange._id, status: 'pending' }, { $set: { status: 'accepted' } }, { new: true, session })
                    if (!accepted) throw Object.assign(new Error('This request is no longer pending'), { statusCode: 409 })
                    await CampusExchangeRequest.updateMany({ exchange: exchange._id, status: 'pending', _id: { $ne: request._id } }, { $set: { status: 'rejected' } }, { session })
                    result = accepted
                })
                notification = { recipient: request.requester, title: 'Exchange request accepted', message: `Your request for “${exchange.title}” was accepted.`, campusExchange: exchange._id }
                await Promise.all(competing.map((entry) => notify({ recipient: entry.requester, title: 'Exchange listing completed', message: `The exchange “${exchange.title}” has been completed.`, campusExchange: exchange._id })))
                try {
                    await Promise.all([
                        pointsService.awardPoints({ user: exchange.owner, action: 'exchange_completed', points: 25, referenceType: 'CampusExchangeRequest', referenceId: request._id, description: 'Completed a campus exchange.' }),
                        pointsService.awardPoints({ user: request.requester, action: 'exchange_completed', points: 25, referenceType: 'CampusExchangeRequest', referenceId: request._id, description: 'Completed a campus exchange.' }),
                        pointsService.awardExchangeBadges(exchange.owner),
                        pointsService.awardExchangeBadges(request.requester),
                    ])
                } catch (pointsError) { console.error('Unable to award exchange contribution points:', pointsError.message) }
            }
        }
        await notify(notification)
        return res.json({ success: true, request: result })
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })
        return next(error)
    } finally { await session.endSession() }
}

async function acceptRequest(req, res, next) { return updateRequestStatus(req, res, next, 'accept') }
async function rejectRequest(req, res, next) { return updateRequestStatus(req, res, next, 'reject') }
async function cancelRequest(req, res, next) { return updateRequestStatus(req, res, next, 'cancel') }

async function notify(data) {
    if (!data?.recipient) return
    try { await createAndEmitNotification({ ...data, type: 'system' }) }
    catch (error) { console.error('Unable to create Campus Exchange notification:', error.message) }
}

module.exports = {
    listExchanges, getExchange, createExchange, updateExchange, deleteExchange, myExchanges,
    markExchanged, closeExchange, requestExchange, getExchangeRequests, acceptRequest, rejectRequest, cancelRequest, findMatches,
    buildFilter, validateBody, normalizeImages, uploadImages, publicExchange, categories, conditions, MAX_IMAGES, MAX_IMAGE_SIZE, MAX_PAGE,
}
