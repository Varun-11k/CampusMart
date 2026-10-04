const express = require('express')
const multer = require('multer')
const {
    createProduct,
    getProducts,
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

router.route('/')
    .get(getProducts)
    .post(protect, upload.array('images', 5), createProduct)

router.get('/mine', protect, getMyProducts)
router.post('/:id/view', protect, trackProductView)

router.route('/:id')
    .get(getProductById)
    .put(protect, updateProduct)
    .delete(protect, deleteProduct)

module.exports = router