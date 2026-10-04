const mongoose = require('mongoose')

const priceDropNoticeSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    previousPrice: { type: Number, required: true, min: 0 },
    currentPrice: { type: Number, required: true, min: 0 },
}, { timestamps: true })

priceDropNoticeSchema.index({ user: 1, product: 1, previousPrice: 1, currentPrice: 1 }, { unique: true })

module.exports = mongoose.model('PriceDropNotice', priceDropNoticeSchema)
