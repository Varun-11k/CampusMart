const mongoose = require('mongoose')

const campusVoiceSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
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
        enum: ['active', 'hidden', 'removed'],
        default: 'active',
        index: true,
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true })

campusVoiceSchema.index({ status: 1, createdAt: -1 })
campusVoiceSchema.index({ status: 1, category: 1, createdAt: -1 })
campusVoiceSchema.index({ content: 'text' })
campusVoiceSchema.index({ author: 1, createdAt: -1 })

module.exports = mongoose.model('CampusVoice', campusVoiceSchema)
