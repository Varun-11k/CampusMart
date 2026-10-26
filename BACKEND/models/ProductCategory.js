const mongoose = require('mongoose')

const productCategorySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 90 },
    aliases: { type: [String], default: [] },
    subcategories: { type: [String], default: [] },
    active: { type: Boolean, default: true },
}, { timestamps: true })

productCategorySchema.index({ active: 1, name: 1 })

module.exports = mongoose.model('ProductCategory', productCategorySchema)
