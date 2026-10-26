const express = require('express')
const {
    getOverview,
    getReports,
    getReport,
    updateReport,
    getProducts,
    moderateProduct,
    getUser,
} = require('../controllers/adminController')
const adminMiddleware = require('../middleware/adminMiddleware')
const engagementController = require('../controllers/engagementController')
const productCategoryController = require('../controllers/productCategoryController')
const campusVoiceController = require('../controllers/campusVoiceController')

const router = express.Router()

router.use(adminMiddleware)
router.get('/overview', getOverview)
router.get('/campus-voices', campusVoiceController.listAdminPosts)
router.put('/campus-voices/:id/moderation', campusVoiceController.moderateAdminPost)
router.get('/reports', getReports)
router.get('/reports/:id', getReport)
router.put('/reports/:id', updateReport)
router.get('/products', getProducts)
router.put('/products/:id/moderation', moderateProduct)
router.get('/categories', productCategoryController.listAdminCategories)
router.post('/categories', productCategoryController.createCategory)
router.put('/categories/:id', productCategoryController.updateCategory)
router.get('/users/:id', getUser)
router.post('/coupons', engagementController.createCoupon)
router.post('/challenges', engagementController.createChallenge)

module.exports = router
