const mongoose = require('mongoose')

const moderationEntrySchema = new mongoose.Schema({
    action: { type: String, enum: ['approved', 'hidden', 'rejected', 'removed', 'restored'], required: true },
    moderator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, maxlength: 1000, default: '' },
    createdAt: { type: Date, default: Date.now },
}, { _id: false })

const campusVoiceSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        select: false,
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 3000,
    },
    category: {
        type: String,
        enum: ['confession', 'question', 'suggestion', 'experience', 'opinion'],
        required: true,
        index: true,
    },
    isAnonymous: {
        type: Boolean,
        default: true,
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'hidden', 'rejected', 'removed'],
        default: 'active',
        index: true,
    },
    likes: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], select: false },
    authorDeletedAt: { type: Date, default: null, select: false },
    moderationHistory: { type: [moderationEntrySchema], default: [], select: false },
}, { timestamps: true })

campusVoiceSchema.index({ status: 1, createdAt: -1 })
campusVoiceSchema.index({ status: 1, category: 1, createdAt: -1 })
campusVoiceSchema.index({ content: 'text' })
campusVoiceSchema.index({ author: 1, createdAt: -1 })

module.exports = mongoose.model('CampusVoice', campusVoiceSchema)
