const mongoose = require('mongoose')

const campusFeedFollowSchema = new mongoose.Schema({
    follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    following: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true })

campusFeedFollowSchema.index({ follower: 1, following: 1 }, { unique: true })

module.exports = mongoose.model('CampusFeedFollow', campusFeedFollowSchema)