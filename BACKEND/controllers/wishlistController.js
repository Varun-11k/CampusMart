const mongoose = require('mongoose')
const Product = require('../models/Product')
const Wishlist = require('../models/Wishlist')

const productFields = 'title description price category condition images college seller status createdAt updatedAt'
const sellerFields = 'name college profileImage'

function validProductId(productId) {
    return mongoose.isValidObjectId(productId)
}

async function addProduct(req, res, next) {
    try {
        const { productId } = req.params

        if (!validProductId(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' })
        }

        const productExists = await Product.exists({ _id: productId })
        if (!productExists) {
            return res.status(404).json({ success: false, message: 'Product not found' })
        }

        const existingEntry = await Wishlist.findOne({ user: req.user._id, product: productId })
        if (existingEntry) {
            return res.json({ success: true, saved: true, message: 'Product is already in your wishlist' })
        }

        await Wishlist.create({ user: req.user._id, product: productId })
        res.status(201).json({ success: true, saved: true, message: 'Product added to your wishlist' })
    } catch (error) {
        if (error.code === 11000) {
            return res.json({ success: true, saved: true, message: 'Product is already in your wishlist' })
        }
        next(error)
    }
}

async function removeProduct(req, res, next) {
    try {
        const { productId } = req.params

        if (!validProductId(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' })
        }

        await Wishlist.deleteOne({ user: req.user._id, product: productId })
        res.json({ success: true, saved: false, message: 'Product removed from your wishlist' })
    } catch (error) {
        next(error)
    }
}

async function getWishlist(req, res, next) {
    try {
        const entries = await Wishlist.find({ user: req.user._id })
            .populate({
                path: 'product',
                select: productFields,
                populate: { path: 'seller', select: sellerFields },
            })
            .sort({ createdAt: -1 })

        const products = entries
            .map((entry) => entry.product)
            .filter(Boolean)

        res.json({ success: true, count: products.length, products })
    } catch (error) {
        next(error)
    }
}

async function checkProduct(req, res, next) {
    try {
        const { productId } = req.params

        if (!validProductId(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' })
        }

        const productExists = await Product.exists({ _id: productId })
        if (!productExists) {
            return res.status(404).json({ success: false, message: 'Product not found' })
        }

        const saved = await Wishlist.exists({ user: req.user._id, product: productId })
        res.json({ success: true, saved: Boolean(saved) })
    } catch (error) {
        next(error)
    }
}

module.exports = { addProduct, removeProduct, getWishlist, checkProduct }
