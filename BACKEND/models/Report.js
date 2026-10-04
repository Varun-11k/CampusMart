const mongoose = require('mongoose')

const reportSchema = new mongoose.Schema({
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        default: undefined,
    },
    voicePost: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CampusVoice',
        default: undefined,
    },
    resource: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Resource',
        default: undefined,
    },
    campusExchange: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CampusExchange',
        default: undefined,
    },
    reportedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: undefined,
    },
    reason: {
        type: String,
        required: true,
        enum: ['scam', 'incorrect_information', 'spam', 'prohibited_item', 'harassment', 'inappropriate_content', 'personal_information', 'copyright_concern', 'incorrect_resource', 'malicious_link', 'other'],
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: '',
    },
    status: {
        type: String,
        enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
        default: 'pending',
    },
    adminNote: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: '',
    },
}, { timestamps: true })

reportSchema.index({ reporter: 1, product: 1, status: 1 })
reportSchema.index({ reporter: 1, voicePost: 1, status: 1 })
reportSchema.index({ reporter: 1, resource: 1, status: 1 })
reportSchema.index({ reporter: 1, campusExchange: 1, status: 1 })
reportSchema.index({ status: 1, createdAt: -1 })

module.exports = mongoose.model('Report', reportSchema)
