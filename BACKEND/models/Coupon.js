const mongoose = require('mongoose')

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        unique: true,
        maxlength: 40,
    },
    type: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true,
    },
    value: {
        type: Number,
        required: true,
        min: 0,
    },
    minimumPurchase: {
        type: Number,
        default: 0,
        min: 0,
    },
    maximumDiscount: {
        type: Number,
        default: 0,
        min: 0,
    },
    startDate: {
        type: Date,
        default: Date.now,
    },
    expiryDate: {
        type: Date,
        required: true,
    },
    usageLimit: {
        type: Number,
        default: 1,
        min: 1,
    },
    perUserLimit: {
        type: Number,
        default: 1,
        min: 1,
    },
    active: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    usageCount: {
        type: Number,
        default: 0,
        min: 0,
    },
}, { timestamps: true })

couponSchema.index({ active: 1, expiryDate: 1 })
couponSchema.index({ createdBy: 1, createdAt: -1 })

module.exports = mongoose.model('Coupon', couponSchema)
