function createUserRateLimiter({ windowMs, maxRequests, message }) {
    const requestsByUser = new Map()

    return function limitUserRequests(req, res, next) {
        const now = Date.now()
        const userId = req.user?._id?.toString()
        if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' })

        for (const [trackedUserId, entry] of requestsByUser) {
            if (now - entry.startedAt >= windowMs) requestsByUser.delete(trackedUserId)
        }

        const current = requestsByUser.get(userId)
        if (!current || now - current.startedAt >= windowMs) {
            requestsByUser.set(userId, { startedAt: now, count: 1 })
            return next()
        }
        if (current.count >= maxRequests) return res.status(429).json({ success: false, message })
        current.count += 1
        return next()
    }
}

module.exports = createUserRateLimiter
