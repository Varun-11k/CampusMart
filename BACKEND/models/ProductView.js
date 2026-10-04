const mongoose = require('mongoose')

const productViewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    lastViewedAt: {
        type: Date,
        required: true,
        default: Date.now,
    },
})

productViewSchema.index({ user: 1, product: 1 }, { unique: true })
productViewSchema.index({ user: 1, lastViewedAt: -1 })
productViewSchema.index({ lastViewedAt: -1, product: 1 })

module.exports = mongoose.model('ProductView', productViewSchema)
