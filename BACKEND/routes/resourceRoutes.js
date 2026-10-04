const express = require('express')
const multer = require('multer')
const protect = require('../middleware/authMiddleware')
const createUserRateLimiter = require('../middleware/createUserRateLimiter')
const controller = require('../controllers/resourceController')
const { createReport } = require('../controllers/reportController')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: controller.maxFileBytes }, fileFilter: (req, file, callback) => {
    const extensions = { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] }
    const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase()
    if (!controller.allowedFileTypes.has(file.mimetype) || !extensions[file.mimetype]?.includes(extension)) return callback(new Error('Only PDF, TXT, JPG, and PNG files are allowed'))
    callback(null, true)
} })
const parseFile = (req, res, next) => upload.single('file')(req, res, (error) => {
    if (!error) return next()
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Files must be 10MB or smaller' : error.code === 'LIMIT_UNEXPECTED_FILE' ? 'Upload one file at a time' : error.message
    return res.status(400).json({ success: false, message })
})
const optionalAuth = (req, res, next) => req.headers.authorization ? protect(req, res, next) : next()
const limitResourceCreate = createUserRateLimiter({ windowMs: 60_000, maxRequests: 5, message: 'Too many resource uploads. Please wait a minute and try again.' })
const limitResourceDownload = createUserRateLimiter({ windowMs: 60_000, maxRequests: 30, message: 'Too many resource requests. Please wait a minute and try again.' })

router.get('/', optionalAuth, controller.listResources)
router.get('/my-resources', protect, controller.myResources)
router.post('/', protect, limitResourceCreate, parseFile, controller.createResource)
router.post('/:id/download', protect, limitResourceDownload, controller.downloadResource)
router.post('/:id/report', protect, (req, res, next) => {
    req.body = { reason: req.body?.reason, description: req.body?.description, resourceId: req.params.id }
    createReport(req, res, next)
})
router.get('/:id', optionalAuth, controller.getResource)
router.put('/:id', protect, parseFile, controller.updateResource)
router.delete('/:id', protect, controller.deleteResource)

module.exports = router
