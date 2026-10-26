const express = require('express')
const { createReport } = require('../controllers/reportController')
const protect = require('../middleware/authMiddleware')
const createUserRateLimiter = require('../middleware/createUserRateLimiter')

const router = express.Router()
const limitReports = createUserRateLimiter({ windowMs: 10 * 60_000, maxRequests: 5, message: 'Too many reports. Please wait before submitting another.' })

router.post('/', protect, limitReports, createReport)

module.exports = router
