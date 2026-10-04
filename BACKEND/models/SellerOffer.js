const mongoose = require('mongoose')

const sellerOfferSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true,
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    offerPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    quantity: {
        type: Number,
        default: 1,
        min: 1,
    },
    startTime: {
        type: Date,
        required: true,
        default: Date.now,
    },
    endTime: {
        type: Date,
        required: true,
        validate: { validator(value) { return !this.startTime || value > this.startTime }, message: 'endTime must be after startTime' },
    },
    status: {
        type: String,
        enum: ['scheduled', 'active', 'expired', 'cancelled'],
        default: 'scheduled',
        index: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true })

sellerOfferSchema.index({ product: 1, seller: 1, endTime: -1 })
sellerOfferSchema.index({ status: 1, endTime: 1 })
sellerOfferSchema.index({ status: 1, startTime: 1, endTime: 1 })

module.exports = mongoose.model('SellerOffer', sellerOfferSchema)
