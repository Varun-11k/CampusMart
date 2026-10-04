const express = require('express')
const multer = require('multer')
const protect = require('../middleware/authMiddleware')
const controller = require('../controllers/campusExchangeController')
const { createReport } = require('../controllers/reportController')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { files: controller.MAX_IMAGES, fileSize: controller.MAX_IMAGE_SIZE }, fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) return callback(new Error('Only JPG, PNG, WEBP, and GIF images are allowed'))
    callback(null, true)
} })
const parseImages = (req, res, next) => upload.array('images', controller.MAX_IMAGES)(req, res, (error) => {
    if (!error) return next()
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5MB or smaller' : error.code === 'LIMIT_UNEXPECTED_FILE' ? `You can upload up to ${controller.MAX_IMAGES} images` : error.message
    return res.status(400).json({ success: false, message })
})
const optionalAuth = (req, res, next) => req.headers.authorization ? protect(req, res, next) : next()

router.get('/', controller.listExchanges)
router.get('/my-exchanges', protect, controller.myExchanges)
router.get('/matches/:id', optionalAuth, controller.findMatches)
router.get('/:id/requests', protect, controller.getExchangeRequests)
router.post('/:id/request', protect, controller.requestExchange)
router.post('/:id/exchanged', protect, controller.markExchanged)
router.post('/:id/close', protect, controller.closeExchange)
router.post('/:id/report', protect, (req, res, next) => {
    req.body = { reason: req.body?.reason, description: req.body?.description, campusExchangeId: req.params.id }
    return createReport(req, res, next)
})
router.put('/requests/:requestId/accept', protect, controller.acceptRequest)
router.put('/requests/:requestId/reject', protect, controller.rejectRequest)
router.put('/requests/:requestId/cancel', protect, controller.cancelRequest)
router.post('/', protect, parseImages, controller.createExchange)
router.put('/:id', protect, parseImages, controller.updateExchange)
router.delete('/:id', protect, controller.deleteExchange)
router.get('/:id', optionalAuth, controller.getExchange)

module.exports = router
