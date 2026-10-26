const mongoose = require('mongoose')
const Product = require('../models/Product')
const ProductView = require('../models/ProductView')
const Conversation = require('../models/Conversation')
const Message = require('../models/Message')
const Wishlist = require('../models/Wishlist')
const PriceDropNotice = require('../models/PriceDropNotice')
const ProductCategory = require('../models/ProductCategory')
const { getActiveCategories, resolveCategory } = require('../services/productCategoryService')
const cloudinary = require('../config/cloudinary')
const { createAndEmitNotification } = require('../services/notificationService')

const conditions = ['New', 'Like New', 'Good', 'Fair']
const statuses = ['available', 'sold', 'reserved', 'archived']
const editableFields = ['title', 'description', 'price', 'category', 'subcategory', 'condition', 'status', 'quantity', 'brand', 'specifications', 'negotiable', 'salePreference', 'location', 'contactMethod']
const sellerFields = 'name college profileImage'
const MAX_IMAGES_PER_PRODUCT = 5
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const imageSignatures = {
    'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    'image/png': (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/webp': (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
    'image/gif': (buffer) => buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6)),
}
const allowedProductFields = new Set([...editableFields, 'images'])

function validateImageUpload(file) {
    if (!file) return null

    if (!allowedImageTypes.has(file.mimetype)) {
        return 'Only JPG, PNG, WEBP, and GIF image file types are allowed.'
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        return 'Each image must be 5MB or smaller.'
    }
    if (file.buffer && !imageSignatures[file.mimetype]?.(file.buffer)) {
        return 'The uploaded file does not match a supported image format.'
    }

    return null
}

function normalizeImages(input) {
    if (!input) return []

    if (Array.isArray(input)) {
        return input
    }

    if (typeof input === 'string') {
        try {
            const parsed = JSON.parse(input)
            if (Array.isArray(parsed)) {
                return parsed
            }
        } catch {
            return input.trim() ? [input.trim()] : []
        }
    }

    return []
}

function validateProductInput(body, partial = false) {
    const requiredFields = ['title', 'description', 'price', 'category', 'condition']

    if (Object.keys(body).some((field) => !allowedProductFields.has(field))) {
        return 'The listing contains unsupported fields.'
    }
    if (!partial) {
        for (const field of requiredFields) {
            if (!Object.hasOwn(body, field)) {
                return `${field} is required`
            }
        }
    }

    for (const field of ['title', 'description', 'category']) {
        if (Object.hasOwn(body, field) && (typeof body[field] !== 'string' || !body[field].trim())) {
            return `${field} must be a non-empty string`
        }
    }

    if (Object.hasOwn(body, 'price')) {
        const price = body.price
        if ((typeof price !== 'number' && typeof price !== 'string') || String(price).trim() === '' || !Number.isFinite(Number(price)) || Number(price) < 0) {
            return 'price must be a non-negative number'
        }
    }

    if (Object.hasOwn(body, 'condition') && !conditions.includes(body.condition)) {
        return `condition must be one of: ${conditions.join(', ')}`
    }

    if (Object.hasOwn(body, 'subcategory') && (typeof body.subcategory !== 'string' || body.subcategory.trim().length > 80)) {
        return 'subcategory must be 80 characters or fewer.'
    }
    if (Object.hasOwn(body, 'brand') && (typeof body.brand !== 'string' || body.brand.trim().length > 80)) return 'brand must be 80 characters or fewer.'
    if (Object.hasOwn(body, 'specifications') && (typeof body.specifications !== 'string' || body.specifications.trim().length > 1200)) return 'specifications must be 1200 characters or fewer.'
    if (Object.hasOwn(body, 'location') && (typeof body.location !== 'string' || body.location.trim().length > 160)) return 'location must be 160 characters or fewer.'
    if (Object.hasOwn(body, 'quantity') && (!Number.isInteger(Number(body.quantity)) || Number(body.quantity) < 0 || Number(body.quantity) > 10000)) return 'quantity must be a whole number between 0 and 10000.'
    if (Object.hasOwn(body, 'negotiable') && typeof body.negotiable !== 'boolean' && !['true', 'false'].includes(body.negotiable)) return 'negotiable must be true or false.'
    if (Object.hasOwn(body, 'salePreference') && !['sale', 'exchange', 'both'].includes(body.salePreference)) return 'salePreference must be sale, exchange, or both.'
    if (Object.hasOwn(body, 'contactMethod') && body.contactMethod !== 'chat') return 'Only secure in-app chat is supported as a contact method.'

    if (Object.hasOwn(body, 'status') && !statuses.includes(body.status)) {
        return `status must be one of: ${statuses.join(', ')}`
    }

    if (Object.hasOwn(body, 'images')) {
        const images = normalizeImages(body.images)
        if (images.length > MAX_IMAGES_PER_PRODUCT) {
            return `You can upload up to ${MAX_IMAGES_PER_PRODUCT} images.`
        }
        if (images.some((image) => typeof image !== 'string' || !isSafeProductImageUrl(image))) {
            return 'Product images must be secure images hosted by CampusMart image storage.'
        }
    }

    if (partial && !editableFields.some((field) => Object.hasOwn(body, field))) {
        return 'At least one editable product field is required'
    }

    return null
}

function isSafeProductImageUrl(value) {
    try {
        const url = new URL(value)
        return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com'
    } catch {
        return false
    }
}

function productUpdates(body, fields = editableFields) {
    return Object.fromEntries(fields
        .filter((field) => Object.hasOwn(body, field))
        .map((field) => [field, field === 'price' || field === 'quantity' ? Number(body[field]) : field === 'negotiable' && typeof body[field] === 'string' ? body[field] === 'true' : body[field]]))
}

function validProductId(id) {
    return mongoose.isValidObjectId(id)
}

async function uploadProductImages(files = []) {
    const validatedFiles = files.filter((file) => {
        const validationError = validateImageUpload(file)
        if (validationError) {
            const error = new Error(validationError)
            error.statusCode = 400
            throw error
        }
        return true
    })

    const results = await Promise.all(validatedFiles.map((file) => new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
            folder: 'campusmart/products',
            resource_type: 'image',
        }, (error, result) => {
            if (error) {
                reject(error)
                return
            }

            if (typeof result?.secure_url !== 'string' || !result.secure_url.startsWith('https://res.cloudinary.com/')) {
                reject(new Error('The image provider returned an invalid product image URL.'))
                return
            }
            resolve(result.secure_url)
        })

        stream.end(file.buffer)
    })))

    return results
}

async function createProduct(req, res, next) {
    try {
        const body = req.body || {}
        const uploadedFiles = Array.isArray(req.files) ? req.files : []
        const existingImages = Object.hasOwn(body, 'images') ? normalizeImages(body.images) : []

        if (uploadedFiles.length + existingImages.length > MAX_IMAGES_PER_PRODUCT) {
            return res.status(400).json({ success: false, message: `You can upload up to ${MAX_IMAGES_PER_PRODUCT} images.` })
        }

        const validationError = validateProductInput(body)
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError })
        }

        const category = await resolveCategory(body.category)
        if (!category) {
            return res.status(400).json({ success: false, message: 'Choose an active marketplace category.' })
        }
        if (body.subcategory && !category.subcategories.includes(body.subcategory.trim())) return res.status(400).json({ success: false, message: 'Choose a subcategory for the selected category.' })

        let uploadedImageUrls = []
        if (uploadedFiles.length > 0) {
            if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
                return res.status(503).json({ success: false, message: 'Product image uploads are not configured.' })
            }
            uploadedImageUrls = await uploadProductImages(uploadedFiles)
        }

        const finalImages = [...existingImages, ...uploadedImageUrls]
        if (finalImages.length > MAX_IMAGES_PER_PRODUCT) return res.status(400).json({ success: false, message: `You can upload up to ${MAX_IMAGES_PER_PRODUCT} images.` })
        const productPayload = {
            ...productUpdates(body, [...editableFields, 'images']),
            images: finalImages,
            category: category.name,
            college: req.user.college || '',
            seller: req.user._id,
        }

        const product = await Product.create(productPayload)

        await product.populate('seller', sellerFields)
        res.status(201).json({ success: true, product })
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return res.status(400).json({ success: false, message: error.message })
        }

        next(error)
    }
}

async function getProducts(req, res, next) {
    try {
        const { page: rawPage = '1', limit: rawLimit = '20', search = '', category, subcategory, condition, location = '', minPrice, maxPrice, sort = 'newest' } = req.query
        if (typeof rawPage !== 'string' || !/^\d+$/.test(rawPage) || typeof rawLimit !== 'string' || !/^\d+$/.test(rawLimit)) return res.status(400).json({ success: false, message: 'page and limit must be positive integers.' })
        const page = Number.parseInt(rawPage, 10)
        const limit = Number.parseInt(rawLimit, 10)
        const validConditions = ['New', 'Like New', 'Good', 'Fair']
        const validSorts = ['newest', 'price-asc', 'price-desc']
        if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) return res.status(400).json({ success: false, message: 'page must be positive and limit must be between 1 and 50.' })
        if (typeof search !== 'string' || search.length > 200) return res.status(400).json({ success: false, message: 'Search must be 200 characters or fewer.' })
        if (category !== undefined && (typeof category !== 'string' || category.length > 90)) return res.status(400).json({ success: false, message: 'Choose a valid marketplace category.' })
        if (subcategory !== undefined && (typeof subcategory !== 'string' || subcategory.length > 80)) return res.status(400).json({ success: false, message: 'Subcategory must be 80 characters or fewer.' })
        if (condition !== undefined && typeof condition !== 'string') return res.status(400).json({ success: false, message: 'Choose a supported product condition.' })
        if (condition && !validConditions.includes(condition)) return res.status(400).json({ success: false, message: 'Choose a supported product condition.' })
        if (!validSorts.includes(sort)) return res.status(400).json({ success: false, message: 'Sort must be newest, price-asc, or price-desc.' })
        if (typeof location !== 'string' || location.length > 160) return res.status(400).json({ success: false, message: 'Location must be 160 characters or fewer.' })
        if (minPrice !== undefined && typeof minPrice !== 'string') return res.status(400).json({ success: false, message: 'Enter a valid minimum price.' })
        if (maxPrice !== undefined && typeof maxPrice !== 'string') return res.status(400).json({ success: false, message: 'Enter a valid maximum price.' })
        const minimum = minPrice === undefined || minPrice === '' ? null : Number(minPrice)
        const maximum = maxPrice === undefined || maxPrice === '' ? null : Number(maxPrice)
        if ((minimum !== null && (!Number.isFinite(minimum) || minimum < 0 || minimum > 100000000)) || (maximum !== null && (!Number.isFinite(maximum) || maximum < 0 || maximum > 100000000)) || (minimum !== null && maximum !== null && minimum > maximum)) {
            return res.status(400).json({ success: false, message: 'Enter a valid minimum and maximum price.' })
        }
        const filter = {
            status: 'available',
            $or: [
                { moderationStatus: 'active' },
                { moderationStatus: { $exists: false } },
            ],
        }
        const clauses = []
        if (search.trim()) {
            clauses.push({ $text: { $search: search.trim().replace(/["\\]/g, ' ') } })
        }
        if (category) {
            const resolved = await resolveCategory(category)
            if (resolved) clauses.push({ category: { $in: [resolved.name, ...resolved.aliases] } })
            else clauses.push({ _id: null })
        }
        if (subcategory) {
            clauses.push({ subcategory: { $regex: `^${escapeRegex(subcategory.trim())}$`, $options: 'i' } })
        }
        if (condition) clauses.push({ condition })
        if (location.trim()) {
            const pattern = escapeRegex(location.trim())
            clauses.push({ $or: [{ location: { $regex: pattern, $options: 'i' } }, { college: { $regex: pattern, $options: 'i' } }] })
        }
        if (minimum !== null || maximum !== null) {
            const priceFilter = {}
            if (minimum !== null) priceFilter.$gte = minimum
            if (maximum !== null) priceFilter.$lte = maximum
            clauses.push({ price: priceFilter })
        }
        if (clauses.length) filter.$and = clauses
        const sortBy = sort === 'price-asc' ? { price: 1, createdAt: -1 } : sort === 'price-desc' ? { price: -1, createdAt: -1 } : { createdAt: -1 }
        const [products, total, categories] = await Promise.all([
            Product.find(filter).select('-__v -moderationStatus').populate('seller', sellerFields).sort(sortBy).skip((page - 1) * limit).limit(limit).lean(),
            Product.countDocuments(filter),
            getActiveCategories(),
        ])
        res.json({ success: true, count: total, products, categories, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) {
        next(error)
    }
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function getProductCategories(req, res, next) {
    try {
        const [categories, totals] = await Promise.all([
            getActiveCategories(),
            Product.aggregate([
                { $match: { status: 'available', moderationStatus: { $in: ['active', null] } } },
                { $group: { _id: '$category', listingCount: { $sum: 1 } } },
            ]),
        ])
        const countByCategory = new Map(totals.map((item) => [item._id, item.listingCount]))
        const withCounts = categories.map((category) => ({
            ...category,
            listingCount: [category.name, ...(category.aliases || [])].reduce((total, name) => total + (countByCategory.get(name) || 0), 0),
        }))
        res.json({ success: true, categories: withCounts })
    } catch (error) {
        next(error)
    }
}

async function getRelatedProducts(req, res, next) {
    try {
        if (!validProductId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid product ID.' })
        const source = await Product.findOne({ _id: req.params.id, status: 'available', moderationStatus: { $ne: 'removed' } }).select('category subcategory seller')
        if (!source) return res.status(404).json({ success: false, message: 'Product not found.' })
        const products = await Product.find({
            _id: { $ne: source._id },
            status: 'available',
            moderationStatus: { $in: ['active', null] },
            category: source.category,
        }).select('-__v -moderationStatus').populate('seller', sellerFields).sort({ createdAt: -1 }).limit(8).lean()
        res.json({ success: true, products })
    } catch (error) {
        next(error)
    }
}

async function getMyProducts(req, res, next) {
    try {
        const products = await Product.find({ seller: req.user._id })
            .populate('seller', sellerFields)
            .sort({ createdAt: -1 })

        res.json({ success: true, count: products.length, products })
    } catch (error) {
        next(error)
    }
}

async function getProductById(req, res, next) {
    try {
        if (!validProductId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' })
        }

        const product = await Product.findOne({
            _id: req.params.id,
            $or: [
                { moderationStatus: 'active' },
                { moderationStatus: { $exists: false } },
            ],
        }).select('-__v -moderationStatus').populate('seller', sellerFields)

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' })
        }

        res.json({ success: true, product })
    } catch (error) {
        next(error)
    }
}

async function trackProductView(req, res, next) {
    try {
        const { id } = req.params
        if (!validProductId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' })
        }

        const product = await Product.findOne({
            _id: id,
            status: 'available',
            $or: [
                { moderationStatus: 'active' },
                { moderationStatus: { $exists: false } },
            ],
        }).select('_id seller')

        if (!product) {
            return res.status(404).json({ success: false, message: 'Available product not found' })
        }

        if (product.seller.toString() === req.user._id.toString()) {
            return res.json({ success: true, tracked: false })
        }

        await ProductView.findOneAndUpdate(
            { user: req.user._id, product: product._id },
            {
                $set: { lastViewedAt: new Date() },
                $setOnInsert: { user: req.user._id, product: product._id },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        )

        res.json({ success: true, tracked: true })
    } catch (error) {
        if (error.code === 11000) {
            return res.json({ success: true, tracked: true })
        }
        next(error)
    }
}

async function updateProduct(req, res, next) {
    try {
        if (!validProductId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' })
        }

        const validationError = validateProductInput(req.body || {}, true)

        if (validationError) {
            return res.status(400).json({ success: false, message: validationError })
        }

        const body = req.body || {}
        const uploadedFiles = Array.isArray(req.files) ? req.files : []
        const product = await Product.findById(req.params.id)

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' })
        }

        if (product.seller.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Only the seller can update this product' })
        }

        if (Object.hasOwn(body, 'category')) {
            const category = await resolveCategory(body.category)
            if (!category) return res.status(400).json({ success: false, message: 'Choose an active marketplace category.' })
            if (body.subcategory && !category.subcategories.includes(body.subcategory.trim())) return res.status(400).json({ success: false, message: 'Choose a subcategory for the selected category.' })
            body.category = category.name
        } else if (Object.hasOwn(body, 'subcategory') && body.subcategory && !product.subcategory) {
            return res.status(400).json({ success: false, message: 'Choose a category before selecting a subcategory.' })
        } else if (Object.hasOwn(body, 'subcategory') && body.subcategory) {
            const currentCategory = await resolveCategory(product.category)
            if (!currentCategory?.subcategories.includes(body.subcategory.trim())) return res.status(400).json({ success: false, message: 'Choose a subcategory for the selected category.' })
        }
        const existingImages = Object.hasOwn(body, 'images') ? normalizeImages(body.images) : product.images
        if (existingImages.some((image) => typeof image !== 'string' || !isSafeProductImageUrl(image))) return res.status(400).json({ success: false, message: 'Product images must be secure images hosted by CampusMart image storage.' })
        if (existingImages.length + uploadedFiles.length > MAX_IMAGES_PER_PRODUCT) return res.status(400).json({ success: false, message: `You can upload up to ${MAX_IMAGES_PER_PRODUCT} images.` })
        if (uploadedFiles.length && (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET)) {
            return res.status(503).json({ success: false, message: 'Product image uploads are not configured.' })
        }
        const uploadedImageUrls = uploadedFiles.length ? await uploadProductImages(uploadedFiles) : []

        const wasAvailable = product.status !== 'sold'
        const previousPrice = Number(product.price)
        const nextPrice = Object.hasOwn(body, 'price') ? Number(body.price) : previousPrice
        Object.assign(product, productUpdates(body))
        if (Object.hasOwn(body, 'images') || uploadedFiles.length) product.images = [...existingImages, ...uploadedImageUrls]
        await product.save()
        await product.populate('seller', sellerFields)

        if (Object.hasOwn(body, 'price') && Number.isFinite(nextPrice) && nextPrice < previousPrice && product.status === 'available' && (product.moderationStatus === 'active' || product.moderationStatus === undefined)) {
            try {
                const lastPriceNotice = await PriceDropNotice.exists({ product: product._id, createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } })
                if (!lastPriceNotice) {
                    const wishlists = await Wishlist.find({ product: product._id }).select('user').lean()
                    await Promise.all(wishlists.map(async (entry) => {
                        try {
                            await PriceDropNotice.create({ user: entry.user, product: product._id, previousPrice, currentPrice: nextPrice })
                            return createAndEmitNotification({ recipient: entry.user, type: 'wishlist', title: 'Price dropped on your wishlist', message: `${product.title} is now ₹${Number(product.price).toLocaleString('en-IN')}.`, product: product._id })
                        } catch (error) { if (error.code !== 11000) throw error }
                    }))
                }
            } catch (notificationError) {
                console.error('Unable to create wishlist price-drop notifications:', notificationError.message)
            }
        }

        if (wasAvailable && product.status === 'sold') {
            try {
                const [conversations, wishlistUserIds] = await Promise.all([
                    Conversation.find({ product: product._id }).select('participants'),
                    Wishlist.distinct('user', { product: product._id, user: { $ne: product.seller._id } }),
                ])

                const activeConversationIds = conversations.length
                    ? new Set((await Message.distinct('conversation', {
                        conversation: { $in: conversations.map((conversation) => conversation._id) },
                    })).map((conversationId) => conversationId.toString()))
                    : new Set()
                const recipientIds = new Set(wishlistUserIds.map((userId) => userId.toString()))
                for (const conversation of conversations) {
                    if (!activeConversationIds.has(conversation._id.toString())) continue
                    for (const participantId of conversation.participants) {
                        if (participantId.toString() !== product.seller._id.toString()) {
                            recipientIds.add(participantId.toString())
                        }
                    }
                }

                await Promise.all([...recipientIds].map((recipient) => createAndEmitNotification({
                    recipient,
                    type: 'product_sold',
                    title: 'A saved or discussed product was sold',
                    message: `${product.title} has been marked as sold.`,
                    product: product._id,
                })))
            } catch (notificationError) {
                console.error('Unable to create product sold notifications:', notificationError.message)
            }
        }

        res.json({ success: true, product })
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return res.status(400).json({ success: false, message: error.message })
        }

        next(error)
    }
}

async function deleteProduct(req, res, next) {
    try {
        if (!validProductId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' })
        }

        const product = await Product.findById(req.params.id)

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' })
        }

        if (product.seller.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Only the seller can delete this product' })
        }

        await product.deleteOne()
        res.json({ success: true, message: 'Product deleted' })
    } catch (error) {
        next(error)
    }
}

module.exports = {
    createProduct,
    getProducts,
    getProductCategories,
    getRelatedProducts,
    getMyProducts,
    getProductById,
    trackProductView,
    updateProduct,
    deleteProduct,
    validateImageUpload,
    validateProductInput,
    normalizeImages,
}
