function getHealth(req, res) {
    res.status(200).json({
        success: true,
        message: 'CampusMart API is running',
    })
}

module.exports = { getHealth }