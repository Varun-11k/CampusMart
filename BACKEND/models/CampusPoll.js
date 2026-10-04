const mongoose = require('mongoose')

const campusPollSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    options: [{
        type: String,
        required: true,
        trim: true,
        maxlength: 80,
    }],
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active',
        index: true,
    },
    endDate: {
        type: Date,
        default: null,
    },
    votes: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        optionIndex: { type: Number, required: true, min: 0 },
    }],
}, { timestamps: true })

campusPollSchema.index({ status: 1, createdAt: -1 })
campusPollSchema.index({ author: 1, createdAt: -1 })

module.exports = mongoose.model('CampusPoll', campusPollSchema)
