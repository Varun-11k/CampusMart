const jwt = require('jsonwebtoken')
const User = require('../models/User')

async function protect(req, res, next) {
    try {
        const authorization = req.headers.authorization
        const token = authorization && authorization.startsWith('Bearer ')
            ? authorization.slice(7)
            : null

        if (!token) {
            return res.status(401).json({ success: false, message: 'Authentication required' })
        }

        if (typeof process.env.JWT_SECRET !== 'string' || Buffer.byteLength(process.env.JWT_SECRET) < 32) {
            throw new Error('JWT_SECRET must be configured with at least 32 characters')
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
        if (typeof payload.userId !== 'string') {
            return res.status(401).json({ success: false, message: 'Invalid or expired token' })
        }

        const user = await User.findById(payload.userId).select('-password +googleId +authProviders +tokenVersion +deactivatedAt')

        if (!user || user.deactivatedAt || (payload.tokenVersion ?? 0) !== (user.tokenVersion || 0)) {
            return res.status(401).json({ success: false, message: 'User no longer exists' })
        }

        user.tokenVersion = user.tokenVersion || 0
        req.user = user
        next()
    } catch (error) {
        if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
            return res.status(401).json({ success: false, message: 'Invalid or expired token' })
        }

        next(error)
    }
}

module.exports = protect