const ProductCategory = require('../models/ProductCategory')

const DEFAULT_CATEGORIES = [
    { name: 'Books and Study Materials', subcategories: ['Textbooks', 'Reference Books', 'Exam Prep', 'Notes and Guides', 'Lab Materials'], aliases: ['Books', 'Study Materials'] },
    { name: 'Electronics and Gadgets', subcategories: ['Laptops', 'Phones', 'Tablets', 'Audio', 'Accessories'], aliases: ['Electronics'] },
    { name: 'Clothing and Fashion', subcategories: ['Clothing', 'Traditional Wear', 'Bags'], aliases: ['Fashion', 'Clothing'] },
    { name: 'Shoes and Accessories', subcategories: ['Shoes', 'Watches', 'Jewellery', 'Accessories'], aliases: ['Accessories', 'Shoes'] },
    { name: 'Furniture and Room Essentials', subcategories: ['Furniture', 'Lighting', 'Bedding', 'Storage'], aliases: ['Furniture', 'Hostel'] },
    { name: 'Hostel and Daily-use Items', subcategories: ['Kitchen', 'Appliances', 'Cleaning', 'Daily Use'], aliases: ['Hostel Essentials', 'Daily-use Items'] },
    { name: 'Sports and Fitness Equipment', subcategories: ['Sports Equipment', 'Fitness', 'Outdoor'], aliases: ['Sports'] },
    { name: 'Stationery and Art Supplies', subcategories: ['Writing', 'Paper', 'Art Supplies', 'Calculators'], aliases: ['Stationery', 'Art Supplies'] },
    { name: 'Gaming Accessories', subcategories: ['Controllers', 'Consoles', 'PC Accessories'], aliases: ['Gaming'] },
    { name: 'Bicycles and Transport Accessories', subcategories: ['Bicycles', 'Helmets', 'Transport Accessories'], aliases: ['Transport'] },
    { name: 'Musical Instruments', subcategories: ['Instruments', 'Audio Equipment', 'Accessories'], aliases: ['Music'] },
    { name: 'Other Permitted Items', subcategories: [], aliases: ['Other'] },
]
let defaultSeedPromise

function slugify(value) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function ensureDefaultCategories() {
    if (!defaultSeedPromise) defaultSeedPromise = ProductCategory.bulkWrite(DEFAULT_CATEGORIES.map((category) => ({
        updateOne: {
            filter: { slug: slugify(category.name) },
            update: { $setOnInsert: { ...category, slug: slugify(category.name), active: true } },
            upsert: true,
        },
    })), { ordered: false }).catch((error) => {
        defaultSeedPromise = null
        throw error
    })
    await defaultSeedPromise
}

async function getActiveCategories() {
    await ensureDefaultCategories()
    return ProductCategory.find({ active: true }).select('name slug aliases subcategories').sort({ name: 1 }).lean()
}

async function resolveCategory(value) {
    await ensureDefaultCategories()
    return ProductCategory.findOne({
        active: true,
        $or: [{ name: value }, { aliases: value }, { slug: value }],
    }).lean()
}

module.exports = { DEFAULT_CATEGORIES, slugify, ensureDefaultCategories, getActiveCategories, resolveCategory }
