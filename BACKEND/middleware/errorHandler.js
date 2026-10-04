function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    })
}

function errorHandler(error, req, res, next) {
    console.error(error.stack || error.message)

    res.status(error.statusCode || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message || 'Internal server error',
    })
}

module.exports = { notFoundHandler, errorHandler }