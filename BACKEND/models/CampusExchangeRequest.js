const mongoose = require('mongoose')

const exchangeRequestSchema = new mongoose.Schema({
    exchange: { type: mongoose.Schema.Types.ObjectId, ref: 'CampusExchange', required: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    proposal: { type: String, trim: true, maxlength: 200, default: '' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'cancelled'], default: 'pending', index: true },
}, { timestamps: true })

exchangeRequestSchema.index({ exchange: 1, createdAt: -1 })
exchangeRequestSchema.index({ requester: 1, createdAt: -1 })
exchangeRequestSchema.index({ exchange: 1, requester: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } })

module.exports = mongoose.model('CampusExchangeRequest', exchangeRequestSchema)
