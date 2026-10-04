function createIpRateLimiter({ windowMs, maxRequests, message }) {
    const requestsByIp = new Map()
    return function limitIpRequests(req, res, next) {
        const now = Date.now()
        const ip = req.ip || req.socket?.remoteAddress || 'unknown'
        for (const [trackedIp, entry] of requestsByIp) if (now - entry.startedAt >= windowMs) requestsByIp.delete(trackedIp)
        const current = requestsByIp.get(ip)
        if (!current || now - current.startedAt >= windowMs) {
            requestsByIp.set(ip, { startedAt: now, count: 1 })
            return next()
        }
        if (current.count >= maxRequests) return res.status(429).json({ success: false, message })
        current.count += 1
        return next()
    }
}

module.exports = createIpRateLimiter
