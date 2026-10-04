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

        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET is not configured')
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET)
        const user = await User.findById(payload.userId).select('-password')

        if (!user) {
            return res.status(401).json({ success: false, message: 'User no longer exists' })
        }

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