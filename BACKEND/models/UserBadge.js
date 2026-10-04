const mongoose = require('mongoose')

const userBadgeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    badge: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Badge',
        required: true,
        index: true,
    },
    earnedAt: {
        type: Date,
        default: Date.now,
    },
})

userBadgeSchema.index({ user: 1, badge: 1 }, { unique: true })

module.exports = mongoose.model('UserBadge', userBadgeSchema)
