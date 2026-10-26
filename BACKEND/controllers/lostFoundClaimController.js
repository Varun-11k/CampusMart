const mongoose = require('mongoose')
const LostFoundReport = require('../models/LostFoundReport')
const LostFoundClaim = require('../models/LostFoundClaim')
const { createAndEmitNotification } = require('../services/notificationService')

const claimantFields = 'name college profileImage'

function isAuthorizedAdmin(user) {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
    return Boolean(user?.role === 'admin' && adminEmail && user.email?.toLowerCase() === adminEmail)
}

function serializeClaimForUser(claim) {
    const data = typeof claim.toObject === 'function' ? claim.toObject() : { ...claim }
    delete data.reviewedBy
    if (data.claimant && typeof data.claimant === 'object') delete data.claimant._id
    if (data.report && typeof data.report === 'object' && data.report.reportedBy && typeof data.report.reportedBy === 'object') {
        const { name, college, profileImage } = data.report.reportedBy
        data.report.reportedBy = { name, college, profileImage }
    }
    return data
}

async function notifyLostFound(data) {
    try { await createAndEmitNotification(data) }
    catch (error) { console.error('Lost & Found notification could not be delivered:', error.message) }
}

async function submitClaim(req, res, next) {
    try {
        const { id } = req.params
        const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid report ID' })
        if (!message || message.length > 1000) return res.status(400).json({ success: false, message: 'Distinguishing details of 1 to 1000 characters are required' })
        if (Object.keys(req.body || {}).some((key) => key !== 'message')) return res.status(400).json({ success: false, message: 'Only message is accepted' })
        const report = await LostFoundReport.findById(id).select('reportedBy status moderationStatus')
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' })
        if (report.moderationStatus && report.moderationStatus !== 'active') return res.status(404).json({ success: false, message: 'Report not found' })
        if (report.reportedBy.toString() === req.user._id.toString()) return res.status(403).json({ success: false, message: 'You cannot claim your own report' })
        if (report.status !== 'active') return res.status(409).json({ success: false, message: 'Claims are only allowed on active reports' })
        const claim = await LostFoundClaim.create({ report: report._id, claimant: req.user._id, message })
        await claim.populate('claimant', claimantFields)
        await notifyLostFound({ recipient: report.reportedBy, type: 'lost_found', title: 'New item claim', message: 'Someone submitted a claim on your Lost & Found report.', lostFoundReport: report._id })
        res.status(201).json({ success: true, claim: serializeClaimForUser(claim) })
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'You have already submitted a claim for this report' })
        next(error)
    }
}

async function updateClaim(req, res, next) {
    try {
        const { id, claimId } = req.params
        if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(claimId)) return res.status(400).json({ success: false, message: 'Invalid report or claim ID' })
        if (Object.keys(req.body || {}).some((key) => !['status', 'reviewerNote'].includes(key)) || !['approved', 'rejected', 'more_info_requested'].includes(req.body?.status)) return res.status(400).json({ success: false, message: 'status must be approved, rejected, or more_info_requested' })
        if (req.body.reviewerNote !== undefined && (typeof req.body.reviewerNote !== 'string' || req.body.reviewerNote.trim().length > 1000)) return res.status(400).json({ success: false, message: 'reviewerNote must be at most 1000 characters' })
        if (req.body.status === 'more_info_requested' && !req.body.reviewerNote?.trim()) return res.status(400).json({ success: false, message: 'Add a note explaining what information is needed' })
        let report = await LostFoundReport.findById(id)
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' })
        const owner = report.reportedBy.toString() === req.user._id.toString()
        const admin = isAuthorizedAdmin(req.user)
        if (!owner && !admin) return res.status(403).json({ success: false, message: 'Only the report owner or an authorized administrator can manage claims' })
        if (!['active', 'under_review'].includes(report.status)) return res.status(409).json({ success: false, message: 'This report is no longer accepting claim decisions' })
        const claim = await LostFoundClaim.findOne({ _id: claimId, report: report._id })
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' })
        if (claim.claimant.toString() === req.user._id.toString()) return res.status(403).json({ success: false, message: 'You cannot manage your own claim' })
        if (!['pending', 'more_info_requested'].includes(claim.status)) return res.status(409).json({ success: false, message: 'This claim has already been decided' })
        if (req.body.status === 'approved') {
            report = await LostFoundReport.findOneAndUpdate({ _id: report._id, status: { $in: ['active', 'under_review'] }, $or: [{ moderationStatus: 'active' }, { moderationStatus: { $exists: false } }] }, { $set: { status: 'claimed' } }, { new: true })
            if (!report) return res.status(409).json({ success: false, message: 'Another claim was already approved or the report is unavailable' })
        }
        claim.status = req.body.status
        claim.reviewerNote = typeof req.body.reviewerNote === 'string' ? req.body.reviewerNote.trim() : ''
        claim.reviewedBy = req.user._id
        await claim.save()
        if (claim.status === 'approved') {
            const otherClaimFilter = { report: report._id, _id: { $ne: claim._id }, status: { $in: ['pending', 'more_info_requested'] } }
            const remainingClaims = await LostFoundClaim.find(otherClaimFilter).select('claimant').lean()
            await LostFoundClaim.updateMany(otherClaimFilter, { $set: { status: 'rejected', reviewerNote: 'Another claim was approved for this item.', reviewedBy: req.user._id } })
            await Promise.all(remainingClaims.map((entry) => notifyLostFound({ recipient: entry.claimant, type: 'lost_found', title: 'Claim status updated', message: 'The report owner approved another claim for this item.', lostFoundReport: report._id })))
        }
        await claim.populate('claimant', claimantFields)
        const notificationCopy = claim.status === 'approved' ? 'Your Lost & Found claim was approved.' : claim.status === 'rejected' ? 'Your Lost & Found claim was not approved.' : 'The report owner needs more information about your claim.'
        await notifyLostFound({ recipient: claim.claimant._id, type: 'lost_found', title: 'Claim status updated', message: notificationCopy, lostFoundReport: report._id })
        res.json({ success: true, claim: serializeClaimForUser(claim), report })
    } catch (error) { next(error) }
}

async function myClaims(req, res, next) {
    try {
        const claims = await LostFoundClaim.find({ claimant: req.user._id }).populate({ path: 'report', populate: { path: 'reportedBy', select: claimantFields } }).sort({ createdAt: -1 }).lean()
        res.json({ success: true, claims: claims.map(serializeClaimForUser) })
    } catch (error) { next(error) }
}

async function replyToClaim(req, res, next) {
    try {
        const { id, claimId } = req.params
        const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
        if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(claimId)) return res.status(400).json({ success: false, message: 'Invalid report or claim ID' })
        if (Object.keys(req.body || {}).length !== 1 || !message || message.length > 1000) return res.status(400).json({ success: false, message: 'A reply of 1 to 1000 characters is required' })
        const claim = await LostFoundClaim.findOne({ _id: claimId, report: id })
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' })
        if (claim.claimant.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only the claimant can reply to a request for more information' })
        if (claim.status !== 'more_info_requested') return res.status(409).json({ success: false, message: 'This claim is not waiting for more information' })
        claim.message = message
        claim.status = 'pending'
        claim.reviewerNote = ''
        claim.reviewedBy = undefined
        await claim.save()
        const report = await LostFoundReport.findById(id).select('reportedBy')
        if (report) await notifyLostFound({ recipient: report.reportedBy, type: 'lost_found', title: 'Claimant provided more details', message: 'A claimant replied with the requested information.', lostFoundReport: id })
        res.json({ success: true, claim: { _id: claim._id, report: claim.report, message: claim.message, status: claim.status, createdAt: claim.createdAt, updatedAt: claim.updatedAt } })
    } catch (error) { next(error) }
}

async function adminClaims(req, res, next) {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20))
        const [claims, total] = await Promise.all([
            LostFoundClaim.find().populate({ path: 'report', select: 'title type status reportedBy', populate: { path: 'reportedBy', select: claimantFields } }).populate('claimant', claimantFields).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            LostFoundClaim.countDocuments(),
        ])
        res.json({ success: true, claims, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) { next(error) }
}

module.exports = { submitClaim, updateClaim, replyToClaim, myClaims, adminClaims, serializeClaimForUser }
