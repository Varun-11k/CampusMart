const mongoose = require('mongoose')

const campusFeedCommentSchema = new mongoose.Schema({
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'CampusFeedPost', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'CampusFeedComment', default: null, index: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    likes: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [], select: false },
    status: { type: String, enum: ['active', 'hidden', 'removed'], default: 'active', index: true },
}, { timestamps: true })

campusFeedCommentSchema.index({ post: 1, createdAt: 1 })
campusFeedCommentSchema.index({ post: 1, parentComment: 1, createdAt: 1 })

module.exports = mongoose.model('CampusFeedComment', campusFeedCommentSchema)