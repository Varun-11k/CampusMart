const mongoose = require('mongoose')
const LostFoundReport = require('../models/LostFoundReport')
const LostFoundClaim = require('../models/LostFoundClaim')

const claimantFields = 'name college profileImage'

async function submitClaim(req, res, next) {
    try {
        const { id } = req.params
        const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid report ID' })
        if (!message || message.length > 1000) return res.status(400).json({ success: false, message: 'A claim message of 1 to 1000 characters is required' })
        if (Object.keys(req.body || {}).some((key) => key !== 'message')) return res.status(400).json({ success: false, message: 'Only message is accepted' })
        const report = await LostFoundReport.findById(id).select('reportedBy status')
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' })
        if (report.reportedBy.toString() === req.user._id.toString()) return res.status(403).json({ success: false, message: 'You cannot claim your own report' })
        if (report.status !== 'active') return res.status(409).json({ success: false, message: 'Claims are only allowed on active reports' })
        const claim = await LostFoundClaim.create({ report: report._id, claimant: req.user._id, message })
        await claim.populate('claimant', claimantFields)
        res.status(201).json({ success: true, claim })
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'You have already submitted a claim for this report' })
        next(error)
    }
}

async function updateClaim(req, res, next) {
    try {
        const { id, claimId } = req.params
        if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(claimId)) return res.status(400).json({ success: false, message: 'Invalid report or claim ID' })
        if (Object.keys(req.body || {}).length !== 1 || !['approved', 'rejected'].includes(req.body?.status)) return res.status(400).json({ success: false, message: 'status must be approved or rejected' })
        const report = await LostFoundReport.findById(id)
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' })
        if (report.reportedBy.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only the report owner can manage claims' })
        if (report.status !== 'active') return res.status(409).json({ success: false, message: 'This report is no longer accepting claim decisions' })
        const claim = await LostFoundClaim.findOne({ _id: claimId, report: report._id })
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' })
        if (claim.claimant.toString() === req.user._id.toString()) return res.status(403).json({ success: false, message: 'You cannot manage your own claim' })
        claim.status = req.body.status
        await claim.save()
        if (claim.status === 'approved') report.status = 'claimed'
        await report.save()
        await claim.populate('claimant', claimantFields)
        res.json({ success: true, claim, report })
    } catch (error) { next(error) }
}

async function myClaims(req, res, next) {
    try {
        const claims = await LostFoundClaim.find({ claimant: req.user._id }).populate({ path: 'report', populate: { path: 'reportedBy', select: claimantFields } }).sort({ createdAt: -1 }).lean()
        res.json({ success: true, claims })
    } catch (error) { next(error) }
}

module.exports = { submitClaim, updateClaim, myClaims }
