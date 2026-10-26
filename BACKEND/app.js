const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const healthRoutes = require('./routes/healthRoutes')
const authRoutes = require('./routes/authRoutes')
const productRoutes = require('./routes/productRoutes')
const chatRoutes = require('./routes/chatRoutes')
const wishlistRoutes = require('./routes/wishlistRoutes')
const notificationRoutes = require('./routes/notificationRoutes')
const reportRoutes = require('./routes/reportRoutes')
const adminRoutes = require('./routes/adminRoutes')
const aiRoutes = require('./routes/aiRoutes')
const recommendationRoutes = require('./routes/recommendationRoutes')
const lostFoundRoutes = require('./routes/lostFoundRoutes')
const campusVoiceRoutes = require('./routes/campusVoiceRoutes')
const campusFeedRoutes = require('./routes/campusFeedRoutes')
const resourceRoutes = require('./routes/resourceRoutes')
const campusAIRoutes = require('./routes/campusAIRoutes')
const campusExchangeRoutes = require('./routes/campusExchangeRoutes')
const engagementRoutes = require('./routes/engagementRoutes')
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler')

const app = express()

const allowedOrigins = (process.env.CORS_ORIGINS || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173,http://127.0.0.1:5173'))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            'script-src': ["'self'", 'https://accounts.google.com/gsi/client'],
            'frame-src': ["'self'", 'https://accounts.google.com'],
            'connect-src': ["'self'", 'https://accounts.google.com'],
        },
    },
}))
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
        return callback(null, false)
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

app.get('/', (req, res) => {
    res.json({ message: 'CampusMart API is running' })
})

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/wishlist', wishlistRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/recommendations', recommendationRoutes)
app.use('/api/lost-found', lostFoundRoutes)
app.use('/api/campus-voices', campusVoiceRoutes)
app.use('/api/campus-feed', campusFeedRoutes)
app.use('/api/resources', resourceRoutes)
app.use('/api/campus-ai', campusAIRoutes)
app.use('/api/campus-exchange', campusExchangeRoutes)
app.use('/api/engagement', engagementRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

module.exports = app
