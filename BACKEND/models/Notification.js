const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: ['message', 'product_sold', 'wishlist', 'system', 'offer', 'coupon', 'challenge', 'poll'],
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500,
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        default: undefined,
    },
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        default: undefined,
    },
    campusExchange: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CampusExchange',
        default: undefined,
    },
    isRead: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true })

notificationSchema.index({ recipient: 1, createdAt: -1 })
notificationSchema.index({ recipient: 1, isRead: 1 })

module.exports = mongoose.model('Notification', notificationSchema)
