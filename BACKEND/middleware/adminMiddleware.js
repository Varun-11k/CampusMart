const protect = require('./authMiddleware')

function isAuthorizedAdmin(user) {
    const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
    const accountEmail = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : ''
    return Boolean(configuredEmail && user?.role === 'admin' && accountEmail === configuredEmail)
}

function adminMiddleware(req, res, next) {
    return protect(req, res, (error) => {
        if (error) return next(error)
        if (res.headersSent) return

        if (!isAuthorizedAdmin(req.user)) {
            return res.status(403).json({ success: false, message: 'Admin access required' })
        }

        next()
    })
}

module.exports = adminMiddleware
module.exports.isAuthorizedAdmin = isAuthorizedAdmin
