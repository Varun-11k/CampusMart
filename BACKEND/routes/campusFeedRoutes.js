const express = require('express')
const multer = require('multer')
const protect = require('../middleware/authMiddleware')
const createUserRateLimiter = require('../middleware/createUserRateLimiter')
const controller = require('../controllers/campusFeedController')

const router = express.Router()
const limitPostCreation = createUserRateLimiter({ windowMs: 10 * 60_000, maxRequests: 10, message: 'Too many posts. Please wait before sharing again.' })
const limitInteractions = createUserRateLimiter({ windowMs: 60_000, maxRequests: 60, message: 'Too many requests. Please wait a minute and try again.' })

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { files: controller.MAX_MEDIA, fileSize: 40 * 1024 * 1024 },
})

const parseMedia = (req, res, next) => upload.array('media', controller.MAX_MEDIA)(req, res, (error) => {
    if (!error) return next()
    const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Each file must be 40MB or smaller'
        : error.code === 'LIMIT_UNEXPECTED_FILE' || error.code === 'LIMIT_FILE_COUNT'
            ? `You can upload up to ${controller.MAX_MEDIA} media files`
            : error.message
    return res.status(400).json({ success: false, message })
})

const optionalAuth = (req, res, next) => (req.headers.authorization ? protect(req, res, next) : next())

router.get('/', optionalAuth, controller.listPosts)
router.get('/trending/hashtags', controller.trendingHashtags)
router.get('/saved', protect, controller.savedPosts)
router.get('/mine', protect, controller.myPosts)
router.get('/reels', optionalAuth, (req, res, next) => { req.query.reels = 'true'; controller.listPosts(req, res, next) })
router.post('/', protect, limitPostCreation, parseMedia, controller.createPost)
router.get('/:id', optionalAuth, controller.getPost)
router.put('/:id', protect, controller.updatePost)
router.delete('/:id', protect, controller.deletePost)
router.post('/:id/like', protect, limitInteractions, controller.toggleLike)
router.post('/:id/save', protect, limitInteractions, controller.toggleSave)
router.post('/:id/poll/vote', protect, limitInteractions, controller.votePoll)
router.get('/:id/comments', optionalAuth, controller.listComments)
router.post('/:id/comments', protect, limitInteractions, controller.createComment)
router.delete('/comments/:commentId', protect, controller.deleteComment)
router.post('/comments/:commentId/like', protect, limitInteractions, controller.toggleCommentLike)
router.post('/:id/report', protect, controller.reportPost)
router.post('/comments/:commentId/report', protect, controller.reportComment)
router.post('/follow/:userId', protect, controller.followUser)
router.delete('/follow/:userId', protect, controller.unfollowUser)

module.exports = router