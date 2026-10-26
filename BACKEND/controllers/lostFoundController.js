const mongoose = require('mongoose')
const LostFoundReport = require('../models/LostFoundReport')
const LostFoundClaim = require('../models/LostFoundClaim')
const cloudinary = require('../config/cloudinary')
const { buildLostFoundFilter, searchLostFoundReports } = require('../services/lostFoundSearchService')

const ownerFields = 'name college profileImage'
const allowedFields = ['type', 'title', 'category', 'description', 'location', 'date', 'contactPreference']
const requiredFields = ['type', 'title', 'category', 'description', 'location', 'date']
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_IMAGES = 5
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

function isValidId(id) { return mongoose.isValidObjectId(id) }
function containsPrivateContact(value) {
    return /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(value)
        || /(?:\+?91[\s-]?)?[6-9]\d{9}\b/.test(value)
        || /\b(?:student|roll|registration)\s*(?:id|no\.?|number)\s*[:#-]?\s*[A-Z0-9-]{5,}\b/i.test(value)
}

function imageSignatureMatches(file) {
    const buffer = file?.buffer
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false
    if (file.mimetype === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    if (file.mimetype === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    if (file.mimetype === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))
    if (file.mimetype === 'image/webp') return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
    return false
}

function serializeReport(report, viewerId) {
    const data = typeof report.toObject === 'function' ? report.toObject() : { ...report }
    delete data.moderationStatus
    const reporter = data.reportedBy
    const reporterId = reporter?._id || reporter
    data.isMine = Boolean(viewerId && reporterId && reporterId.toString() === viewerId.toString())
    if (reporter && typeof reporter === 'object') {
        data.reportedBy = { name: reporter.name, college: reporter.college, profileImage: reporter.profileImage }
    } else delete data.reportedBy
    return data
}

function validateBody(body, partial = false) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 'A JSON or multipart request body is required'
    const allowed = new Set([...allowedFields, 'images'])
    if (Object.keys(body).some((key) => !allowed.has(key))) return 'Request contains unsupported fields'
    if (!partial) {
        for (const key of requiredFields) if (!Object.hasOwn(body, key)) return `${key} is required`
    }
    const requiredText = ['title', 'category', 'description', 'location']
    for (const key of requiredText) {
        if ((Object.hasOwn(body, key) || !partial) && (typeof body[key] !== 'string' || !body[key].trim())) return `${key} must be a non-empty string`
    }
    const limits = { title: 120, category: 80, description: 2000, location: 160 }
    for (const [key, max] of Object.entries(limits)) if (typeof body[key] === 'string' && body[key].trim().length > max) return `${key} must be ${max} characters or fewer`
    for (const key of ['description', 'location']) if (typeof body[key] === 'string' && containsPrivateContact(body[key])) return `Remove email addresses, phone numbers, and student identifiers from ${key}`
    if (Object.hasOwn(body, 'type') && !['lost', 'found'].includes(body.type)) return 'type must be lost or found'
    if (Object.hasOwn(body, 'contactPreference') && !['in_app', 'claims_only'].includes(body.contactPreference)) return 'contactPreference must be in_app or claims_only'
    if (Object.hasOwn(body, 'date') && (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(String(body.date)) || Number.isNaN(new Date(body.date).getTime()))) return 'date must be a valid date'
    if (Object.hasOwn(body, 'images')) {
        let images = body.images
        if (typeof images === 'string') { try { images = JSON.parse(images) } catch { return 'images must be a JSON array' } }
        if (!Array.isArray(images) || images.length > MAX_IMAGES || images.some((url) => {
            if (typeof url !== 'string') return true
            try { return new URL(url).protocol !== 'https:' || new URL(url).hostname !== 'res.cloudinary.com' } catch { return true }
        })) return `images must contain at most ${MAX_IMAGES} secure Cloudinary URLs`
    }
    if (partial && ![...allowedFields, 'images'].some((key) => Object.hasOwn(body, key))) return 'At least one report field is required'
    return null
}

function normalizeImages(images) {
    if (!images) return []
    if (Array.isArray(images)) return images
    try { const parsed = JSON.parse(images); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}

async function uploadImages(files = []) {
    if (files.length > MAX_IMAGES) throw Object.assign(new Error(`You can upload up to ${MAX_IMAGES} images`), { statusCode: 400 })
    for (const file of files) {
        if (!allowedImageTypes.has(file.mimetype)) throw Object.assign(new Error('Only JPG, PNG, WEBP, and GIF images are allowed'), { statusCode: 400 })
        if (file.size > MAX_IMAGE_SIZE) throw Object.assign(new Error('Each image must be 5MB or smaller'), { statusCode: 400 })
        if (!imageSignatureMatches(file)) throw Object.assign(new Error('The uploaded file contents do not match a supported image type'), { statusCode: 400 })
    }
    return Promise.all(files.map((file) => new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: 'campusmart/lost-found', resource_type: 'image' }, (error, result) => error ? reject(error) : resolve(result.secure_url))
        stream.end(file.buffer)
    })))
}

function reportQuery(req) {
    const date = req.query.date ? String(req.query.date) : null
    return buildLostFoundFilter({
        type: req.query.type,
        query: req.query.search ? String(req.query.search) : null,
        category: req.query.category ? String(req.query.category) : null,
        location: req.query.location ? String(req.query.location) : null,
        date,
        status: req.query.status ? String(req.query.status) : null,
    })
}

async function listReports(req, res, next) {
    try {
        if (req.query.type && !['lost', 'found'].includes(req.query.type)) return res.status(400).json({ success: false, message: 'type must be lost or found' })
        if (req.query.status && !['active', 'under_review', 'claimed', 'resolved', 'returned', 'closed'].includes(req.query.status)) return res.status(400).json({ success: false, message: 'Invalid report status' })
        const query = reportQuery(req)
        if (!query) return res.status(400).json({ success: false, message: 'date must use YYYY-MM-DD format' })
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20))
        const { reports, total } = await searchLostFoundReports({ filter: query, page, limit, publicOnly: true })
        res.json({ success: true, reports, page, limit, total, pages: Math.ceil(total / limit) })
    } catch (error) { next(error) }
}

async function getReport(req, res, next) {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid report ID' })
        const report = await LostFoundReport.findById(req.params.id).select('-__v').populate('reportedBy', ownerFields).lean()
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' })
        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
        const isAdmin = req.user?.role === 'admin' && adminEmail === req.user.email?.toLowerCase()
        const isOwner = req.user && report.reportedBy?._id?.toString() === req.user._id.toString()
        if (report.moderationStatus && report.moderationStatus !== 'active' && !isOwner && !isAdmin) return res.status(404).json({ success: false, message: 'Report not found' })
        let claims
        if (req.user && report.reportedBy?._id?.toString() === req.user._id.toString()) {
            const ownerClaims = await LostFoundClaim.find({ report: report._id }).select('-reviewedBy').populate('claimant', ownerFields).sort({ createdAt: -1 }).lean()
            claims = ownerClaims.map((claim) => ({ ...claim, claimant: claim.claimant ? { name: claim.claimant.name, college: claim.claimant.college, profileImage: claim.claimant.profileImage } : undefined }))
        }
        res.json({ success: true, report: serializeReport(report, req.user?._id), ...(claims ? { claims } : {}) })
    } catch (error) { next(error) }
}

async function createReport(req, res, next) {
    try {
        const body = req.body || {}
        const validation = validateBody(body)
        if (validation) return res.status(400).json({ success: false, message: validation })
        const files = req.files || []
        const suppliedImages = normalizeImages(body.images)
        if (files.length + suppliedImages.length > MAX_IMAGES) return res.status(400).json({ success: false, message: `You can upload up to ${MAX_IMAGES} images` })
        const uploaded = await uploadImages(files)
        const report = await LostFoundReport.create({ type: body.type, title: body.title.trim(), category: body.category.trim(), description: body.description.trim(), location: body.location.trim(), date: new Date(body.date), contactPreference: body.contactPreference || 'in_app', images: [...suppliedImages, ...uploaded], reportedBy: req.user._id })
        await report.populate('reportedBy', ownerFields)
        res.status(201).json({ success: true, report: serializeReport(report, req.user._id) })
    } catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message }); next(error) }
}

async function updateReport(req, res, next) {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid report ID' })
        const body = req.body || {}
        const validation = validateBody(body, true)
        if (validation) return res.status(400).json({ success: false, message: validation })
        const report = await LostFoundReport.findById(req.params.id)
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' })
        if (report.reportedBy.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only the report owner can edit this report' })
        if (report.status !== 'active') return res.status(409).json({ success: false, message: 'Only active reports can be edited' })
        const files = req.files || []
        const existingImages = Object.hasOwn(body, 'images') ? normalizeImages(body.images) : report.images
        if (files.length + existingImages.length > MAX_IMAGES) return res.status(400).json({ success: false, message: `You can have up to ${MAX_IMAGES} images` })
        const uploaded = await uploadImages(files)
        for (const key of allowedFields) if (Object.hasOwn(body, key)) report[key] = key === 'date' ? new Date(body[key]) : typeof body[key] === 'string' ? body[key].trim() : body[key]
        report.images = [...existingImages, ...uploaded]
        await report.save()
        await report.populate('reportedBy', ownerFields)
        res.json({ success: true, report: serializeReport(report, req.user._id) })
    } catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message }); next(error) }
}

async function deleteReport(req, res, next) {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid report ID' })
        const report = await LostFoundReport.findById(req.params.id)
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' })
        if (report.reportedBy.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only the report owner can delete this report' })
        if (report.status !== 'active') return res.status(409).json({ success: false, message: 'Only active reports can be deleted' })
        if (await LostFoundClaim.exists({ report: report._id })) return res.status(409).json({ success: false, message: 'This report has claim history. Close it to preserve the case record.' })
        await report.deleteOne()
        res.json({ success: true, message: 'Report deleted' })
    } catch (error) { next(error) }
}

async function myReports(req, res, next) {
    try {
        const reports = await LostFoundReport.aggregate([
            { $match: { reportedBy: req.user._id } },
            { $sort: { createdAt: -1 } },
            { $lookup: { from: LostFoundClaim.collection.name, localField: '_id', foreignField: 'report', as: 'claims' } },
            { $addFields: { claimCount: { $size: '$claims' } } },
            { $project: { claims: 0, __v: 0 } },
        ])
        res.json({ success: true, reports })
    } catch (error) { next(error) }
}

async function adminReports(req, res, next) {
    try {
        if (req.query.moderationStatus && !['active', 'hidden', 'removed'].includes(req.query.moderationStatus)) return res.status(400).json({ success: false, message: 'Invalid moderation status' })
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20))
        const moderationStatus = ['active', 'hidden', 'removed'].includes(req.query.moderationStatus) ? req.query.moderationStatus : null
        const filter = moderationStatus ? { moderationStatus } : {}
        const [reports, total] = await Promise.all([
            LostFoundReport.find(filter).select('-__v').populate('reportedBy', ownerFields).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            LostFoundReport.countDocuments(filter),
        ])
        res.json({ success: true, reports, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) { next(error) }
}

async function markReturned(req, res, next) {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid report ID' })
        const report = await LostFoundReport.findById(req.params.id)
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' })
        if (report.reportedBy.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only the report owner can update this report' })
        if (!['active', 'claimed'].includes(report.status)) return res.status(409).json({ success: false, message: 'This report cannot be marked returned' })
        report.status = 'returned'
        await report.save()
        res.json({ success: true, report: serializeReport(report, req.user._id) })
    } catch (error) { next(error) }
}

async function closeReport(req, res, next) {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid report ID' })
        if (Object.keys(req.body || {}).length !== 1 || !['closed', 'active'].includes(req.body?.status)) return res.status(400).json({ success: false, message: 'status must be closed or active' })
        const report = await LostFoundReport.findById(req.params.id)
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' })
        if (report.reportedBy.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only the report owner can close this report' })
        if (report.moderationStatus !== 'active') return res.status(409).json({ success: false, message: 'This report cannot be changed while under moderation' })
        if (req.body.status === 'closed' && ['resolved', 'returned', 'closed'].includes(report.status)) return res.status(409).json({ success: false, message: 'This report is already closed' })
        if (req.body.status === 'active' && report.status !== 'closed') return res.status(409).json({ success: false, message: 'Only a closed report can be reopened' })
        report.status = req.body.status
        await report.save()
        res.json({ success: true, report: serializeReport(report, req.user._id) })
    } catch (error) { next(error) }
}

async function moderateReport(req, res, next) {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid report ID' })
        if (Object.keys(req.body || {}).length !== 1 || !['active', 'hidden', 'removed'].includes(req.body?.moderationStatus)) return res.status(400).json({ success: false, message: 'moderationStatus must be active, hidden, or removed' })
        const report = await LostFoundReport.findByIdAndUpdate(req.params.id, { $set: { moderationStatus: req.body.moderationStatus } }, { new: true, runValidators: true }).select('-__v -reportedBy')
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' })
        res.json({ success: true, report })
    } catch (error) { next(error) }
}

module.exports = { listReports, getReport, createReport, updateReport, deleteReport, myReports, adminReports, markReturned, closeReport, moderateReport, reportQuery, uploadImages, validateBody, imageSignatureMatches, serializeReport, containsPrivateContact, MAX_IMAGES }
