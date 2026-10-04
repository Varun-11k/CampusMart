const mongoose = require('mongoose')

const exchangeSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    condition: { type: String, enum: ['New', 'Like New', 'Good', 'Fair'], required: true },
    offeredItem: { type: String, required: true, trim: true, maxlength: 200 },
    wantedItem: { type: String, required: true, trim: true, maxlength: 200 },
    openToOffers: { type: Boolean, default: false },
    location: { type: String, required: true, trim: true, maxlength: 120 },
    images: { type: [String], default: [], validate: { validator: (images) => images.length <= 5, message: 'You can upload up to 5 images' } },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['active', 'exchanged', 'closed'], default: 'active', index: true },
    moderationStatus: { type: String, enum: ['active', 'hidden', 'removed'], default: 'active', index: true },
}, { timestamps: true })

exchangeSchema.index({ status: 1, createdAt: -1 })
exchangeSchema.index({ status: 1, category: 1, createdAt: -1 })
exchangeSchema.index({ status: 1, condition: 1, createdAt: -1 })
exchangeSchema.index({ status: 1, location: 1, createdAt: -1 })
exchangeSchema.index({ title: 'text', description: 'text', offeredItem: 'text', wantedItem: 'text', category: 'text' })
exchangeSchema.index({ owner: 1, createdAt: -1 })

module.exports = mongoose.model('CampusExchange', exchangeSchema)
