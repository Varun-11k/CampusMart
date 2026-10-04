const mongoose = require('mongoose')

async function connectDatabase() {
    const mongoUri = process.env.MONGO_URI

    if (!mongoUri) {
        throw new Error('MONGO_URI is not configured')
    }

    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 })
    } catch (error) {
        throw new Error(`MongoDB connection failed: ${error.message}`)
    }
}

module.exports = connectDatabase