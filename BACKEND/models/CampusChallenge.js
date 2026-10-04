const mongoose = require('mongoose')

const challengeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500,
    },
    type: {
        type: String,
        enum: ['exchange', 'resource', 'lost_found', 'marketplace', 'community'],
        required: true,
    },
    target: {
        type: Number,
        required: true,
        min: 1,
    },
    rewardPoints: {
        type: Number,
        required: true,
        min: 0,
    },
    startDate: {
        type: Date,
        required: true,
        default: Date.now,
    },
    endDate: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'closed'],
        default: 'active',
        index: true,
    },
}, { timestamps: true })

challengeSchema.index({ status: 1, startDate: -1 })
challengeSchema.index({ endDate: 1 })

module.exports = mongoose.model('CampusChallenge', challengeSchema)
