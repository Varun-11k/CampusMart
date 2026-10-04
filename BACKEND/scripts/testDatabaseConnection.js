require('dotenv').config()

const mongoose = require('mongoose')
const connectDatabase = require('../config/database')

async function testDatabaseConnection() {
    try {
        await connectDatabase()
        console.log('MongoDB connection test passed')
    } catch (error) {
        console.error('MongoDB connection test failed:', error.message)
        process.exitCode = 1
    } finally {
        await mongoose.disconnect()
    }
}

testDatabaseConnection()