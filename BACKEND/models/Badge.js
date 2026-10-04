const mongoose = require('mongoose')

const badgeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80,
    },
    icon: {
        type: String,
        required: true,
        trim: true,
        maxlength: 30,
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    criteria: {
        type: String,
        trim: true,
        maxlength: 200,
        default: '',
    },
    active: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true })

module.exports = mongoose.model('Badge', badgeSchema)
