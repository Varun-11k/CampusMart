const mongoose = require('mongoose')
const Notification = require('../models/Notification')

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

function notificationQuery(userId) {
    return Notification.find({ recipient: userId })
        .populate('product', 'title images status')
        .populate('conversation', 'product')
        .populate('campusExchange', 'title images status')
}

async function getNotifications(req, res, next) {
    try {
        const requestedLimit = Number.parseInt(req.query.limit, 10)
        const requestedPage = Number.parseInt(req.query.page, 10)
        const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT
        const page = Number.isInteger(requestedPage) ? Math.max(requestedPage, 1) : 1
        const filter = { recipient: req.user._id }
        const [notifications, total] = await Promise.all([
            notificationQuery(req.user._id).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
            Notification.countDocuments(filter),
        ])

        res.json({
            success: true,
            notifications,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        })
    } catch (error) {
        next(error)
    }
}

async function getUnreadCount(req, res, next) {
    try {
        const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false })
        res.json({ success: true, count })
    } catch (error) {
        next(error)
    }
}

async function markNotificationRead(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid notification ID' })
        }

        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user._id },
            { $set: { isRead: true } },
            { new: true, runValidators: true }
        ).populate('product', 'title images status').populate('conversation', 'product').populate('campusExchange', 'title images status')

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' })
        }

        res.json({ success: true, notification })
    } catch (error) {
        next(error)
    }
}

async function markAllNotificationsRead(req, res, next) {
    try {
        const result = await Notification.updateMany(
            { recipient: req.user._id, isRead: false },
            { $set: { isRead: true } }
        )
        res.json({ success: true, modifiedCount: result.modifiedCount })
    } catch (error) {
        next(error)
    }
}

async function deleteNotification(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid notification ID' })
        }

        const result = await Notification.deleteOne({ _id: req.params.id, recipient: req.user._id })
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Notification not found' })
        }

        res.json({ success: true, message: 'Notification deleted' })
    } catch (error) {
        next(error)
    }
}

module.exports = {
    getNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
}
