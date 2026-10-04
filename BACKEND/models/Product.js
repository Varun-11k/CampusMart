const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    category: {
        type: String,
        required: true,
        trim: true,
    },
    condition: {
        type: String,
        required: true,
        enum: ['New', 'Like New', 'Good', 'Fair'],
    },
    images: {
        type: [String],
        default: [],
    },
    college: {
        type: String,
        required: true,
        trim: true,
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['available', 'sold', 'reserved'],
        default: 'available',
    },
    moderationStatus: {
        type: String,
        enum: ['active', 'hidden', 'removed'],
        default: 'active',
        index: true,
    },
}, { timestamps: true })

module.exports = mongoose.model('Product', productSchema)