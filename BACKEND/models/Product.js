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
        maxlength: 80,
    },
    subcategory: {
        type: String,
        default: '',
        trim: true,
        maxlength: 80,
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
        default: '',
        trim: true,
        maxlength: 120,
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['available', 'sold', 'reserved', 'archived'],
        default: 'available',
    },
    quantity: {
        type: Number,
        min: 0,
        max: 10000,
        default: 1,
    },
    brand: {
        type: String,
        default: '',
        trim: true,
        maxlength: 80,
    },
    specifications: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1200,
    },
    negotiable: {
        type: Boolean,
        default: false,
    },
    salePreference: {
        type: String,
        enum: ['sale', 'exchange', 'both'],
        default: 'sale',
    },
    location: {
        type: String,
        default: '',
        trim: true,
        maxlength: 160,
    },
    contactMethod: {
        type: String,
        enum: ['chat'],
        default: 'chat',
    },
    moderationStatus: {
        type: String,
        enum: ['active', 'hidden', 'removed'],
        default: 'active',
        index: true,
    },
}, { timestamps: true })

productSchema.index({ seller: 1, createdAt: -1 })
productSchema.index({ status: 1, moderationStatus: 1, createdAt: -1 })
productSchema.index({ category: 1, subcategory: 1, status: 1, price: 1 })
productSchema.index({ title: 'text', description: 'text', brand: 'text', category: 'text', subcategory: 'text' })

module.exports = mongoose.model('Product', productSchema)