require('dotenv').config()

const mongoose = require('mongoose')
const User = require('../models/User')

async function promoteAdmin() {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
    if (!email) {
        throw new Error('Set ADMIN_EMAIL to an existing account email before running this script')
    }

    await mongoose.connect(process.env.MONGO_URI)
    const user = await User.findOne({ email })

    if (!user) {
        throw new Error(`No account exists for ${email}. Register a normal account first.`)
    }

    const otherAdminExists = await User.exists({ role: 'admin', email: { $ne: email } })
    if (otherAdminExists) {
        throw new Error('Another admin account already exists. Only one admin account is allowed.')
    }

    if (user.role === 'admin') {
        console.log(`${email} is already an admin`)
        return
    }

    user.role = 'admin'
    await user.save()
    console.log(`Promoted existing account ${email} to admin`)
}

promoteAdmin()
    .catch((error) => {
        console.error('Unable to promote admin:', error.message)
        process.exitCode = 1
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect()
        }
    })
