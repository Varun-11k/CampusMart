const express = require('express')
const multer = require('multer')
const protect = require('../middleware/authMiddleware')
const controller = require('../controllers/lostFoundController')
const claims = require('../controllers/lostFoundClaimController')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { files: controller.MAX_IMAGES, fileSize: 5 * 1024 * 1024 } })
const optionalAuth = (req, res, next) => req.headers.authorization ? protect(req, res, next) : next()
const parseImages = (req, res, next) => upload.array('images', controller.MAX_IMAGES)(req, res, (error) => {
    if (error) return res.status(400).json({ success: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5MB or smaller' : error.code === 'LIMIT_UNEXPECTED_FILE' ? `You can upload up to ${controller.MAX_IMAGES} images` : error.message })
    next()
})

router.get('/', controller.listReports)
router.get('/my-reports', protect, controller.myReports)
router.get('/my-claims', protect, claims.myClaims)
router.get('/:id', optionalAuth, controller.getReport)
router.post('/', protect, parseImages, controller.createReport)
router.put('/:id', protect, parseImages, controller.updateReport)
router.delete('/:id', protect, controller.deleteReport)
router.post('/:id/claim', protect, claims.submitClaim)
router.put('/:id/claims/:claimId', protect, claims.updateClaim)
router.post('/:id/returned', protect, controller.markReturned)

module.exports = router
