const mongoose = require('mongoose')

const authTokenSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    tokenHash: {
        type: String,
        required: true,
        unique: true,
        select: false,
    },
    purpose: {
        type: String,
        enum: ['password-reset', 'email-verification', 'email-otp', 'password-reset-otp'],
        required: true,
    },
    isOtp: {
        type: Boolean,
        default: false,
    },
    attempts: {
        type: Number,
        default: 0,
    },
    expiresAt: {
        type: Date,
        required: true,
        expires: 0,
    },
    usedAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true })

module.exports = mongoose.model('AuthToken', authTokenSchema)
