const mongoose = require('mongoose')

const campusPointTransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    action: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80,
    },
    points: {
        type: Number,
        required: true,
    },
    referenceType: {
        type: String,
        trim: true,
        default: null,
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 200,
    },
}, { timestamps: true })

campusPointTransactionSchema.index({ user: 1, action: 1, referenceType: 1, referenceId: 1 }, { unique: true, sparse: true })
campusPointTransactionSchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.model('CampusPointTransaction', campusPointTransactionSchema)
