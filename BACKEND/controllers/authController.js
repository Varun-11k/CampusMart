const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('node:crypto')
const { OAuth2Client } = require('google-auth-library')
const User = require('../models/User')
const AuthToken = require('../models/AuthToken')
const { issueToken, consumeToken } = require('../services/authTokenService')
const { invalidateUserSessions, disconnectUserSockets } = require('../services/authSessionService')
const { sendAccountEmail, buildFrontendLink, getMailConfig } = require('../services/authEmailService')
const cloudinary = require('../config/cloudinary')

const PASSWORD_MIN_LENGTH = 12
const PASSWORD_MAX_BYTES = 72
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com'])

function validateEmail(email) {
    return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function validatePassword(password) {
    return typeof password === 'string'
        && password.length >= PASSWORD_MIN_LENGTH
        && Buffer.byteLength(password, 'utf8') <= PASSWORD_MAX_BYTES
}

function validateProfileFields({ name, college }) {
    const errors = {}
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
        errors.name = 'Enter a name between 2 and 80 characters.'
    }
    if (typeof college !== 'string' || college.trim().length < 2 || college.trim().length > 120) {
        errors.college = 'Enter a college or university between 2 and 120 characters.'
    }
    return errors
}

const academicYears = new Set(['', '1', '2', '3', '4', '5', 'graduate', 'other'])
const profileFields = ['name', 'college', 'course', 'branch', 'academicYear', 'themePreference']

function validateProfileUpdate(body) {
    const errors = {}
    if (Object.hasOwn(body, 'name') && (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80)) {
        errors.name = 'Enter a name between 2 and 80 characters.'
    }
    if (Object.hasOwn(body, 'college') && (typeof body.college !== 'string' || body.college.trim().length > 120 || (body.college.trim() && body.college.trim().length < 2))) {
        errors.college = 'Enter a college or university using 2 to 120 characters, or leave it blank.'
    }
    if (Object.keys(body).length === 0) errors.profile = 'Provide at least one profile field to update.'
    for (const field of ['course', 'branch']) {
        if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].trim().length > 120)) {
            errors[field] = 'Use no more than 120 characters.'
        }
    }
    if (body.academicYear !== undefined && !academicYears.has(body.academicYear)) {
        errors.academicYear = 'Choose a supported academic year.'
    }
    if (body.themePreference !== undefined && !['light', 'dark'].includes(body.themePreference)) {
        errors.themePreference = 'Choose light or dark mode.'
    }
    return errors
}

function createToken(userId, tokenVersion = 0, rememberMe = false) {
    const secret = process.env.JWT_SECRET
    if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) {
        throw new Error('JWT_SECRET must be configured with at least 32 characters')
    }

    return jwt.sign({ userId, tokenVersion }, secret, {
        algorithm: 'HS256',
        expiresIn: rememberMe ? '30d' : process.env.JWT_EXPIRES_IN || '7d',
    })
}

function publicUser(user) {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()

    return {
        id: user._id,
        name: user.name,
        email: user.email,
        college: user.college,
        course: user.course || '',
        branch: user.branch || '',
        academicYear: user.academicYear || '',
        profileImage: user.profileImage,
        themePreference: user.themePreference || 'light',
        isVerified: user.isVerified,
        hasPassword: (user.authProviders || ['password']).includes('password'),
        role: user.role === 'admin' && adminEmail === user.email.toLowerCase() ? 'admin' : 'student',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    }
}

function sendFieldErrors(res, errors) {
    return res.status(400).json({ success: false, message: 'Please check the highlighted fields.', errors })
}

async function verifyGoogleCredentialForUser(credential, user) {
    if (typeof credential !== 'string' || !process.env.GOOGLE_CLIENT_ID) return false
    try {
        const ticket = await new OAuth2Client(process.env.GOOGLE_CLIENT_ID).verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        })
        const claims = ticket.getPayload()
        return Boolean(
            claims?.email_verified === true
            && GOOGLE_ISSUERS.has(claims.iss)
            && claims.sub === user.googleId
            && claims.email?.toLowerCase() === user.email.toLowerCase(),
        )
    } catch {
        return false
    }
}

function validateRegistration(body) {
    const errors = validateProfileFields(body)
    if (!validateEmail(body.email)) errors.email = 'Enter a valid email address.'
    if (!validatePassword(body.password)) errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters and no more than ${PASSWORD_MAX_BYTES} UTF-8 bytes.`
    if (body.confirmPassword !== undefined && body.password !== body.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match.'
    }
    return errors
}

const OTP_TTL_MS = 10 * 60 * 1000
const OTP_LENGTH = 6

function generateOtp() {
    return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0')
}

function hashOtp(code) {
    return crypto.createHash('sha256').update(String(code).trim()).digest('hex')
}

async function issueOtp(userId, purpose = 'email-verification', ttlMs = OTP_TTL_MS) {
    const code = generateOtp()
    await AuthToken.deleteMany({ user: userId, purpose, isOtp: true, usedAt: null })
    await AuthToken.create({
        user: userId,
        tokenHash: hashOtp(code),
        purpose,
        isOtp: true,
        expiresAt: new Date(Date.now() + ttlMs),
    })
    return code
}

async function consumeOtp(code, purpose = 'email-verification') {
    if (typeof code !== 'string' || !/^\d{4,8}$/.test(code.trim())) return null
    return AuthToken.findOneAndUpdate(
        {
            tokenHash: hashOtp(code.trim()),
            purpose,
            isOtp: true,
            usedAt: null,
            expiresAt: { $gt: new Date() },
        },
        { $set: { usedAt: new Date() } },
        { new: true },
    )
}

function extractOtp(body) {
    const value = body?.otp ?? body?.code ?? body?.verificationCode ?? body?.verification_code ?? body?.verificationOtp ?? body?.verification_otp
    if (value !== undefined && value !== null) return String(value).trim()
    if (/^\d{4,8}$/.test(String(body?.token || '').trim())) return String(body.token).trim()
    return ''
}

function extractEmail(body) {
    const value = body?.email ?? body?.username ?? body?.userEmail ?? body?.user_email
    return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

async function sendVerification(user) {
    try {
        const configured = getMailConfig()
        if (!configured || !process.env.FRONTEND_URL) return false
        const otp = await issueOtp(user._id, 'email-verification', OTP_TTL_MS)
        const token = await issueToken(user._id, 'email-verification', 24 * 60 * 60 * 1000)
        const link = buildFrontendLink('/verify-email', token)
        if (!link) return false
        await sendAccountEmail({
            email: user.email,
            subject: 'Verify your CampusMart email',
            text: 'Hi ' + user.name + ',\n\nYour CampusMart email verification code is ' + otp + '. It expires in 10 minutes.\n\nYou can also verify using this single-use link (expires in 24 hours):\n' + link + '\n\nIf you did not create a CampusMart account, you can ignore this email.',
        })
        return true
    } catch {
        console.error('CampusMart verification email delivery failed')
        return false
    }
}
async function register(req, res, next) {
    try {
        const body = req.body || {}
        const allowedFields = new Set(['name', 'email', 'password', 'confirmPassword', 'college'])
        if (Object.keys(body).some((field) => !allowedFields.has(field))) {
            return res.status(400).json({ success: false, message: 'Unsupported registration fields.' })
        }

        const errors = validateRegistration(body)
        if (Object.keys(errors).length) return sendFieldErrors(res, errors)

        const normalizedEmail = body.email.trim().toLowerCase()
        const existingUser = await User.findOne({ email: normalizedEmail }).select('_id')
        if (existingUser) return res.status(409).json({ success: false, message: 'Email is already registered', errors: { email: 'This email already has an account.' } })

        const password = await bcrypt.hash(body.password, 12)
        const user = await User.create({
            name: body.name.trim(),
            email: normalizedEmail,
            password,
            college: body.college.trim(),
            authProviders: ['password'],
        })
        const token = createToken(user._id.toString(), user.tokenVersion || 0)
        const verificationEmailSent = await sendVerification(user)

        res.status(201).json({ success: true, token, user: publicUser(user), verificationEmailSent })
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Email is already registered', errors: { email: 'This email already has an account.' } })
        }
        next(error)
    }
}

async function login(req, res, next) {
    try {
        const { email, password, rememberMe = false } = req.body || {}
        if (!validateEmail(email) || typeof password !== 'string' || !password || typeof rememberMe !== 'boolean') {
            return sendFieldErrors(res, {
                ...(!validateEmail(email) ? { email: 'Enter a valid email address.' } : {}),
                ...(typeof password !== 'string' || !password ? { password: 'Enter your password.' } : {}),
                ...(typeof rememberMe !== 'boolean' ? { rememberMe: 'Invalid sign-in preference.' } : {}),
            })
        }

        if (Buffer.byteLength(password) > 1024) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' })
        }
        const user = await User.findOne({ email: email.trim().toLowerCase() })
            .select('+password +googleId +authProviders +tokenVersion +deactivatedAt')
        const passwordMatches = user && !user.deactivatedAt && user.password
            ? await bcrypt.compare(password, user.password)
            : false

        if (!passwordMatches) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' })
        }

        const token = createToken(user._id.toString(), user.tokenVersion || 0, rememberMe)
        res.json({ success: true, token, user: publicUser(user) })
    } catch (error) {
        next(error)
    }
}

async function googleLogin(req, res, next) {
    try {
        const clientId = process.env.GOOGLE_CLIENT_ID
        if (!clientId) return res.status(503).json({ success: false, message: 'Google sign-in is not configured.' })

        const credential = req.body?.credential
        if (typeof credential !== 'string' || credential.length > 5000) {
            return res.status(400).json({ success: false, message: 'A valid Google credential is required.' })
        }

        const client = new OAuth2Client(clientId)
        let ticket
        try {
            ticket = await client.verifyIdToken({ idToken: credential, audience: clientId })
        } catch {
            return res.status(401).json({ success: false, message: 'Google sign-in could not be verified.' })
        }
        const claims = ticket.getPayload()
        if (!claims || !claims.sub || !validateEmail(claims.email) || claims.email_verified !== true || !GOOGLE_ISSUERS.has(claims.iss)) {
            return res.status(401).json({ success: false, message: 'Google could not verify this account.' })
        }

        const email = claims.email.trim().toLowerCase()
        let user = await User.findOne({ email }).select('+googleId +tokenVersion +deactivatedAt +authProviders')
        if (user?.deactivatedAt) return res.status(403).json({ success: false, message: 'This account has been deactivated.' })

        if (user) {
            if (user.googleId && user.googleId !== claims.sub) {
                return res.status(409).json({ success: false, message: 'This email is linked to a different Google account.' })
            }
            if (!user.googleId) {
                user.googleId = claims.sub
                user.isVerified = true
                user.authProviders = [...new Set([...(user.authProviders || ['password']), 'google'])]
                await user.save()
            }
        } else {
            const college = req.body?.college
            const profileErrors = validateProfileFields({ name: claims.name || '', college })
            if (profileErrors.college) {
                return res.status(400).json({ success: false, message: 'Add your college to finish creating your account.', errors: { college: profileErrors.college } })
            }
            user = await User.create({
                name: ((claims.name || email.split('@')[0]).trim().slice(0, 80) || 'CampusMart Student'),
                email,
                googleId: claims.sub,
                college: college.trim(),
                isVerified: true,
                authProviders: ['google'],
            })
        }

        const token = createToken(user._id.toString(), user.tokenVersion || 0)
        return res.json({ success: true, token, user: publicUser(user) })
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'This Google account is already linked.' })
        next(error)
    }
}

async function forgotPassword(req, res) {
    const genericResponse = { success: true, message: 'If an account matches that email, password reset instructions will be sent.' }
    try {
        const email = req.body?.email
        if (!validateEmail(email)) return res.json(genericResponse)
        const user = await User.findOne({ email: email.trim().toLowerCase() }).select('name email deactivatedAt')
        if (!user || user.deactivatedAt || !getMailConfig() || !process.env.FRONTEND_URL) return res.json(genericResponse)

        await AuthTokenDeleteForUser(user._id, 'password-reset')
        const otp = await issueOtp(user._id, 'password-reset', OTP_TTL_MS)
        const token = await issueToken(user._id, 'password-reset', 30 * 60 * 1000)
        const link = buildFrontendLink('/reset-password', token)
        if (!link) return res.json(genericResponse)

        try {
            await sendAccountEmail({
                email: user.email,
                subject: 'Reset your CampusMart password',
                text: 'Hi ' + user.name + ',\n\nYour CampusMart password reset code is ' + otp + '. It expires in 10 minutes.\n\nYou can also reset your password using this single-use link (expires in 30 minutes):\n' + link + '\n\nIf you did not request a reset, you can ignore this email.',
            })
        } catch {
            await AuthTokenDeleteForUser(user._id, 'password-reset')
            console.error('CampusMart password reset email delivery failed')
        }
        return res.json(genericResponse)
    } catch {
        console.error('CampusMart password reset request could not be processed')
        return res.json(genericResponse)
    }
}

async function AuthTokenDeleteForUser(userId, purpose) {
    await AuthToken.deleteMany({ user: userId, purpose, usedAt: null })
}

async function resetPassword(req, res, next) {
    try {
        const body = req.body || {}
    const { password, confirmPassword } = body
    const token = body.token
    const otp = extractOtp(body)
    const email = extractEmail(body)
        const errors = {}
        if (!validatePassword(password)) errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters and no more than ${PASSWORD_MAX_BYTES} UTF-8 bytes.`
        if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.'
        if (!otp && (typeof token !== 'string' || token.length < 40 || token.length > 100)) errors.token = 'This reset link is invalid or expired.'
        if (Object.keys(errors).length) return sendFieldErrors(res, errors)

        if (otp && !validateEmail(email)) {
            return res.status(400).json({ success: false, message: 'This reset code is invalid or expired.' })
        }
        const authToken = otp
            ? await consumeOtp(otp, 'password-reset')
            : await consumeToken(token, 'password-reset')
        if (!authToken) return res.status(400).json({ success: false, message: otp ? 'This reset code is invalid or expired.' : 'This reset link is invalid or expired.' })
        if (otp) {
            const userForOtp = await User.findById(authToken.user).select('email deactivatedAt')
            if (!userForOtp || userForOtp.deactivatedAt || userForOtp.email !== email) {
                return res.status(400).json({ success: false, message: 'This reset code is invalid or expired.' })
            }
        }
        if (!authToken) return res.status(400).json({ success: false, message: 'This reset link is invalid or expired.' })

        const hash = await bcrypt.hash(password, 12)
        const user = await User.findOneAndUpdate(
            { _id: authToken.user, deactivatedAt: null },
            { $set: { password: hash, isVerified: true }, $addToSet: { authProviders: 'password' }, $inc: { tokenVersion: 1 } },
            { new: true },
        ).select('+tokenVersion')
        if (!user) return res.status(400).json({ success: false, message: 'This reset link is invalid or expired.' })

        disconnectUserSockets(user._id)
        await AuthTokenDeleteForUser(user._id, 'password-reset')
        return res.json({ success: true, message: 'Password updated. Please sign in again.' })
    } catch (error) {
        next(error)
    }
}

async function verifyEmail(req, res) {
    const body = req.body || {}
    const otp = extractOtp(body)
    const email = extractEmail(body)
    if (otp) {
        if (!validateEmail(email)) return res.status(400).json({ success: false, message: 'This verification code is invalid or expired.' })
        const otpUser = await User.findOne({ email, deactivatedAt: null }).select('_id')
        if (!otpUser) return res.status(400).json({ success: false, message: 'This verification code is invalid or expired.' })
        const authToken = await consumeOtp(otp, 'email-verification')
        if (!authToken || authToken.user.toString() !== otpUser._id.toString()) {
            return res.status(400).json({ success: false, message: 'This verification code is invalid or expired.' })
        }
        await User.findByIdAndUpdate(otpUser._id, { $set: { isVerified: true } })
        await AuthToken.deleteMany({ user: otpUser._id, purpose: 'email-verification', isOtp: true })
        return res.json({ success: true, message: 'Your email is verified.' })
    }

    const token = req.body?.token
    if (typeof token !== 'string' || token.length < 40 || token.length > 100) {
        return res.status(400).json({ success: false, message: 'This verification link is invalid or expired.' })
    }
    const authToken = await consumeToken(token, 'email-verification')
    if (!authToken) return res.status(400).json({ success: false, message: 'This verification link is invalid or expired.' })
    const user = await User.findByIdAndUpdate(authToken.user, { $set: { isVerified: true } }, { new: true })
    if (!user) return res.status(400).json({ success: false, message: 'This verification link is invalid or expired.' })
    await AuthTokenDeleteForUser(user._id, 'email-verification')
    return res.json({ success: true, message: 'Your email is verified.' })
}

async function resendVerification(req, res) {
    const genericResponse = { success: true, message: 'If your account needs verification, an email will be sent.' }
    try {
        const email = req.body?.email
        if (!validateEmail(email) || !getMailConfig() || !process.env.FRONTEND_URL) return res.json(genericResponse)
        const user = await User.findOne({ email: email.trim().toLowerCase(), isVerified: false, deactivatedAt: null })
        if (user) {
            await AuthTokenDeleteForUser(user._id, 'email-verification')
            await sendVerification(user)
        }
        return res.json(genericResponse)
    } catch {
        console.error('CampusMart verification request could not be processed')
        return res.json(genericResponse)
    }
}

async function getCurrentUser(req, res) {
    res.json({ success: true, user: publicUser(req.user) })
}

async function logout(req, res, next) {
    try {
        await invalidateUserSessions(req.user._id)
        res.json({ success: true, message: 'You have been logged out of all sessions.' })
    } catch (error) {
        next(error)
    }
}

async function updateProfile(req, res, next) {
    try {
        const body = req.body || {}
        if (Object.keys(body).some((field) => !profileFields.includes(field))) {
            return res.status(400).json({ success: false, message: 'Unsupported profile fields.' })
        }
        const errors = validateProfileUpdate(body)
        if (Object.keys(errors).length) return sendFieldErrors(res, errors)
        for (const field of profileFields) {
            if (!Object.hasOwn(body, field)) continue
            req.user[field] = typeof body[field] === 'string' ? body[field].trim() : body[field]
        }
        await req.user.save()
        return res.json({ success: true, user: publicUser(req.user) })
    } catch (error) {
        next(error)
    }
}

const MAX_PROFILE_IMAGE_BYTES = 3 * 1024 * 1024
const imageSignatures = {
    'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    'image/png': (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/webp': (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
}

function validateProfileImage(file) {
    if (!file || !Buffer.isBuffer(file.buffer)) return 'Choose a profile image to upload.'
    if (!Number.isInteger(file.size) || file.size < 1 || file.size > MAX_PROFILE_IMAGE_BYTES) return 'Profile photos must be 3MB or smaller.'
    if (!imageSignatures[file.mimetype]?.(file.buffer)) return 'Upload a valid JPG, PNG, or WEBP image.'
    return null
}

function hasCloudinaryCredentials() {
    return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
}

async function uploadProfilePhoto(req, res, next) {
    try {
        const validationError = validateProfileImage(req.file)
        if (validationError) return res.status(400).json({ success: false, message: validationError })
        if (!hasCloudinaryCredentials()) return res.status(503).json({ success: false, message: 'Profile photo uploads are not configured.' })

        const imageUrl = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({
                folder: 'campusmart/profiles',
                resource_type: 'image',
                transformation: [{ width: 512, height: 512, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
            }, (error, result) => {
                if (error) return reject(error)
                if (typeof result?.secure_url !== 'string' || !result.secure_url.startsWith('https://res.cloudinary.com/')) {
                    return reject(new Error('The image provider returned an invalid profile photo URL.'))
                }
                return resolve(result.secure_url)
            })
            stream.end(req.file.buffer)
        })
        req.user.profileImage = imageUrl
        await req.user.save()
        return res.json({ success: true, user: publicUser(req.user) })
    } catch (error) {
        next(error)
    }
}

async function changePassword(req, res, next) {
    try {
        const { currentPassword, password, confirmPassword, googleCredential } = req.body || {}
        const errors = {}
        if (!validatePassword(password)) errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters and no more than ${PASSWORD_MAX_BYTES} UTF-8 bytes.`
        if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.'
        if (Object.keys(errors).length) return sendFieldErrors(res, errors)

        const user = await User.findById(req.user._id).select('+password +googleId +tokenVersion +authProviders')
        let confirmed = Boolean(user.password && typeof currentPassword === 'string' && currentPassword && await bcrypt.compare(currentPassword, user.password))
        if (!user.password) confirmed = await verifyGoogleCredentialForUser(googleCredential, user)
        if (!confirmed) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect.', errors: { currentPassword: 'Current password is incorrect.' } })
        }
        const passwordHash = await bcrypt.hash(password, 12)
        const updatedUser = await User.findOneAndUpdate({ _id: user._id, deactivatedAt: null }, {
            $set: { password: passwordHash },
            $addToSet: { authProviders: 'password' },
            $inc: { tokenVersion: 1 },
        }, { new: true }).select('+tokenVersion +authProviders')
        if (!updatedUser) return res.status(404).json({ success: false, message: 'Account is no longer available.' })
        disconnectUserSockets(user._id)
        const token = createToken(updatedUser._id.toString(), updatedUser.tokenVersion || 0)
        return res.json({ success: true, token, user: publicUser(updatedUser), message: 'Password updated. Other sessions have been signed out.' })
    } catch (error) {
        next(error)
    }
}

async function deactivateAccount(req, res, next) {
    try {
        const { password, confirmation } = req.body || {}
        if (confirmation !== 'DELETE') return res.status(400).json({ success: false, message: 'Type DELETE to confirm account deactivation.' })

        const user = await User.findById(req.user._id).select('+password +googleId +tokenVersion')
        let confirmed = Boolean(typeof password === 'string' && password && user.password && await bcrypt.compare(password, user.password))
        if (!confirmed && !user.password) confirmed = await verifyGoogleCredentialForUser(req.body?.googleCredential, user)
        if (!confirmed) {
            return res.status(400).json({ success: false, message: 'Password confirmation failed.' })
        }
        const deactivatedUser = await User.findOneAndUpdate(
            { _id: user._id, deactivatedAt: null },
            { $set: { deactivatedAt: new Date() }, $inc: { tokenVersion: 1 } },
            { new: true },
        )
        if (!deactivatedUser) return res.status(404).json({ success: false, message: 'Account is no longer available.' })
        disconnectUserSockets(user._id)
        await AuthToken.deleteMany({ user: user._id })
        return res.json({ success: true, message: 'Your account has been deactivated. Existing marketplace records may remain visible to preserve transaction history.' })
    } catch (error) {
        next(error)
    }
}

const sendEmailOtp = resendVerification
const verifyEmailOtp = verifyEmail
const forgotPasswordOtp = forgotPassword
const resetPasswordOtp = resetPassword
const requestEmailOtp = sendEmailOtp
const verifyOtp = verifyEmailOtp
const requestPasswordResetOtp = forgotPasswordOtp
const resetPasswordWithOtp = resetPasswordOtp

module.exports = {
    PASSWORD_MIN_LENGTH,
    validateEmail,
    validatePassword,
    validateProfileFields,
    validateProfileUpdate,
    validateProfileImage,
    MAX_PROFILE_IMAGE_BYTES,
    hasCloudinaryCredentials,
    createToken,
    publicUser,
    register,
    login,
    googleLogin,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification,
    sendEmailOtp,
    verifyEmailOtp,
    forgotPasswordOtp,
    resetPasswordOtp,
    requestEmailOtp,
    verifyOtp,
    requestPasswordResetOtp,
    resetPasswordWithOtp,
    getCurrentUser,
    generateOtp,
    hashOtp,
    issueOtp,
    consumeOtp,
    extractOtp,
    extractEmail,
    OTP_TTL_MS,
    logout,
    updateProfile,
    uploadProfilePhoto,
    changePassword,
    deactivateAccount,
}
