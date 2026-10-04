const { generateDescription, estimatePrice, AIServiceError } = require('../services/aiService')

const conditions = ['New', 'Like New', 'Good', 'Fair']
const fields = ['title', 'category', 'condition', 'college', 'details']
const estimateFields = ['title', 'category', 'condition', 'age', 'originalPrice', 'details']

function validateRequest(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'A JSON request body is required'
    }

    if (Object.keys(body).some((field) => !fields.includes(field))) {
        return 'Only title, category, condition, college, and details are accepted'
    }

    for (const field of fields) {
        if (typeof body[field] !== 'string' || !body[field].trim()) {
            return `${field} is required`
        }
    }

    if (body.title.trim().length > 120) return 'title must be 120 characters or fewer'
    if (body.category.trim().length > 80) return 'category must be 80 characters or fewer'
    if (!conditions.includes(body.condition)) return `condition must be one of: ${conditions.join(', ')}`
    if (body.college.trim().length > 120) return 'college must be 120 characters or fewer'
    if (body.details.trim().length > 2000) return 'details must be 2000 characters or fewer'

    return null
}

function validateEstimateRequest(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'A JSON request body is required'
    }

    if (Object.keys(body).some((field) => !estimateFields.includes(field))) {
        return 'Only title, category, condition, age, originalPrice, and details are accepted'
    }

    for (const field of ['title', 'category', 'condition', 'age', 'details']) {
        if (typeof body[field] !== 'string' || !body[field].trim()) {
            return `${field} is required`
        }
    }

    if (body.title.trim().length > 120) return 'title must be 120 characters or fewer'
    if (body.category.trim().length > 80) return 'category must be 80 characters or fewer'
    if (!conditions.includes(body.condition)) return `condition must be one of: ${conditions.join(', ')}`
    if (body.age.trim().length > 100 || /^(unknown|not sure|n\/?a|not provided)$/i.test(body.age.trim())) {
        return 'Provide the item age to estimate its resale price'
    }
    if (body.details.trim().length < 8) return 'Add more item details to get a useful estimate'
    if (body.details.trim().length > 2000) return 'details must be 2000 characters or fewer'

    const originalPrice = typeof body.originalPrice === 'number'
        ? body.originalPrice
        : typeof body.originalPrice === 'string'
            ? Number(body.originalPrice.trim())
            : NaN
    if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
        return 'originalPrice must be a number greater than zero'
    }

    return null
}

async function createDescription(req, res) {
    const validationError = validateRequest(req.body)
    if (validationError) {
        return res.status(400).json({ success: false, message: validationError })
    }

    try {
        const description = await generateDescription({
            title: req.body.title.trim(),
            category: req.body.category.trim(),
            condition: req.body.condition,
            college: req.body.college.trim(),
            details: req.body.details.trim(),
        })
        res.json({ description })
    } catch (error) {
        const statusCode = error instanceof AIServiceError ? error.statusCode : 502
        if (statusCode >= 500) {
            console.error('AI description generation failed:', error.message)
        }
        res.status(statusCode).json({ success: false, message: error.message || 'AI description generation failed' })
    }
}

async function createPriceEstimate(req, res) {
    const validationError = validateEstimateRequest(req.body)
    if (validationError) {
        return res.status(400).json({ success: false, message: validationError })
    }

    try {
        const estimate = await estimatePrice({
            title: req.body.title.trim(),
            category: req.body.category.trim(),
            condition: req.body.condition,
            age: req.body.age.trim(),
            originalPrice: Number(req.body.originalPrice),
            details: req.body.details.trim(),
        })
        res.json(estimate)
    } catch (error) {
        const statusCode = error instanceof AIServiceError ? error.statusCode : 502
        if (statusCode >= 500) {
            console.error('AI price estimation failed:', error.message)
        }
        res.status(statusCode).json({ success: false, message: error.message || 'AI price estimation failed' })
    }
}

module.exports = { createDescription, createPriceEstimate, validateEstimateRequest }
