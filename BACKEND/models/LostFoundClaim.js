const mongoose = require('mongoose')

const lostFoundClaimSchema = new mongoose.Schema({
    report: { type: mongoose.Schema.Types.ObjectId, ref: 'LostFoundReport', required: true },
    claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true })

lostFoundClaimSchema.index({ report: 1, claimant: 1 }, { unique: true })
lostFoundClaimSchema.index({ report: 1, createdAt: -1 })
lostFoundClaimSchema.index({ claimant: 1, createdAt: -1 })

module.exports = mongoose.model('LostFoundClaim', lostFoundClaimSchema)
