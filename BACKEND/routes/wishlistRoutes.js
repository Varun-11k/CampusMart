const express = require('express')
const { addProduct, removeProduct, getWishlist, checkProduct } = require('../controllers/wishlistController')
const protect = require('../middleware/authMiddleware')

const router = express.Router()

router.use(protect)
router.get('/', getWishlist)
router.get('/:productId/check', checkProduct)
router.post('/:productId', addProduct)
router.delete('/:productId', removeProduct)

module.exports = router
