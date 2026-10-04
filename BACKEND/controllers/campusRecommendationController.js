const campusRecommendationService = require('../services/campusRecommendationService')

async function getRecommendations(req, res, next) {
    try {
        const recommendations = await campusRecommendationService.getCampusRecommendations(req.user)
        return res.json({ success: true, recommendations })
    } catch (error) { return next(error) }
}

module.exports = { getRecommendations }
