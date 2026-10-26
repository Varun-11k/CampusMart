const Product = require('../models/Product')
const LostFoundReport = require('../models/LostFoundReport')
const LostFoundClaim = require('../models/LostFoundClaim')
const CampusVoice = require('../models/CampusVoice')

const ACTIVITY_LIMIT = 20

function serializePrivateConfession(post) {
    const safePost = { ...post }
    delete safePost.author
    delete safePost.likes
    delete safePost.status
    delete safePost.__v
    return {
        ...safePost,
        isAnonymous: true,
        authorLabel: 'Anonymous Student',
        isMine: true,
    }
}

async function getStudentDashboard(req, res, next) {
    try {
        const userId = req.user._id
        const [products, reports, claims, posts, productCount, reportCount, claimCount, postCount] = await Promise.all([
            Product.find({ seller: userId }).select('title price category condition images status createdAt').sort({ createdAt: -1 }).limit(ACTIVITY_LIMIT).lean(),
            LostFoundReport.find({ reportedBy: userId }).select('type title category description location date images status createdAt').sort({ createdAt: -1 }).limit(ACTIVITY_LIMIT).lean(),
            LostFoundClaim.find({ claimant: userId })
                .select('report message status createdAt updatedAt')
                .populate({ path: 'report', select: 'title type status createdAt' })
                .sort({ createdAt: -1 })
                .limit(ACTIVITY_LIMIT)
                .lean(),
            CampusVoice.find({ author: userId }).select('content category createdAt').sort({ createdAt: -1 }).limit(ACTIVITY_LIMIT).lean(),
            Product.countDocuments({ seller: userId }),
            LostFoundReport.countDocuments({ reportedBy: userId }),
            LostFoundClaim.countDocuments({ claimant: userId }),
            CampusVoice.countDocuments({ author: userId }),
        ])

        res.json({
            success: true,
            activity: {
                products,
                reports,
                claims,
                confessions: posts.map(serializePrivateConfession),
            },
            counts: {
                products: productCount,
                reports: reportCount,
                claims: claimCount,
                confessions: postCount,
            },
            activityLimit: ACTIVITY_LIMIT,
        })
    } catch (error) {
        next(error)
    }
}

module.exports = { getStudentDashboard, serializePrivateConfession, ACTIVITY_LIMIT }
