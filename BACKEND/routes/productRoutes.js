const express = require('express')
const multer = require('multer')
const {
    createProduct,
    getProducts,
    getProductCategories,
    getRelatedProducts,
    getMyProducts,
    getProductById,
    trackProductView,
    updateProduct,
    deleteProduct,
} = require('../controllers/productController')
const protect = require('../middleware/authMiddleware')

const router = express.Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: 5,
        fileSize: 5 * 1024 * 1024,
    },
})
const parseProductImages = (req, res, next) => upload.array('images', 5)(req, res, (error) => {
    if (!error) return next()
    return res.status(400).json({
        success: false,
        message: error.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5MB or smaller.' : error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE' ? 'You can upload at most 5 images.' : 'Product image upload could not be read.',
    })
})

router.route('/')
    .get(getProducts)
    .post(protect, parseProductImages, createProduct)

router.get('/categories', getProductCategories)
router.get('/related/:id', getRelatedProducts)
router.get('/mine', protect, getMyProducts)
router.post('/:id/view', protect, trackProductView)

router.route('/:id')
    .get(getProductById)
    .put(protect, parseProductImages, updateProduct)
    .delete(protect, deleteProduct)

module.exports = router