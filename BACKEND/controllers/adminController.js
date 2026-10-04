const mongoose = require('mongoose')
const Product = require('../models/Product')
const Report = require('../models/Report')
const User = require('../models/User')
const CampusVoice = require('../models/CampusVoice')
const Resource = require('../models/Resource')
const CampusExchange = require('../models/CampusExchange')

const reportStatuses = ['pending', 'reviewing', 'resolved', 'dismissed']
const moderationStatuses = ['active', 'hidden', 'removed']
const productFields = 'title description price category condition images college seller status moderationStatus createdAt updatedAt'
const sellerFields = 'name college profileImage'
const reporterFields = 'name email college role createdAt'

function populatedReport(query) {
    return query
        .populate('reporter', reporterFields)
        .populate('reportedUser', reporterFields)
        .populate({ path: 'voicePost', select: 'content category status createdAt author' })
        .populate({ path: 'resource', select: 'title description type subject course semester year fileUrl externalUrl status uploadedBy' })
        .populate({ path: 'campusExchange', select: 'title description category condition offeredItem wantedItem location images owner status moderationStatus createdAt' })
        .populate({
            path: 'product',
            select: productFields,
            populate: { path: 'seller', select: sellerFields },
        })
}

async function getOverview(req, res, next) {
    try {
        const [totalUsers, totalProducts, pendingReports, resolvedReports] = await Promise.all([
            User.countDocuments(),
            Product.countDocuments(),
            Report.countDocuments({ status: 'pending' }),
            Report.countDocuments({ status: 'resolved' }),
        ])

        res.json({
            success: true,
            overview: { totalUsers, totalProducts, pendingReports, resolvedReports },
        })
    } catch (error) {
        next(error)
    }
}

async function getReports(req, res, next) {
    try {
        const { status } = req.query
        if (status && !reportStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `status must be one of: ${reportStatuses.join(', ')}` })
        }

        const requestedPage = Number.parseInt(req.query.page, 10)
        const requestedLimit = Number.parseInt(req.query.limit, 10)
        const page = Number.isInteger(requestedPage) ? Math.max(requestedPage, 1) : 1
        const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50
        const filter = status ? { status } : {}
        const [reports, total] = await Promise.all([
            populatedReport(Report.find(filter)).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
            Report.countDocuments(filter),
        ])

        res.json({ success: true, reports, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) {
        next(error)
    }
}

async function getReport(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid report ID' })
        }

        const report = await populatedReport(Report.findById(req.params.id))
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' })
        res.json({ success: true, report })
    } catch (error) {
        next(error)
    }
}

async function updateReport(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid report ID' })
        }

        const updates = req.body || {}
        const allowedFields = ['status', 'adminNote', 'voicePostStatus', 'resourceStatus', 'campusExchangeStatus']
        const updateFields = Object.keys(updates)
        if (updateFields.length === 0 || updateFields.some((field) => !allowedFields.includes(field))) {
            return res.status(400).json({ success: false, message: 'Provide status, adminNote, voicePostStatus, resourceStatus, and/or campusExchangeStatus only' })
        }

        if (Object.hasOwn(updates, 'status') && !reportStatuses.includes(updates.status)) {
            return res.status(400).json({ success: false, message: `status must be one of: ${reportStatuses.join(', ')}` })
        }

        if (Object.hasOwn(updates, 'adminNote') && (typeof updates.adminNote !== 'string' || updates.adminNote.length > 1000)) {
            return res.status(400).json({ success: false, message: 'adminNote must be a string of at most 1000 characters' })
        }
        if (Object.hasOwn(updates, 'voicePostStatus') && !['active', 'hidden', 'removed'].includes(updates.voicePostStatus)) {
            return res.status(400).json({ success: false, message: 'voicePostStatus must be active, hidden, or removed' })
        }
        if (Object.hasOwn(updates, 'resourceStatus') && !['active', 'hidden', 'removed'].includes(updates.resourceStatus)) return res.status(400).json({ success: false, message: 'resourceStatus must be active, hidden, or removed' })
        if (Object.hasOwn(updates, 'campusExchangeStatus') && !moderationStatuses.includes(updates.campusExchangeStatus)) return res.status(400).json({ success: false, message: 'campusExchangeStatus must be active, hidden, or removed' })

        const report = await Report.findById(req.params.id)
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' })

        if (Object.hasOwn(updates, 'voicePostStatus')) {
            if (!report.voicePost) return res.status(400).json({ success: false, message: 'This report is not for a Campus Voice post' })
            await CampusVoice.updateOne({ _id: report.voicePost }, { $set: { status: updates.voicePostStatus } })
        }
        if (Object.hasOwn(updates, 'resourceStatus')) {
            if (!report.resource) return res.status(400).json({ success: false, message: 'This report is not for a resource' })
            await Resource.updateOne({ _id: report.resource }, { $set: { status: updates.resourceStatus } })
        }
        if (Object.hasOwn(updates, 'campusExchangeStatus')) {
            if (!report.campusExchange) return res.status(400).json({ success: false, message: 'This report is not for a Campus Exchange listing' })
            await CampusExchange.updateOne({ _id: report.campusExchange }, { $set: { moderationStatus: updates.campusExchangeStatus } })
        }

        if (Object.hasOwn(updates, 'status')) report.status = updates.status
        if (Object.hasOwn(updates, 'adminNote')) report.adminNote = updates.adminNote.trim()
        await report.save()

        const updatedReport = await populatedReport(Report.findById(report._id))
        res.json({ success: true, report: updatedReport })
    } catch (error) {
        next(error)
    }
}

async function getProducts(req, res, next) {
    try {
        const requestedPage = Number.parseInt(req.query.page, 10)
        const requestedLimit = Number.parseInt(req.query.limit, 10)
        const page = Number.isInteger(requestedPage) ? Math.max(requestedPage, 1) : 1
        const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50
        const filter = {}

        if (req.query.moderationStatus) {
            if (!moderationStatuses.includes(req.query.moderationStatus)) {
                return res.status(400).json({ success: false, message: `moderationStatus must be one of: ${moderationStatuses.join(', ')}` })
            }
            filter.moderationStatus = req.query.moderationStatus
        }

        const [products, total] = await Promise.all([
            Product.find(filter).populate('seller', sellerFields).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
            Product.countDocuments(filter),
        ])

        res.json({ success: true, products, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) {
        next(error)
    }
}

async function moderateProduct(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' })
        }

        const body = req.body || {}
        if (Object.keys(body).length !== 1 || !Object.hasOwn(body, 'moderationStatus')) {
            return res.status(400).json({ success: false, message: 'Provide moderationStatus only' })
        }

        const { moderationStatus } = body
        if (!moderationStatuses.includes(moderationStatus)) {
            return res.status(400).json({ success: false, message: `moderationStatus must be one of: ${moderationStatuses.join(', ')}` })
        }

        const product = await Product.findById(req.params.id)
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' })

        product.moderationStatus = moderationStatus
        await product.save()
        await product.populate('seller', sellerFields)
        res.json({ success: true, product })
    } catch (error) {
        next(error)
    }
}

async function getUser(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' })
        }

        const user = await User.findById(req.params.id)
            .select('name email college profileImage role isVerified createdAt updatedAt')

        if (!user) return res.status(404).json({ success: false, message: 'User not found' })
        res.json({ success: true, user })
    } catch (error) {
        next(error)
    }
}

module.exports = { getOverview, getReports, getReport, updateReport, getProducts, moderateProduct, getUser }
