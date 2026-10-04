const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

function createToken(userId) {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured')
    }

    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    })
}

function publicUser(user) {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()

    return {
        id: user._id,
        name: user.name,
        email: user.email,
        college: user.college,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
        role: user.role === 'admin' && adminEmail === user.email.toLowerCase() ? 'admin' : 'student',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    }
}

async function register(req, res, next) {
    try {
        const { name, email, password, college, profileImage } = req.body || {}

        if ([name, email, password, college].some((value) => typeof value !== 'string' || !value.trim())) {
            return res.status(400).json({ success: false, message: 'Name, email, password, and college are required' })
        }

        const normalizedEmail = email.trim().toLowerCase()

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({ success: false, message: 'Please provide a valid email address' })
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' })
        }

        const existingUser = await User.findOne({ email: normalizedEmail })

        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Email is already registered' })
        }

        const hashedPassword = await bcrypt.hash(password, 12)
        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            college: college.trim(),
            profileImage,
        })
        const token = createToken(user._id.toString())

        res.status(201).json({ success: true, token, user: publicUser(user) })
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Email is already registered' })
        }

        next(error)
    }
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body || {}

        if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' })
        }

        const normalizedEmail = email.trim().toLowerCase()
        const user = await User.findOne({ email: normalizedEmail }).select('+password')
        const passwordMatches = user && await bcrypt.compare(password, user.password)

        if (!passwordMatches) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' })
        }

        const token = createToken(user._id.toString())
        res.json({ success: true, token, user: publicUser(user) })
    } catch (error) {
        next(error)
    }
}

function getCurrentUser(req, res) {
    res.json({ success: true, user: publicUser(req.user) })
}

module.exports = { register, login, getCurrentUser }