const mongoose = require('mongoose')

const couponRedemptionSchema = new mongoose.Schema({
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    purchaseAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0 },
}, { timestamps: true })

couponRedemptionSchema.index({ coupon: 1, user: 1 }, { unique: true })
couponRedemptionSchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.model('CouponRedemption', couponRedemptionSchema)
