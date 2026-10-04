const express = require('express')
const protect = require('../middleware/authMiddleware')
const { createDescription, createPriceEstimate } = require('../controllers/aiController')
const { searchProducts } = require('../controllers/aiSearchController')
const createUserRateLimiter = require('../middleware/createUserRateLimiter')
const createIpRateLimiter = require('../middleware/createIpRateLimiter')

const router = express.Router()
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_REQUESTS = 5
const limitAiRequests = createUserRateLimiter({ windowMs: RATE_LIMIT_WINDOW_MS, maxRequests: RATE_LIMIT_REQUESTS, message: 'Too many AI requests. Please wait a minute and try again.' })
const limitSearchByIp = createIpRateLimiter({ windowMs: 60 * 1000, maxRequests: 10, message: 'Too many AI searches. Please try again in a minute.' })

router.post('/generate-description', protect, limitAiRequests, createDescription)
router.post('/estimate-price', protect, limitAiRequests, createPriceEstimate)
router.post('/search', limitSearchByIp, searchProducts)

module.exports = router
