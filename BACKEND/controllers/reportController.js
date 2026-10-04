const mongoose = require('mongoose')
const Product = require('../models/Product')
const Report = require('../models/Report')
const User = require('../models/User')
const CampusVoice = require('../models/CampusVoice')
const Resource = require('../models/Resource')
const CampusExchange = require('../models/CampusExchange')

const reasons = ['scam', 'incorrect_information', 'spam', 'prohibited_item', 'harassment', 'inappropriate_content', 'personal_information', 'copyright_concern', 'incorrect_resource', 'malicious_link', 'other']
const duplicateStatuses = ['pending', 'reviewing']

async function createReport(req, res, next) {
    try {
        const body = req.body || {}
        const allowedFields = ['productId', 'reportedUserId', 'voicePostId', 'resourceId', 'campusExchangeId', 'reason', 'description']
        if (Object.keys(body).some((field) => !allowedFields.includes(field))) {
            return res.status(400).json({ success: false, message: 'Only productId, reportedUserId, voicePostId, resourceId, campusExchangeId, reason, and description are accepted' })
        }

        const { productId, reportedUserId, voicePostId, resourceId, campusExchangeId, reason, description = '' } = body

        if (!reasons.includes(reason)) {
            return res.status(400).json({ success: false, message: `reason must be one of: ${reasons.join(', ')}` })
        }

        if (!productId && !reportedUserId && !voicePostId && !resourceId && !campusExchangeId) return res.status(400).json({ success: false, message: 'A report target is required' })
        if (voicePostId && (productId || reportedUserId)) return res.status(400).json({ success: false, message: 'A Campus Voice report must target only voicePostId' })
        if (resourceId && (productId || reportedUserId || voicePostId)) return res.status(400).json({ success: false, message: 'A resource report must target only resourceId' })
        if (campusExchangeId && (productId || reportedUserId || voicePostId || resourceId)) return res.status(400).json({ success: false, message: 'A Campus Exchange report must target only campusExchangeId' })

        if (productId && !mongoose.isValidObjectId(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' })
        }

        if (reportedUserId && !mongoose.isValidObjectId(reportedUserId)) {
            return res.status(400).json({ success: false, message: 'Invalid reported user ID' })
        }
        if (voicePostId && !mongoose.isValidObjectId(voicePostId)) {
            return res.status(400).json({ success: false, message: 'Invalid Campus Voice post ID' })
        }
        if (resourceId && !mongoose.isValidObjectId(resourceId)) return res.status(400).json({ success: false, message: 'Invalid resource ID' })
        if (campusExchangeId && !mongoose.isValidObjectId(campusExchangeId)) return res.status(400).json({ success: false, message: 'Invalid Campus Exchange ID' })

        if (typeof description !== 'string' || description.length > 1000) {
            return res.status(400).json({ success: false, message: 'description must be a string of at most 1000 characters' })
        }

        if (productId && !await Product.exists({ _id: productId })) {
            return res.status(404).json({ success: false, message: 'Product not found' })
        }
        if (voicePostId && !await CampusVoice.exists({ _id: voicePostId, status: 'active' })) {
            return res.status(404).json({ success: false, message: 'Campus Voice post not found' })
        }
        if (resourceId && !await Resource.exists({ _id: resourceId, status: 'active' })) return res.status(404).json({ success: false, message: 'Resource not found' })
        if (campusExchangeId && !await CampusExchange.exists({ _id: campusExchangeId, status: 'active', moderationStatus: 'active' })) return res.status(404).json({ success: false, message: 'Campus Exchange listing not found' })

        if (reportedUserId) {
            if (reportedUserId === req.user._id.toString()) {
                return res.status(400).json({ success: false, message: 'You cannot report yourself' })
            }
            if (!await User.exists({ _id: reportedUserId })) {
                return res.status(404).json({ success: false, message: 'Reported user not found' })
            }
        }

        if (productId) {
            const duplicate = await Report.exists({
                reporter: req.user._id,
                product: productId,
                status: { $in: duplicateStatuses },
            })
            if (duplicate) {
                return res.status(409).json({ success: false, message: 'You already have an active report for this product' })
            }
        }
        if (voicePostId) {
            const duplicate = await Report.exists({
                reporter: req.user._id,
                voicePost: voicePostId,
                status: { $in: duplicateStatuses },
            })
            if (duplicate) return res.status(409).json({ success: false, message: 'You already have an active report for this Campus Voice post' })
        }
        if (resourceId) {
            const duplicate = await Report.exists({ reporter: req.user._id, resource: resourceId, status: { $in: duplicateStatuses } })
            if (duplicate) return res.status(409).json({ success: false, message: 'You already have an active report for this resource' })
        }
        if (campusExchangeId) {
            const duplicate = await Report.exists({ reporter: req.user._id, campusExchange: campusExchangeId, status: { $in: duplicateStatuses } })
            if (duplicate) return res.status(409).json({ success: false, message: 'You already have an active report for this Campus Exchange listing' })
        }

        const report = await Report.create({
            reporter: req.user._id,
            product: productId || undefined,
            voicePost: voicePostId || undefined,
            resource: resourceId || undefined,
            campusExchange: campusExchangeId || undefined,
            reportedUser: reportedUserId || undefined,
            reason,
            description: description.trim(),
        })

        res.status(201).json({ success: true, report })
    } catch (error) {
        next(error)
    }
}

module.exports = { createReport }
