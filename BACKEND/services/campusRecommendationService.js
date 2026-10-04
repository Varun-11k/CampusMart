const Resource = require('../models/Resource')
const recommendationService = require('./recommendationService')

const RESOURCE_LIMIT = 5
const resourceFields = 'title description type subject course semester year fileUrl externalUrl thumbnailUrl downloads createdAt'

function safeProduct(product) {
    const seller = product.seller && typeof product.seller === 'object'
        ? { name: product.seller.name, college: product.seller.college, profileImage: product.seller.profileImage }
        : undefined
    return {
        _id: product._id,
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        condition: product.condition,
        images: product.images,
        college: product.college,
        status: product.status,
        createdAt: product.createdAt,
        ...(seller ? { seller } : {}),
        recommendationReason: product.recommendationReason,
    }
}

function safeResource(resource) {
    const fields = ['_id', 'title', 'description', 'type', 'subject', 'course', 'semester', 'year', 'fileUrl', 'externalUrl', 'thumbnailUrl', 'downloads', 'createdAt']
    return Object.fromEntries(fields.filter((field) => resource[field] !== undefined).map((field) => [field, resource[field]]))
}

async function getCampusRecommendations(user) {
    const productResult = await recommendationService.getRecommendations(user)
    if (!productResult.personalized) return { personalized: false, marketplace: [], resources: [], lostFound: [] }

    const popularResources = await Resource.find({ status: 'active', downloads: { $gt: 0 } })
        .select(resourceFields)
        .sort({ downloads: -1, createdAt: -1 })
        .limit(RESOURCE_LIMIT)
        .lean()

    return {
        personalized: true,
        marketplace: (productResult.products || []).map(safeProduct),
        resources: popularResources.map((resource) => ({
            ...safeResource(resource),
            recommendationReason: 'Frequently accessed campus resource.',
        })),
        // There is no persisted Lost & Found browsing context; omit these unless a relevant search is supplied.
        lostFound: [],
    }
}

module.exports = { getCampusRecommendations, safeProduct, safeResource, RESOURCE_LIMIT, resourceFields }
