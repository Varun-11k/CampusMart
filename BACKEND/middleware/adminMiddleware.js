const protect = require('./authMiddleware')

function adminMiddleware(req, res, next) {
    return protect(req, res, (error) => {
        if (error) return next(error)
        if (res.headersSent) return

        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
        const isDesignatedAdmin = adminEmail && req.user?.email?.toLowerCase() === adminEmail

        if (req.user?.role !== 'admin' || !isDesignatedAdmin) {
            return res.status(403).json({ success: false, message: 'Admin access required' })
        }

        next()
    })
}

module.exports = adminMiddleware
