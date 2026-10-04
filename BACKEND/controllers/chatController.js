const mongoose = require('mongoose')
const Conversation = require('../models/Conversation')
const Message = require('../models/Message')
const Product = require('../models/Product')
const LostFoundReport = require('../models/LostFoundReport')
const CampusExchange = require('../models/CampusExchange')
const { getIO } = require('../socketManager')
const { createAndEmitNotification } = require('../services/notificationService')

const participantFields = 'name profileImage'
const MAX_MESSAGE_LENGTH = 5000

function serializeUser(user) {
    if (!user) return null
    return {
        _id: user._id,
        name: user.name,
        profileImage: user.profileImage,
    }
}

function sanitizeMessage(message) {
    if (!message) return null
    return {
        _id: message._id,
        conversation: message.conversation,
        sender: serializeUser(message.sender),
        text: message.text,
        read: !!message.read,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
    }
}

async function createConversation(req, res, next) {
    try {
        const { productId } = req.body || {}

        if (!productId || !mongoose.isValidObjectId(productId)) {
            return res.status(400).json({ success: false, message: 'A valid productId is required' })
        }

        const product = await Product.findOne({
            _id: productId,
            $or: [
                { moderationStatus: 'active' },
                { moderationStatus: { $exists: false } },
            ],
        }).populate('seller', participantFields)

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' })
        }

        const buyerId = req.user._id.toString()
        const sellerId = product.seller?._id?.toString()

        if (!sellerId) {
            return res.status(400).json({ success: false, message: 'This product does not have a valid seller' })
        }

        if (buyerId === sellerId) {
            return res.status(400).json({ success: false, message: 'You cannot start a conversation with yourself' })
        }

        const participantKey = [buyerId, sellerId].sort().join(':')
        let conversation = await Conversation.findOne({
            product: product._id,
            participantKey,
        }).select('+participantKey')

        if (!conversation) {
            conversation = await Conversation.findOne({
                product: product._id,
                participants: { $all: [buyerId, sellerId] },
            }).select('+participantKey')
        }

        if (conversation) {
            if (!conversation.participantKey) {
                conversation.participantKey = participantKey
                await conversation.save()
            }
            await conversation.populate('participants', participantFields)
            await conversation.populate('product')
            return res.status(200).json({ success: true, conversation })
        }

        conversation = await Conversation.create({
            participants: [buyerId, sellerId],
            product: product._id,
            participantKey,
            lastMessage: '',
        })

        await conversation.populate('participants', participantFields)
        await conversation.populate('product')

        res.status(201).json({ success: true, conversation })
    } catch (error) {
        if (error.code === 11000) {
            try {
                const productId = req.body?.productId
                const product = await Product.findById(productId)
                const sellerId = product?.seller?.toString()
                if (sellerId) {
                    const participantKey = [req.user._id.toString(), sellerId].sort().join(':')
                    const conversation = await Conversation.findOne({ product: productId, participantKey })
                        .populate('participants', participantFields)
                        .populate('product')
                    if (conversation) {
                        return res.status(200).json({ success: true, conversation })
                    }
                }
            } catch (lookupError) {
                return next(lookupError)
            }
        }
        next(error)
    }
}

async function createLostFoundConversation(req, res, next) {
    try {
        const { reportId } = req.body || {}
        if (!mongoose.isValidObjectId(reportId)) return res.status(400).json({ success: false, message: 'A valid reportId is required' })
        const report = await LostFoundReport.findById(reportId).select('reportedBy title status images category type')
        if (!report || report.status === 'closed') return res.status(404).json({ success: false, message: 'Report not found or closed' })
        const ownerId = report.reportedBy.toString()
        const participantId = req.user._id.toString()
        if (ownerId === participantId) return res.status(400).json({ success: false, message: 'You cannot start a conversation with yourself' })
        const participantKey = [participantId, ownerId].sort().join(':')
        let conversation = await Conversation.findOne({ lostFoundReport: report._id, participantKey }).select('+participantKey')
        if (!conversation) conversation = await Conversation.findOne({ lostFoundReport: report._id, participants: { $all: [participantId, ownerId] } }).select('+participantKey')
        if (!conversation) conversation = await Conversation.create({ participants: [participantId, ownerId], lostFoundReport: report._id, participantKey, lastMessage: '' })
        else if (!conversation.participantKey) { conversation.participantKey = participantKey; await conversation.save() }
        await conversation.populate('participants', participantFields)
        await conversation.populate('lostFoundReport', 'title images category type status')
        res.status(201).json({ success: true, conversation })
    } catch (error) {
        if (error.code === 11000) {
            try {
                const reportId = req.body?.reportId
                const report = await LostFoundReport.findById(reportId).select('reportedBy')
                const participantKey = [req.user._id.toString(), report.reportedBy.toString()].sort().join(':')
                const conversation = await Conversation.findOne({ lostFoundReport: reportId, participantKey }).populate('participants', participantFields).populate('lostFoundReport', 'title images category type status')
                if (conversation) return res.status(200).json({ success: true, conversation })
            } catch (lookupError) { return next(lookupError) }
        }
        next(error)
    }
}

async function createCampusExchangeConversation(req, res, next) {
    try {
        const { exchangeId } = req.body || {}
        if (!mongoose.isValidObjectId(exchangeId)) return res.status(400).json({ success: false, message: 'A valid exchangeId is required' })
        const exchange = await CampusExchange.findOne({ _id: exchangeId, status: 'active', moderationStatus: 'active' }).select('owner title images category status')
        if (!exchange) return res.status(404).json({ success: false, message: 'Active exchange listing not found' })
        const ownerId = exchange.owner.toString()
        const participantId = req.user._id.toString()
        if (ownerId === participantId) return res.status(400).json({ success: false, message: 'You cannot start a conversation with yourself' })
        const participantKey = [participantId, ownerId].sort().join(':')
        let conversation = await Conversation.findOne({ campusExchange: exchange._id, participantKey }).select('+participantKey')
        if (!conversation) conversation = await Conversation.findOne({ campusExchange: exchange._id, participants: { $all: [participantId, ownerId] } }).select('+participantKey')
        if (!conversation) conversation = await Conversation.create({ participants: [participantId, ownerId], campusExchange: exchange._id, participantKey, lastMessage: '' })
        else if (!conversation.participantKey) { conversation.participantKey = participantKey; await conversation.save() }
        await conversation.populate('participants', participantFields)
        await conversation.populate('campusExchange', 'title images category status')
        return res.status(201).json({ success: true, conversation })
    } catch (error) {
        if (error.code === 11000) {
            try {
                const exchange = await CampusExchange.findById(req.body?.exchangeId).select('owner')
                if (!exchange) return res.status(404).json({ success: false, message: 'Exchange listing not found' })
                const participantKey = [req.user._id.toString(), exchange.owner.toString()].sort().join(':')
                const conversation = await Conversation.findOne({ campusExchange: exchange._id, participantKey }).populate('participants', participantFields).populate('campusExchange', 'title images category status')
                if (conversation) return res.status(200).json({ success: true, conversation })
            } catch (lookupError) { return next(lookupError) }
        }
        next(error)
    }
}

async function getConversations(req, res, next) {
    try {
        const conversations = await Conversation.find({ participants: req.user._id })
            .populate('participants', participantFields)
            .populate('product', 'title images category condition price status')
            .populate('lostFoundReport', 'title images category type status')
            .populate('campusExchange', 'title images category status')
            .sort({ updatedAt: -1 })

        const finalConversations = await Promise.all(conversations.map(async (conversation) => {
            const otherUser = conversation.participants.find((participant) => participant._id.toString() !== req.user._id.toString())
            const lastMessage = await Message.findOne({ conversation: conversation._id })
                .populate('sender', participantFields)
                .sort({ createdAt: -1 })
                .lean()

            const unreadCount = await Message.countDocuments({
                conversation: conversation._id,
                sender: { $ne: req.user._id },
                read: false,
            })

            return {
                _id: conversation._id,
                product: conversation.product,
                lostFoundReport: conversation.lostFoundReport,
                campusExchange: conversation.campusExchange,
                participants: conversation.participants.map((participant) => serializeUser(participant)),
                otherUser: serializeUser(otherUser),
                lastMessage: lastMessage ? {
                    _id: lastMessage._id,
                    text: lastMessage.text,
                    sender: serializeUser(lastMessage.sender),
                    createdAt: lastMessage.createdAt,
                } : null,
                unreadCount,
                updatedAt: conversation.updatedAt,
                createdAt: conversation.createdAt,
            }
        }))

        res.json({ success: true, conversations: finalConversations })
    } catch (error) {
        next(error)
    }
}

async function getConversationMessages(req, res, next) {
    try {
        const { conversationId } = req.params

        if (!mongoose.isValidObjectId(conversationId)) {
            return res.status(400).json({ success: false, message: 'Invalid conversation ID' })
        }

        const conversation = await Conversation.findById(conversationId)
            .populate('participants', participantFields)
            .populate('product', 'title images category condition price status')
            .populate('lostFoundReport', 'title images category type status')
            .populate('campusExchange', 'title images category status')

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found' })
        }

        const isParticipant = conversation.participants.some((participant) => participant._id.toString() === req.user._id.toString())

        if (!isParticipant) {
            return res.status(403).json({ success: false, message: 'You do not have access to this conversation' })
        }

        const readResult = await Message.updateMany(
            {
                conversation: conversation._id,
                sender: { $ne: req.user._id },
                read: false,
            },
            { $set: { read: true } }
        )

        const messages = await Message.find({ conversation: conversation._id })
            .populate('sender', participantFields)
            .sort({ createdAt: 1 })

        if (readResult.modifiedCount > 0) {
            getIO()?.to(conversation._id.toString()).emit('message_read', {
                conversationId: conversation._id.toString(),
                reader: serializeUser(req.user),
                readAt: new Date(),
            })
        }

        res.json({
            success: true,
            conversation: {
                _id: conversation._id,
                product: conversation.product,
                lostFoundReport: conversation.lostFoundReport,
                campusExchange: conversation.campusExchange,
                participants: conversation.participants.map((participant) => serializeUser(participant)),
                lastMessage: conversation.lastMessage,
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt,
            },
            messages: messages.map((message) => sanitizeMessage(message)),
        })
    } catch (error) {
        next(error)
    }
}

async function storeMessage({ conversationId, senderId, text }) {
    const normalizedText = typeof text === 'string' ? text.trim() : ''

    if (!mongoose.isValidObjectId(conversationId)) {
        const error = new Error('Invalid conversation ID')
        error.statusCode = 400
        throw error
    }

    if (!normalizedText) {
        const error = new Error('Message text is required')
        error.statusCode = 400
        throw error
    }

    if (normalizedText.length > MAX_MESSAGE_LENGTH) {
        const error = new Error(`Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer`)
        error.statusCode = 400
        throw error
    }

    const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: senderId,
    }).populate('product', 'title')
    .populate('lostFoundReport', 'title')
    .populate('campusExchange', 'title')

    if (!conversation) {
        const error = new Error('Conversation not found or access denied')
        error.statusCode = 403
        throw error
    }

    const message = await Message.create({
        conversation: conversation._id,
        sender: senderId,
        text: normalizedText,
        read: false,
    })

    const populatedMessage = await message.populate('sender', participantFields)
    conversation.lastMessage = populatedMessage.text
    conversation.updatedAt = new Date()
    await conversation.save()

    const safeMessage = sanitizeMessage(populatedMessage)
    const conversationRoom = conversation._id.toString()
    getIO()?.to(conversationRoom).emit('receive_message', {
        conversationId: conversationRoom,
        message: safeMessage,
    })

    const recipientId = conversation.participants.find((participantId) => participantId.toString() !== senderId.toString())
    if (recipientId) {
        const senderName = safeMessage.sender?.name || 'A student'
        const productTitle = conversation.product?.title || conversation.lostFoundReport?.title || conversation.campusExchange?.title || 'a listing'
        try {
            await createAndEmitNotification({
                recipient: recipientId,
                type: 'message',
                title: `New message from ${senderName}`,
                message: `${senderName} sent you a message about ${productTitle}.`,
                product: conversation.product?._id,
                conversation: conversation._id,
            })
        } catch (error) {
            console.error('Unable to create message notification:', error.message)
        }
    }

    return safeMessage
}

async function sendMessage(req, res, next) {
    try {
        const { conversationId } = req.params
        const { text } = req.body || {}

        const message = await storeMessage({ conversationId, senderId: req.user._id, text })
        res.status(201).json({ success: true, message })
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message })
        }
        next(error)
    }
}

module.exports = {
    createConversation,
    createLostFoundConversation,
    createCampusExchangeConversation,
    getConversations,
    getConversationMessages,
    sendMessage,
    storeMessage,
}
