const User = require('../models/User')
const { getIO } = require('../socketManager')

function disconnectUserSockets(userId) {
    const io = getIO()
    if (io) io.in(`user:${userId.toString()}`).disconnectSockets(true)
}

async function invalidateUserSessions(userId) {
    const result = await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } })
    if (!result.matchedCount) return false

    disconnectUserSockets(userId)
    return true
}

module.exports = { invalidateUserSessions, disconnectUserSockets }
