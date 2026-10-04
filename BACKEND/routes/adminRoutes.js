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

const router = express.Router()

router.use(adminMiddleware)
router.get('/overview', getOverview)
router.get('/reports', getReports)
router.get('/reports/:id', getReport)
router.put('/reports/:id', updateReport)
router.get('/products', getProducts)
router.put('/products/:id/moderation', moderateProduct)
router.get('/users/:id', getUser)
router.post('/coupons', engagementController.createCoupon)
router.post('/challenges', engagementController.createChallenge)

module.exports = router
