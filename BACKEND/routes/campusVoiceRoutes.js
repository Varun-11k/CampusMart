const express = require('express')
const protect = require('../middleware/authMiddleware')
const createUserRateLimiter = require('../middleware/createUserRateLimiter')
const controller = require('../controllers/campusVoiceController')
const engagementController = require('../controllers/engagementController')

const router = express.Router()
const limitPostCreation = createUserRateLimiter({ windowMs: 60_000, maxRequests: 5, message: 'Too many posts. Please wait a minute before posting again.' })
const limitLikes = createUserRateLimiter({ windowMs: 60_000, maxRequests: 30, message: 'Too many like requests. Please wait a minute and try again.' })
const optionalAuth = (req, res, next) => req.headers.authorization ? protect(req, res, next) : next()

router.get('/', optionalAuth, controller.listPosts)
router.get('/polls', optionalAuth, engagementController.listPolls)
router.post('/polls', protect, limitPostCreation, engagementController.createPoll)
router.post('/polls/:id/vote', protect, limitLikes, engagementController.votePoll)
router.post('/polls/:id/close', protect, engagementController.closePoll)
router.get('/my-posts', protect, controller.myPosts)
router.post('/', protect, limitPostCreation, controller.createPost)
router.post('/:id/like', protect, limitLikes, controller.toggleLike)
router.get('/:id', optionalAuth, controller.getPost)
router.put('/:id', protect, controller.updatePost)
router.delete('/:id', protect, controller.deletePost)

module.exports = router
