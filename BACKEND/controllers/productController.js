const mongoose = require('mongoose')
const Product = require('../models/Product')
const ProductView = require('../models/ProductView')
const Conversation = require('../models/Conversation')
const Message = require('../models/Message')
const Wishlist = require('../models/Wishlist')
const PriceDropNotice = require('../models/PriceDropNotice')
const cloudinary = require('../config/cloudinary')
const { createAndEmitNotification } = require('../services/notificationService')

const conditions = ['New', 'Like New', 'Good', 'Fair']
const statuses = ['available', 'sold', 'reserved']
const editableFields = ['title', 'description', 'price', 'category', 'condition', 'status']
const sellerFields = 'name college profileImage'
const MAX_IMAGES_PER_PRODUCT = 5
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function validateImageUpload(file) {
    if (!file) return null

    if (!allowedImageTypes.has(file.mimetype)) {
        return 'Only JPG, PNG, WEBP, and GIF image file types are allowed.'
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        return 'Each image must be 5MB or smaller.'
    }

    return null
}

function normalizeImages(input) {
    if (!input) return []

    if (Array.isArray(input)) {
        return input.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())
    }

    if (typeof input === 'string') {
        try {
            const parsed = JSON.parse(input)
            if (Array.isArray(parsed)) {
                return parsed.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())
            }
        } catch {
            return input.trim() ? [input.trim()] : []
        }
    }

    return []
}

function validateProductInput(body, partial = false) {
    const requiredFields = ['title', 'description', 'price', 'category', 'condition']

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

    if (Object.hasOwn(body, 'status') && !statuses.includes(body.status)) {
        return `status must be one of: ${statuses.join(', ')}`
    }

    if (Object.hasOwn(body, 'images')) {
        const images = normalizeImages(body.images)
        if (images.length > MAX_IMAGES_PER_PRODUCT) {
            return `You can upload up to ${MAX_IMAGES_PER_PRODUCT} images.`
        }
    }

    if (partial && !editableFields.some((field) => Object.hasOwn(body, field))) {
        return 'At least one editable product field is required'
    }

    return null
}

function productUpdates(body, fields = editableFields) {
    return Object.fromEntries(fields
        .filter((field) => Object.hasOwn(body, field))
        .map((field) => [field, field === 'price' ? Number(body[field]) : body[field]]))
}

function validProductId(id) {
    return mongoose.isValidObjectId(id)
}

async function uploadProductImages(files = []) {
    const validatedFiles = files.filter((file) => {
        const validationError = validateImageUpload(file)
        if (validationError) {
            throw new Error(validationError)
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
        const existingImages = normalizeImages(body.images)

        if (uploadedFiles.length + existingImages.length > MAX_IMAGES_PER_PRODUCT) {
            return res.status(400).json({ success: false, message: `You can upload up to ${MAX_IMAGES_PER_PRODUCT} images.` })
        }

        const validationError = validateProductInput(body)
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError })
        }

        if (!req.user.college) {
            return res.status(400).json({ success: false, message: 'Your account needs a college before creating listings' })
        }

        let uploadedImageUrls = []
        if (uploadedFiles.length > 0) {
            uploadedImageUrls = await uploadProductImages(uploadedFiles)
        }

        const finalImages = [...existingImages, ...uploadedImageUrls]
        const productPayload = {
            ...productUpdates(body, [...editableFields, 'images']),
            images: finalImages,
            college: req.user.college,
            seller: req.user._id,
        }

        const product = await Product.create(productPayload)

        await product.populate('seller', sellerFields)
        res.status(201).json({ success: true, product })
    } catch (error) {
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return res.status(400).json({ success: false, message: error.message })
        }

        next(error)
    }
}

async function getProducts(req, res, next) {
    try {
        const products = await Product.find({
            status: 'available',
            $or: [
                { moderationStatus: 'active' },
                { moderationStatus: { $exists: false } },
            ],
        })
            .populate('seller', sellerFields)
            .sort({ createdAt: -1 })

        res.json({ success: true, count: products.length, products })
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
        }).populate('seller', sellerFields)

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

        const product = await Product.findById(req.params.id)

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' })
        }

        if (product.seller.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Only the seller can update this product' })
        }

        const wasAvailable = product.status !== 'sold'
        const previousPrice = Number(product.price)
        const nextPrice = Object.hasOwn(req.body, 'price') ? Number(req.body.price) : previousPrice
        Object.assign(product, productUpdates(req.body))
        await product.save()
        await product.populate('seller', sellerFields)

        if (Object.hasOwn(req.body, 'price') && Number.isFinite(nextPrice) && nextPrice < previousPrice && product.status === 'available' && (product.moderationStatus === 'active' || product.moderationStatus === undefined)) {
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
    getMyProducts,
    getProductById,
    trackProductView,
    updateProduct,
    deleteProduct,
    validateImageUpload,
}
