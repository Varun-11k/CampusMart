const Notification = require('../models/Notification')
const { getIO } = require('../socketManager')

async function createAndEmitNotification(notificationData) {
    const notification = await Notification.create(notificationData)
    const populatedNotification = await Notification.findById(notification._id)
        .populate('product', 'title images status')
        .populate('conversation', 'product')
        .populate('campusExchange', 'title images status')
        .populate('lostFoundReport', 'title type status')

    getIO()?.to(`user:${notification.recipient.toString()}`).emit('notification', {
        notification: populatedNotification,
    })

    return populatedNotification
}

module.exports = { createAndEmitNotification }
