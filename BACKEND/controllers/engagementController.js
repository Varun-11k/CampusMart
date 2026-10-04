const mongoose = require('mongoose')
const Product = require('../models/Product')
const SellerOffer = require('../models/SellerOffer')
const Coupon = require('../models/Coupon')
const Wishlist = require('../models/Wishlist')
const ProductView = require('../models/ProductView')
const CampusPointTransaction = require('../models/CampusPointTransaction')
const CampusChallenge = require('../models/CampusChallenge')
const CampusPoll = require('../models/CampusPoll')
const Resource = require('../models/Resource')
const CampusExchange = require('../models/CampusExchange')
const CampusVoice = require('../models/CampusVoice')
const LostFoundReport = require('../models/LostFoundReport')
const CampusExchangeRequest = require('../models/CampusExchangeRequest')
const CouponRedemption = require('../models/CouponRedemption')
const UserBadge = require('../models/UserBadge')
const { awardPoints } = require('../services/pointsService')
const { createAndEmitNotification } = require('../services/notificationService')

const publicProductFields = 'title description price category condition images college seller status createdAt'
const activeProduct = { status: 'available', $or: [{ moderationStatus: 'active' }, { moderationStatus: { $exists: false } }] }
const conditions = ['New', 'Like New', 'Good', 'Fair']
const offerStatuses = ['scheduled', 'active', 'expired', 'cancelled']
const dealLimit = 20
const couponCodePattern = /^[A-Z0-9_-]{3,40}$/

function safePage(query) { return Math.max(1, Math.min(10000, Number.parseInt(query.page, 10) || 1)) }
function safeLimit(query, fallback = 12) { return Math.max(1, Math.min(30, Number.parseInt(query.limit, 10) || fallback)) }
function validId(id) { return mongoose.isValidObjectId(id) }
function responseError(res, status, message) { return res.status(status).json({ success: false, message }) }
function offerIsActive(offer, now = new Date()) { return ['active', 'scheduled'].includes(offer.status) && new Date(offer.startTime) <= now && new Date(offer.endTime) > now }

async function getDeals(req, res, next) {
    try {
        const now = new Date(); const page = safePage(req.query); const limit = Math.min(dealLimit, safeLimit(req.query))
        const offers = await SellerOffer.find({ status: { $in: ['scheduled', 'active'] }, startTime: { $lte: now }, endTime: { $gt: now } }).sort({ endTime: 1 }).limit(300).lean()
        const byProduct = new Map()
        for (const offer of offers) if (!byProduct.has(offer.product.toString())) byProduct.set(offer.product.toString(), offer)
        const ids = [...byProduct.keys()]
        const [products, total] = ids.length ? await Promise.all([
            Product.find({ _id: { $in: ids }, ...activeProduct }).select(publicProductFields).populate('seller', 'name college profileImage').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Product.countDocuments({ _id: { $in: ids }, ...activeProduct }),
        ]) : [[], 0]
        const deals = products.map((product) => { const offer = byProduct.get(product._id.toString()); return { ...product, offer: { offerPrice: offer.offerPrice, endTime: offer.endTime, quantity: offer.quantity }, discountPercent: product.price > offer.offerPrice && product.price > 0 ? Math.round((product.price - offer.offerPrice) / product.price * 100) : 0 } })
        res.json({ success: true, deals, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) { next(error) }
}

async function createOffer(req, res, next) {
    try {
        const body = req.body || {}
        if (Object.keys(body).some((key) => !['product', 'offerPrice', 'startTime', 'endTime', 'quantity'].includes(key))) return responseError(res, 400, 'Unsupported offer fields')
        if (!validId(body.product)) return responseError(res, 400, 'A valid product is required')
        const offerPrice = Number(body.offerPrice); const startTime = new Date(body.startTime); const endTime = new Date(body.endTime)
        if (!Number.isFinite(offerPrice) || offerPrice <= 0 || offerPrice > 1_000_000_000) return responseError(res, 400, 'offerPrice must be a positive valid price')
        if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime()) || endTime <= startTime || endTime <= new Date()) return responseError(res, 400, 'Offer end time must be after its start time and in the future')
        const product = await Product.findOne({ _id: body.product, ...activeProduct }).select('seller price')
        if (!product) return responseError(res, 404, 'Available product not found')
        if (product.seller.toString() !== req.user._id.toString()) return responseError(res, 403, 'Only the product owner can create an offer')
        if (offerPrice >= product.price) return responseError(res, 400, 'Offer price must be below the listed product price')
        const overlappingOffer = await SellerOffer.exists({ product: product._id, status: { $in: ['scheduled', 'active'] }, startTime: { $lt: endTime }, endTime: { $gt: startTime } })
        if (overlappingOffer) return responseError(res, 409, 'This product already has an overlapping offer')
        const quantity = body.quantity === undefined || body.quantity === '' ? 1 : Number(body.quantity)
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) return responseError(res, 400, 'quantity must be between 1 and 1000')
        const status = startTime <= new Date() ? 'active' : 'scheduled'
        const offer = await SellerOffer.create({ product: product._id, seller: req.user._id, offerPrice, startTime, endTime, quantity, status })
        if (status === 'active') {
            const watchers = await Wishlist.distinct('user', { product: product._id, user: { $ne: req.user._id } })
            await Promise.all(watchers.map((recipient) => createAndEmitNotification({ recipient, type: 'offer', title: 'A wishlist item has a new offer', message: `${product.title} has a seller offer for ₹${offer.offerPrice.toLocaleString('en-IN')}.`, product: product._id }).catch(() => {})))
        }
        res.status(201).json({ success: true, offer })
    } catch (error) { next(error) }
}

async function myOffers(req, res, next) {
    try {
        const offers = await SellerOffer.find({ seller: req.user._id }).populate({ path: 'product', match: activeProduct, select: 'title price images status' }).sort({ createdAt: -1 }).limit(50).lean()
        res.json({ success: true, offers: offers.filter((offer) => offer.product).map((offer) => ({ ...offer, effectiveStatus: offerIsActive(offer) ? 'active' : offer.status === 'cancelled' ? 'cancelled' : new Date(offer.endTime) <= new Date() ? 'expired' : 'scheduled' })) })
    } catch (error) { next(error) }
}

async function updateOffer(req, res, next) {
    try {
        if (!validId(req.params.id)) return responseError(res, 400, 'Invalid offer ID')
        const body = req.body || {}; const allowed = ['offerPrice', 'startTime', 'endTime', 'quantity']
        if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) return responseError(res, 400, 'Provide offer fields only')
        const offer = await SellerOffer.findById(req.params.id)
        if (!offer) return responseError(res, 404, 'Offer not found')
        if (offer.seller.toString() !== req.user._id.toString()) return responseError(res, 403, 'Only the seller can edit this offer')
        if (offer.status === 'expired' || new Date(offer.endTime) <= new Date()) return responseError(res, 409, 'Expired offers cannot be reactivated or extended')
        const start = body.startTime === undefined ? offer.startTime : new Date(body.startTime)
        const end = body.endTime === undefined ? offer.endTime : new Date(body.endTime)
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end <= new Date()) return responseError(res, 400, 'Offer dates must be valid and the end time must be in the future')
        if (body.offerPrice !== undefined) { const price = Number(body.offerPrice); if (!Number.isFinite(price) || price <= 0) return responseError(res, 400, 'Invalid offer price'); offer.offerPrice = price }
        if (body.quantity !== undefined) { const quantity = Number(body.quantity); if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) return responseError(res, 400, 'Invalid offer quantity'); offer.quantity = quantity }
        const product = await Product.findById(offer.product).select('price status seller')
        if (!product || product.status !== 'available' || product.seller.toString() !== req.user._id.toString()) return responseError(res, 409, 'Offer product is no longer available')
        if (offer.offerPrice >= product.price) return responseError(res, 400, 'Offer price must be below the listed product price')
        const overlapping = await SellerOffer.exists({ _id: { $ne: offer._id }, product: product._id, status: { $in: ['scheduled', 'active'] }, startTime: { $lt: end }, endTime: { $gt: start } })
        if (overlapping) return responseError(res, 409, 'This product already has an overlapping offer')
        offer.startTime = start; offer.endTime = end
        if (offer.status !== 'cancelled') offer.status = start <= new Date() ? 'active' : 'scheduled'
        await offer.save(); res.json({ success: true, offer })
    } catch (error) { next(error) }
}

async function cancelOffer(req, res, next) {
    try {
        if (!validId(req.params.id)) return responseError(res, 400, 'Invalid offer ID')
        const offer = await SellerOffer.findById(req.params.id)
        if (!offer) return responseError(res, 404, 'Offer not found')
        if (offer.seller.toString() !== req.user._id.toString()) return responseError(res, 403, 'Only the seller can cancel this offer')
        offer.status = 'cancelled'; await offer.save(); res.json({ success: true, offer })
    } catch (error) { next(error) }
}

async function listCoupons(req, res, next) {
    try { const now = new Date(); const coupons = await Coupon.find({ active: true, startDate: { $lte: now }, expiryDate: { $gt: now }, $expr: { $lt: ['$usageCount', '$usageLimit'] } }).select('code type value minimumPurchase maximumDiscount startDate expiryDate').sort({ expiryDate: 1 }).limit(30).lean(); res.json({ success: true, coupons }) }
    catch (error) { next(error) }
}

async function createCoupon(req, res, next) {
    try {
        const body = req.body || {}; const allowed = ['code', 'type', 'value', 'minimumPurchase', 'maximumDiscount', 'startDate', 'expiryDate', 'usageLimit']
        if (Object.keys(body).some((key) => !allowed.includes(key))) return responseError(res, 400, 'Unsupported coupon fields')
        const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
        if (!couponCodePattern.test(code) || !['percentage', 'fixed'].includes(body.type)) return responseError(res, 400, 'Provide a valid coupon code and type')
        const value = Number(body.value); const minimumPurchase = Number(body.minimumPurchase || 0); const maximumDiscount = Number(body.maximumDiscount || 0); const usageLimit = Number(body.usageLimit || 1)
        const startDate = body.startDate ? new Date(body.startDate) : new Date(); const expiryDate = new Date(body.expiryDate)
        if (!Number.isFinite(value) || value <= 0 || value > (body.type === 'percentage' ? 100 : 1_000_000) || !Number.isFinite(minimumPurchase) || minimumPurchase < 0 || !Number.isFinite(maximumDiscount) || maximumDiscount < 0 || !Number.isInteger(usageLimit) || usageLimit < 1 || usageLimit > 100000 || !Number.isFinite(startDate.getTime()) || !Number.isFinite(expiryDate.getTime()) || expiryDate <= startDate || expiryDate <= new Date()) return responseError(res, 400, 'Coupon values or dates are invalid')
        const coupon = await Coupon.create({ code, type: body.type, value, minimumPurchase, maximumDiscount, usageLimit, perUserLimit: 1, startDate, expiryDate, createdBy: req.user._id })
        res.status(201).json({ success: true, coupon })
    } catch (error) { if (error.code === 11000) return responseError(res, 409, 'Coupon code already exists'); next(error) }
}

async function claimCoupon(req, res, next) {
    try {
        const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : ''
        const purchaseAmount = Number(req.body?.purchaseAmount)
        if (!couponCodePattern.test(code) || !Number.isFinite(purchaseAmount) || purchaseAmount < 0 || purchaseAmount > 1_000_000_000) return responseError(res, 400, 'Provide a valid coupon code and purchase amount')
        const now = new Date(); const coupon = await Coupon.findOne({ code, active: true, startDate: { $lte: now }, expiryDate: { $gt: now } })
        if (!coupon) return responseError(res, 404, 'Coupon is invalid or expired')
        if (purchaseAmount < coupon.minimumPurchase) return responseError(res, 400, 'Purchase amount does not meet the coupon minimum')
        const prior = await CouponRedemption.exists({ coupon: coupon._id, user: req.user._id })
        if (prior) return responseError(res, 409, 'This coupon has already been claimed by your account')
        const claimed = await Coupon.findOneAndUpdate({ _id: coupon._id, active: true, expiryDate: { $gt: now }, $expr: { $lt: ['$usageCount', '$usageLimit'] } }, { $inc: { usageCount: 1 } }, { new: true })
        if (!claimed) return responseError(res, 409, 'Coupon usage limit has been reached')
        const rawDiscount = claimed.type === 'percentage' ? purchaseAmount * claimed.value / 100 : claimed.value
        const discountAmount = Math.min(purchaseAmount, claimed.maximumDiscount > 0 ? Math.min(rawDiscount, claimed.maximumDiscount) : rawDiscount)
        try {
            const redemption = await CouponRedemption.create({ coupon: claimed._id, user: req.user._id, purchaseAmount, discountAmount })
            return res.json({ success: true, redemption: { _id: redemption._id, coupon: claimed.code, purchaseAmount, discountAmount, informationalOnly: true } })
        } catch (error) {
            await Coupon.updateOne({ _id: claimed._id }, { $inc: { usageCount: -1 } })
            if (error.code === 11000) return responseError(res, 409, 'This coupon has already been claimed by your account')
            throw error
        }
    } catch (error) { next(error) }
}

async function trending(req, res, next) {
    try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        const [views, saves] = await Promise.all([
            ProductView.aggregate([{ $match: { lastViewedAt: { $gte: since } } }, { $group: { _id: '$product', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 100 }]),
            Wishlist.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$product', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 100 }]),
        ])
        const scores = new Map()
        for (const item of views) scores.set(item._id.toString(), (scores.get(item._id.toString()) || 0) + item.count)
        for (const item of saves) scores.set(item._id.toString(), (scores.get(item._id.toString()) || 0) + item.count * 3)
        const ids = [...scores.keys()]
        const products = ids.length ? await Product.find({ _id: { $in: ids }, ...activeProduct }).select(publicProductFields).populate('seller', 'name college profileImage').lean() : []
        products.sort((a, b) => scores.get(b._id.toString()) - scores.get(a._id.toString()) || new Date(b.createdAt) - new Date(a.createdAt))
        res.json({ success: true, products: products.slice(0, 20) })
    } catch (error) { next(error) }
}

async function recentlyViewed(req, res, next) {
    try {
        const views = await ProductView.find({ user: req.user._id }).sort({ lastViewedAt: -1 }).limit(20).populate({ path: 'product', match: activeProduct, select: publicProductFields, populate: { path: 'seller', select: 'name college profileImage' } }).lean()
        res.json({ success: true, products: views.map((view) => view.product && { ...view.product, lastViewedAt: view.lastViewedAt }).filter(Boolean) })
    } catch (error) { next(error) }
}

async function pointSummary(req, res, next) {
    try {
        const [summary, transactions, badges, completedAsOwner, completedAsRequester, soldListings, resourcesShared] = await Promise.all([
            CampusPointTransaction.aggregate([{ $match: { user: new mongoose.Types.ObjectId(req.user._id) } }, { $group: { _id: null, balance: { $sum: '$points' } } }]),
            CampusPointTransaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20).select('action points description createdAt').lean(),
            UserBadge.find({ user: req.user._id }).populate('badge', 'name icon description').sort({ earnedAt: -1 }).limit(30).lean(),
            CampusExchange.countDocuments({ owner: req.user._id, status: 'exchanged' }),
            CampusExchangeRequest.countDocuments({ requester: req.user._id, status: 'accepted' }),
            Product.countDocuments({ seller: req.user._id, status: 'sold' }),
            Resource.countDocuments({ uploadedBy: req.user._id, status: 'active' }),
        ])
        res.json({ success: true, balance: summary[0]?.balance || 0, transactions, badges: badges.map((item) => ({ ...item.badge, earnedAt: item.earnedAt })), reputation: { completedExchanges: completedAsOwner + completedAsRequester, listingsMarkedSold: soldListings, sharedResources: resourcesShared } })
    } catch (error) { next(error) }
}

async function listChallenges(req, res, next) {
    try {
        const now = new Date()
        const challenges = await CampusChallenge.find({ status: 'active', startDate: { $lte: now }, endDate: { $gt: now } }).sort({ endDate: 1 }).limit(30).lean()
        const withProgress = await Promise.all(challenges.map(async (challenge) => ({ ...challenge, progress: await challengeProgress(challenge, req.user?._id) })))
        res.json({ success: true, challenges: withProgress })
    } catch (error) { next(error) }
}

async function createChallenge(req, res, next) {
    try {
        const body = req.body || {}; const allowed = ['title', 'description', 'type', 'target', 'rewardPoints', 'startDate', 'endDate']
        if (Object.keys(body).some((key) => !allowed.includes(key))) return responseError(res, 400, 'Unsupported challenge fields')
        const title = typeof body.title === 'string' ? body.title.trim() : ''; const description = typeof body.description === 'string' ? body.description.trim() : ''
        const types = ['exchange', 'resource', 'lost_found', 'community']; const target = Number(body.target); const rewardPoints = Number(body.rewardPoints); const startDate = new Date(body.startDate); const endDate = new Date(body.endDate)
        if (!title || title.length > 120 || !description || description.length > 500 || !types.includes(body.type) || !Number.isInteger(target) || target < 1 || target > 10000 || !Number.isInteger(rewardPoints) || rewardPoints < 0 || rewardPoints > 10000 || !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) return responseError(res, 400, 'Challenge fields are invalid')
        const challenge = await CampusChallenge.create({ title, description, type: body.type, target, rewardPoints, startDate, endDate, status: 'active' })
        res.status(201).json({ success: true, challenge })
    } catch (error) { next(error) }
}

async function claimChallengeReward(req, res, next) {
    try {
        if (!validId(req.params.id)) return responseError(res, 400, 'Invalid challenge ID')
        const challenge = await CampusChallenge.findOne({ _id: req.params.id, status: 'active' })
        if (!challenge) return responseError(res, 404, 'Challenge not found')
        const now = new Date(); if (now < challenge.startDate || now > challenge.endDate) return responseError(res, 409, 'Challenge is not currently active')
        const progress = await challengeProgress(challenge, req.user._id)
        if (progress < challenge.target) return responseError(res, 409, 'Complete the challenge goal before claiming its reward')
        const awarded = await awardPoints({ user: req.user._id, action: 'challenge_completed', points: challenge.rewardPoints, referenceType: 'CampusChallenge', referenceId: challenge._id, description: `Completed: ${challenge.title}` })
        if (!awarded) return responseError(res, 409, 'Challenge reward has already been claimed')
        await createAndEmitNotification({ recipient: req.user._id, type: 'challenge', title: 'Challenge reward claimed', message: `${challenge.rewardPoints} Campus Points were added for ${challenge.title}.` }).catch(() => {})
        res.json({ success: true, points: challenge.rewardPoints })
    } catch (error) { next(error) }
}

async function challengeProgress(challenge, userId) {
    if (!userId) return 0
    const range = { createdAt: { $gte: challenge.startDate, $lte: challenge.endDate } }
    if (challenge.type === 'exchange') {
        const completed = await CampusExchangeRequest.aggregate([
            { $match: { status: 'accepted', ...range } },
            { $lookup: { from: CampusExchange.collection.name, localField: 'exchange', foreignField: '_id', as: 'exchangeDoc' } },
            { $unwind: '$exchangeDoc' },
            { $match: { $or: [{ requester: new mongoose.Types.ObjectId(userId) }, { 'exchangeDoc.owner': new mongoose.Types.ObjectId(userId) }] } },
            { $count: 'total' },
        ])
        return completed[0]?.total || 0
    }
    if (challenge.type === 'resource') return Resource.countDocuments({ uploadedBy: userId, status: 'active', ...range })
    if (challenge.type === 'lost_found') return LostFoundReport.countDocuments({ reportedBy: userId, status: 'returned', ...range })
    if (challenge.type === 'marketplace') return 0 // The marketplace has no buyer-confirmed purchase record.
    if (challenge.type === 'community') return CampusVoice.countDocuments({ author: userId, status: 'active', ...range })
    return 0
}

function serializePoll(poll, userId) {
    const votes = poll.votes || []; const counts = poll.options.map((_, index) => votes.filter((vote) => vote.optionIndex === index).length)
    return { _id: poll._id, question: poll.question, options: poll.options, status: poll.status, endDate: poll.endDate, createdAt: poll.createdAt, counts, totalVotes: votes.length, voted: Boolean(userId && votes.some((vote) => vote.user.toString() === userId.toString())), isMine: Boolean(userId && poll.author.toString() === userId.toString()) }
}

async function listPolls(req, res, next) {
    try { const polls = await CampusPoll.find({ status: 'active', $or: [{ endDate: null }, { endDate: { $gt: new Date() } }] }).sort({ createdAt: -1 }).limit(30).lean(); res.json({ success: true, polls: polls.map((poll) => serializePoll(poll, req.user?._id)) }) }
    catch (error) { next(error) }
}

async function createPoll(req, res, next) {
    try {
        const { question, options, endDate } = req.body || {}
        if (Object.keys(req.body || {}).some((key) => !['question', 'options', 'endDate'].includes(key))) return responseError(res, 400, 'Unsupported poll fields')
        if (typeof question !== 'string' || !question.trim() || question.trim().length > 200 || !Array.isArray(options) || options.length < 2 || options.length > 6 || options.some((option) => typeof option !== 'string' || !option.trim() || option.trim().length > 80)) return responseError(res, 400, 'Provide a question and 2 to 6 valid options')
        const expiry = endDate ? new Date(endDate) : null
        if (endDate && (!Number.isFinite(expiry.getTime()) || expiry <= new Date())) return responseError(res, 400, 'Poll end date must be in the future')
        const poll = await CampusPoll.create({ question: question.trim(), options: options.map((option) => option.trim()), author: req.user._id, endDate: expiry })
        res.status(201).json({ success: true, poll: serializePoll(poll, req.user._id) })
    } catch (error) { next(error) }
}

async function votePoll(req, res, next) {
    try {
        if (!validId(req.params.id)) return responseError(res, 400, 'Invalid poll ID')
        const optionIndex = req.body?.optionIndex
        if (!Number.isInteger(optionIndex) || optionIndex < 0) return responseError(res, 400, 'Choose a valid poll option')
        const poll = await CampusPoll.findOneAndUpdate({ _id: req.params.id, status: 'active', $or: [{ endDate: null }, { endDate: { $gt: new Date() } }], options: { $exists: true }, votes: { $not: { $elemMatch: { user: req.user._id } } } }, { $push: { votes: { user: req.user._id, optionIndex } } }, { new: true })
        if (!poll) return responseError(res, 409, 'Poll is closed, expired, or you have already voted')
        if (optionIndex >= poll.options.length) { await CampusPoll.updateOne({ _id: poll._id }, { $pull: { votes: { user: req.user._id } } }); return responseError(res, 400, 'Choose a valid poll option') }
        res.json({ success: true, poll: serializePoll(poll, req.user._id) })
    } catch (error) { next(error) }
}

async function closePoll(req, res, next) {
    try {
        if (!validId(req.params.id)) return responseError(res, 400, 'Invalid poll ID')
        const poll = await CampusPoll.findById(req.params.id)
        if (!poll) return responseError(res, 404, 'Poll not found')
        if (poll.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') return responseError(res, 403, 'Only the poll creator or an admin can close this poll')
        poll.status = 'closed'; await poll.save(); res.json({ success: true, poll: serializePoll(poll, req.user._id) })
    } catch (error) { next(error) }
}

async function weeklyFeed(req, res, next) {
    try {
        const [products, deals, exchanges, resources, voices, lostFound] = await Promise.all([
            trendingProducts(), getDealDocs(), CampusExchange.find({ status: 'active', moderationStatus: 'active' }).select('title offeredItem wantedItem category condition location images createdAt').sort({ createdAt: -1 }).limit(6).lean(),
            Resource.find({ status: 'active', downloads: { $gt: 0 } }).select('title type subject course semester year downloads createdAt').sort({ downloads: -1, createdAt: -1 }).limit(6).lean(),
            CampusVoice.find({ status: 'active' }).select('-author -likes -__v').sort({ createdAt: -1 }).limit(6).lean(),
            LostFoundReport.find({ status: 'active' }).select('title type category location date images status').sort({ createdAt: -1 }).limit(6).lean(),
        ])
        res.json({ success: true, feed: { trending: products, deals, exchanges, resources, voices: voices.map((voice) => ({ ...voice, authorLabel: 'Anonymous Student' })), lostFound } })
    } catch (error) { next(error) }
}

async function trendingProducts() {
    const since = new Date(Date.now() - 7 * 86400000)
    const [views, saves] = await Promise.all([ProductView.aggregate([{ $match: { lastViewedAt: { $gte: since } } }, { $group: { _id: '$product', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 40 }]), Wishlist.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$product', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 40 }])])
    const score = new Map(); for (const row of views) score.set(row._id.toString(), row.count); for (const row of saves) score.set(row._id.toString(), (score.get(row._id.toString()) || 0) + row.count * 3)
    const ids = [...score.keys()]; if (!ids.length) return []
    const products = await Product.find({ _id: { $in: ids }, ...activeProduct }).select(publicProductFields).lean()
    return products.sort((a, b) => score.get(b._id.toString()) - score.get(a._id.toString())).slice(0, 6)
}

async function getDealDocs() {
    const now = new Date(); const offers = await SellerOffer.find({ status: { $in: ['active', 'scheduled'] }, startTime: { $lte: now }, endTime: { $gt: now } }).sort({ endTime: 1 }).limit(100).lean()
    const ids = [...new Set(offers.map((offer) => offer.product.toString()))]; if (!ids.length) return []
    const products = await Product.find({ _id: { $in: ids }, ...activeProduct }).select(publicProductFields).limit(6).lean(); const byId = new Map(offers.map((offer) => [offer.product.toString(), offer]))
    return products.map((product) => { const offer = byId.get(product._id.toString()); return { ...product, offer: offer && { offerPrice: offer.offerPrice, endTime: offer.endTime, quantity: offer.quantity } } })
}

module.exports = { getDeals, createOffer, myOffers, updateOffer, cancelOffer, listCoupons, createCoupon, claimCoupon, trending, recentlyViewed, pointSummary, listChallenges, createChallenge, claimChallengeReward, listPolls, createPoll, votePoll, closePoll, weeklyFeed, offerIsActive, serializePoll, challengeProgress, publicProductFields, conditions, offerStatuses }
