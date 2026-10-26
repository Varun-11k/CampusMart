const ProductCategory = require('../models/ProductCategory')
const { ensureDefaultCategories, getActiveCategories, slugify } = require('../services/productCategoryService')

function validateCategory(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 'A JSON request body is required.'
    if (Object.keys(body).some((key) => !['name', 'subcategories', 'active'].includes(key))) return 'Only name, subcategories, and active are accepted.'
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80) return 'Category name must be 2 to 80 characters.'
    if (body.subcategories !== undefined && (!Array.isArray(body.subcategories) || body.subcategories.length > 50 || body.subcategories.some((item) => typeof item !== 'string' || item.trim().length < 2 || item.trim().length > 80))) {
        return 'Subcategories must be a list of up to 50 names, each 2 to 80 characters.'
    }
    if (body.active !== undefined && typeof body.active !== 'boolean') return 'active must be true or false.'
    return null
}

async function createCategory(req, res, next) {
    try {
        const validationError = validateCategory(req.body)
        if (validationError) return res.status(400).json({ success: false, message: validationError })
        const name = req.body.name.trim()
        const category = await ProductCategory.create({
            name,
            slug: slugify(name),
            subcategories: [...new Set((req.body.subcategories || []).map((item) => item.trim()))],
        })
        res.status(201).json({ success: true, category })
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'That marketplace category already exists.' })
        next(error)
    }
}

async function updateCategory(req, res, next) {
    try {
        const validationError = validateCategory(req.body)
        if (validationError) return res.status(400).json({ success: false, message: validationError })
        const category = await ProductCategory.findById(req.params.id)
        if (!category) return res.status(404).json({ success: false, message: 'Marketplace category not found.' })
        if (category.name !== req.body.name.trim()) return res.status(400).json({ success: false, message: 'Category names cannot be changed after listings use them. Deactivate and create a new category instead.' })
        if (req.body.subcategories !== undefined) category.subcategories = [...new Set(req.body.subcategories.map((item) => item.trim()))]
        if (req.body.active !== undefined) category.active = req.body.active
        await category.save()
        res.json({ success: true, category })
    } catch (error) {
        next(error)
    }
}

async function listCategories(req, res, next) {
    try {
        const categories = await getActiveCategories()
        res.json({ success: true, categories })
    } catch (error) {
        next(error)
    }
}

async function listAdminCategories(req, res, next) {
    try {
        await ensureDefaultCategories()
        const categories = await ProductCategory.find().sort({ name: 1 }).lean()
        res.json({ success: true, categories })
    } catch (error) {
        next(error)
    }
}

module.exports = { validateCategory, listCategories, listAdminCategories, createCategory, updateCategory }
