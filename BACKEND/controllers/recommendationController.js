const { getRecommendations } = require('../services/recommendationService')

async function getUserRecommendations(req, res, next) {
    try {
        const result = await getRecommendations(req.user)
        res.json({ success: true, ...result })
    } catch (error) {
        next(error)
    }
}

module.exports = { getUserRecommendations }
