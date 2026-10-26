const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 80,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    college: {
        type: String,
        default: '',
        trim: true,
        maxlength: 120,
    },
    course: {
        type: String,
        default: '',
        trim: true,
        maxlength: 120,
    },
    branch: {
        type: String,
        default: '',
        trim: true,
        maxlength: 120,
    },
    academicYear: {
        type: String,
        enum: ['', '1', '2', '3', '4', '5', 'graduate', 'other'],
        default: '',
    },
    themePreference: {
        type: String,
        enum: ['light', 'dark'],
        default: 'light',
    },
    password: {
        type: String,
        required: function passwordRequired() { return this.isNew && !this.googleId },
        minlength: 12,
        select: false,
    },
    authProviders: {
        type: [{ type: String, enum: ['password', 'google'] }],
        default: ['password'],
        select: false,
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
        select: false,
    },
    profileImage: {
        type: String,
        default: undefined,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    role: {
        type: String,
        enum: ['student', 'admin'],
        default: 'student',
    },
    tokenVersion: {
        type: Number,
        default: 0,
        select: false,
    },
    deactivatedAt: {
        type: Date,
        default: null,
        select: false,
    },
}, { timestamps: true })

module.exports = mongoose.model('User', userSchema)