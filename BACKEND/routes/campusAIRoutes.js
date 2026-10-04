const express = require('express')
const controller = require('../controllers/campusAIController')
const marketplaceController = require('../controllers/aiMarketplaceController')
const lostFoundController = require('../controllers/aiLostFoundController')
const resourceController = require('../controllers/aiResourceController')
const recommendationsController = require('../controllers/campusRecommendationController')
const createIpRateLimiter = require('../middleware/createIpRateLimiter')
const protect = require('../middleware/authMiddleware')

const router = express.Router()
const limitCampusAISearch = createIpRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: 'Too many Campus AI searches. Please try again in a minute.',
})
const optionalAuth = (req, res, next) => req.headers.authorization ? protect(req, res, next) : next()

router.post('/search', limitCampusAISearch, controller.searchCampus)
router.post('/marketplace-search', limitCampusAISearch, optionalAuth, marketplaceController.searchMarketplace)
router.post('/lost-found-search', limitCampusAISearch, lostFoundController.searchLostFound)
router.post('/resource-search', limitCampusAISearch, resourceController.searchResources)
router.get('/recommendations', protect, limitCampusAISearch, recommendationsController.getRecommendations)

module.exports = router
