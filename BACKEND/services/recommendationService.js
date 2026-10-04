const Product = require('../models/Product')
const ProductView = require('../models/ProductView')
const Wishlist = require('../models/Wishlist')

const MAX_ACTIVITY_RECORDS = 100
const MAX_CANDIDATES = 250
const MAX_RECOMMENDATIONS = 20
const sellerFields = 'name college profileImage'

function countValues(items, field) {
    const counts = new Map()
    for (const item of items) {
        const value = item?.[field]
        if (typeof value !== 'string' || !value.trim()) continue
        counts.set(value, (counts.get(value) || 0) + 1)
    }
    return counts
}

function percentile(sortedValues, fraction) {
    if (sortedValues.length === 0) return null
    const index = Math.floor((sortedValues.length - 1) * fraction)
    return sortedValues[index]
}

function priceRange(items) {
    const prices = items
        .map((item) => Number(item?.price))
        .filter((price) => Number.isFinite(price) && price > 0)
        .sort((first, second) => first - second)

    if (prices.length === 0) return null

    const lowerQuartile = percentile(prices, 0.25)
    const upperQuartile = percentile(prices, 0.75)
    const spread = upperQuartile - lowerQuartile
    const padding = spread === 0 ? Math.max(lowerQuartile * 0.2, 100) : spread * 0.15

    return {
        min: Math.max(0, lowerQuartile - padding),
        max: upperQuartile + padding,
    }
}

function productModerationFilter() {
    return {
        $or: [
            { moderationStatus: 'active' },
            { moderationStatus: { $exists: false } },
        ],
    }
}

function recommendationReason({ savedCategoryMatch, viewedCategoryMatch, priceMatch, collegeMatch, conditionMatch }) {
    if (savedCategoryMatch) return 'Because you saved similar items.'
    if (viewedCategoryMatch) return 'Because you viewed similar items.'
    if (priceMatch) return 'Within the price range of items you saved or viewed.'
    if (collegeMatch) return 'From your college marketplace.'
    if (conditionMatch) return 'Matches the condition of items you saved.'
    return null
}

function scoreProduct(product, preferences) {
    const savedCategoryMatch = preferences.savedCategorySet.has(product.category)
    const viewedCategoryMatch = preferences.viewedCategorySet.has(product.category)
    const priceMatch = Boolean(preferences.priceRange
        && product.price >= preferences.priceRange.min
        && product.price <= preferences.priceRange.max)
    const collegeMatch = Boolean(preferences.college && product.college === preferences.college)
    const conditionMatch = Boolean(preferences.commonCondition && product.condition === preferences.commonCondition)

    const score = (savedCategoryMatch ? 5 : 0)
        + (viewedCategoryMatch ? 3 : 0)
        + (priceMatch ? 2 : 0)
        + (collegeMatch ? 2 : 0)
        + (conditionMatch ? 1 : 0)

    return {
        score,
        reason: recommendationReason({ savedCategoryMatch, viewedCategoryMatch, priceMatch, collegeMatch, conditionMatch }),
    }
}

async function getRecommendations(user) {
    const userId = user._id
    const [savedEntries, viewEntries] = await Promise.all([
        Wishlist.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(MAX_ACTIVITY_RECORDS)
            .populate('product', 'category price condition'),
        ProductView.find({ user: userId })
            .sort({ lastViewedAt: -1 })
            .limit(MAX_ACTIVITY_RECORDS)
            .populate('product', 'category price condition'),
    ])

    const savedProducts = savedEntries.map((entry) => entry.product).filter(Boolean)
    const viewedProducts = viewEntries.map((entry) => entry.product).filter(Boolean)
    const activityCount = savedProducts.length + viewedProducts.length

    if (activityCount === 0) {
        return { personalized: false, products: [] }
    }

    const savedCategoryCounts = countValues(savedProducts, 'category')
    const viewedCategoryCounts = countValues(viewedProducts, 'category')
    const savedConditionCounts = countValues(savedProducts, 'condition')
    const savedCategorySet = new Set(savedCategoryCounts.keys())
    const viewedCategorySet = new Set(viewedCategoryCounts.keys())
    const allActivityProducts = [...savedProducts, ...viewedProducts]
    const userPriceRange = priceRange(allActivityProducts)
    const commonCondition = [...savedConditionCounts.entries()]
        .sort((first, second) => second[1] - first[1])[0]?.[0] || null
    const savedProductIds = savedProducts.map((product) => product._id)

    const candidateSignals = []
    const relevantCategories = new Set([...savedCategorySet, ...viewedCategorySet])
    if (relevantCategories.size > 0) candidateSignals.push({ category: { $in: [...relevantCategories] } })
    if (userPriceRange) candidateSignals.push({ price: { $gte: userPriceRange.min, $lte: userPriceRange.max } })
    if (user.college) candidateSignals.push({ college: user.college })

    if (candidateSignals.length === 0) {
        return { personalized: false, products: [] }
    }

    const candidates = await Product.find({
        status: 'available',
        seller: { $ne: userId },
        _id: { $nin: savedProductIds },
        $and: [
            productModerationFilter(),
            { $or: candidateSignals },
        ],
    })
        .populate('seller', sellerFields)
        .sort({ createdAt: -1 })
        .limit(MAX_CANDIDATES)

    const recommendations = candidates.map((product) => {
        return {
            product,
            ...scoreProduct(product, {
                savedCategorySet,
                viewedCategorySet,
                priceRange: userPriceRange,
                college: user.college,
                commonCondition,
            }),
        }
    })
        .filter((recommendation) => recommendation.score > 0)
        .sort((first, second) => second.score - first.score || new Date(second.product.createdAt) - new Date(first.product.createdAt))
        .slice(0, MAX_RECOMMENDATIONS)
        .map(({ product, reason }) => ({
            ...product.toObject(),
            recommendationReason: reason,
        }))

    return { personalized: true, products: recommendations }
}

module.exports = { getRecommendations, productModerationFilter, priceRange, scoreProduct }
