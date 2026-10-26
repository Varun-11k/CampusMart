require('dotenv').config()

const http = require('http')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const { Server } = require('socket.io')
const app = require('./app')
const connectDatabase = require('./config/database')
const User = require('./models/User')
const Conversation = require('./models/Conversation')
const Message = require('./models/Message')
const { storeMessage } = require('./controllers/chatController')
const { setIO } = require('./socketManager')

const port = process.env.PORT || 5000

const httpServer = http.createServer(app)
const socketOrigins = (process.env.CORS_ORIGINS || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173,http://127.0.0.1:5173'))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
const io = new Server(httpServer, {
    cors: {
        origin: socketOrigins,
        methods: ['GET', 'POST'],
    },
    allowRequest(req, callback) {
        const origin = req.headers.origin
        callback(null, !origin || socketOrigins.includes(origin))
    },
})

setIO(io)

io.use(async (socket, next) => {
    const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization || ''
    const token = typeof rawToken === 'string' && rawToken.startsWith('Bearer ')
        ? rawToken.slice(7)
        : rawToken

    if (!token || !process.env.JWT_SECRET) {
        return next(new Error('Authentication required'))
    }

    try {
        if (Buffer.byteLength(process.env.JWT_SECRET) < 32) return next(new Error('Authentication unavailable'))
        const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
        if (typeof payload.userId !== 'string') return next(new Error('Authentication required'))
        const user = await User.findById(payload.userId).select('name profileImage +tokenVersion +deactivatedAt')
        if (!user || user.deactivatedAt || (payload.tokenVersion ?? 0) !== (user.tokenVersion || 0)) {
            return next(new Error('User no longer exists'))
        }

        socket.data.user = user
        next()
    } catch {
        next(new Error('Invalid or expired token'))
    }
})

function getConversationId(payload) {
    return typeof payload === 'string' ? payload : payload?.conversationId
}

function acknowledge(callback, response) {
    if (typeof callback === 'function') callback(response)
}

async function findParticipantConversation(socket, conversationId) {
    if (!mongoose.isValidObjectId(conversationId)) return null
    return Conversation.findOne({
        _id: conversationId,
        participants: socket.data.user._id,
    }).select('_id participants')
}

io.on('connection', (socket) => {
    socket.join(`user:${socket.data.user._id.toString()}`)

    socket.on('join_conversation', async (payload, callback) => {
        try {
            const conversationId = getConversationId(payload)
            const conversation = await findParticipantConversation(socket, conversationId)
            if (!conversation) {
                return acknowledge(callback, { success: false, message: 'Conversation not found or access denied' })
            }

            await socket.join(conversation._id.toString())
            acknowledge(callback, { success: true })
        } catch (error) {
            acknowledge(callback, { success: false, message: 'Unable to join conversation' })
        }
    })

    socket.on('send_message', async (payload, callback) => {
        try {
            const conversationId = getConversationId(payload)
            const message = await storeMessage({
                conversationId,
                senderId: socket.data.user._id,
                text: payload?.text,
            })
            acknowledge(callback, { success: true, message })
        } catch (error) {
            acknowledge(callback, {
                success: false,
                message: error.statusCode ? error.message : 'Unable to send message',
            })
        }
    })

    socket.on('typing', async (payload) => {
        const conversationId = getConversationId(payload)
        const conversation = await findParticipantConversation(socket, conversationId).catch(() => null)
        if (!conversation || !socket.rooms.has(conversation._id.toString())) return

        socket.to(conversation._id.toString()).emit('typing', {
            conversationId: conversation._id.toString(),
            user: { _id: socket.data.user._id, name: socket.data.user.name },
        })
    })

    socket.on('stop_typing', async (payload) => {
        const conversationId = getConversationId(payload)
        const conversation = await findParticipantConversation(socket, conversationId).catch(() => null)
        if (!conversation || !socket.rooms.has(conversation._id.toString())) return

        socket.to(conversation._id.toString()).emit('stop_typing', {
            conversationId: conversation._id.toString(),
            userId: socket.data.user._id,
        })
    })

    socket.on('message_read', async (payload, callback) => {
        try {
            const conversationId = getConversationId(payload)
            const conversation = await findParticipantConversation(socket, conversationId)
            if (!conversation) {
                return acknowledge(callback, { success: false, message: 'Conversation not found or access denied' })
            }

            const room = conversation._id.toString()
            if (!socket.rooms.has(room)) {
                return acknowledge(callback, { success: false, message: 'Join the conversation before marking messages read' })
            }

            const result = await Message.updateMany({
                conversation: conversation._id,
                sender: { $ne: socket.data.user._id },
                read: false,
            }, { $set: { read: true } })

            const readAt = new Date()
            socket.to(room).emit('message_read', {
                conversationId: room,
                reader: { _id: socket.data.user._id, name: socket.data.user.name },
                readAt,
                modifiedCount: result.modifiedCount,
            })
            acknowledge(callback, { success: true, modifiedCount: result.modifiedCount })
        } catch {
            acknowledge(callback, { success: false, message: 'Unable to mark messages read' })
        }
    })

    socket.on('leave_conversation', (payload) => {
        const conversationId = getConversationId(payload)
        if (conversationId && mongoose.isValidObjectId(conversationId)) {
            socket.leave(String(conversationId))
        }
    })
})

async function startServer() {
    await connectDatabase()

    httpServer.listen(port, () => {
        console.log(`CampusMart API listening on port ${port}`)
    })
}

startServer().catch((error) => {
    console.error('Unable to start CampusMart API:', error.message)
    process.exit(1)
})