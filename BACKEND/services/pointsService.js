const CampusPointTransaction = require('../models/CampusPointTransaction')
const Badge = require('../models/Badge')
const UserBadge = require('../models/UserBadge')
const { createAndEmitNotification } = require('./notificationService')

async function awardPoints({ user, action, points, referenceType, referenceId, description }) {
    if (!user || !action || !Number.isInteger(points) || points <= 0 || !referenceType || !referenceId) return false
    try {
        await CampusPointTransaction.create({ user, action, points, referenceType, referenceId, description })
        return true
    } catch (error) {
        if (error.code === 11000) return false
        throw error
    }
}

async function awardExchangeBadges(userId) {
    const badge = await Badge.findOneAndUpdate({ name: 'Exchange Contributor' }, { $setOnInsert: { name: 'Exchange Contributor', icon: '🔄', description: 'Completed a campus exchange.', criteria: 'Accepted exchange request', active: true } }, { upsert: true, new: true, setDefaultsOnInsert: true })
    const result = await UserBadge.updateOne({ user: userId, badge: badge._id }, { $setOnInsert: { user: userId, badge: badge._id } }, { upsert: true })
    if (result.upsertedCount) await createAndEmitNotification({ recipient: userId, type: 'system', title: 'Campus badge earned', message: `You earned the ${badge.name} badge.` }).catch(() => {})
}

module.exports = { awardPoints, awardExchangeBadges }
