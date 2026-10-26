const express = require('express')
const multer = require('multer')
const rateLimit = require('express-rate-limit')
const authController = require('../controllers/authController')
const { getStudentDashboard } = require('../controllers/studentDashboardController')
const {
    register, login, googleLogin, forgotPassword, resetPassword,
    verifyEmail, resendVerification, getCurrentUser, logout,
    updateProfile, changePassword, deactivateAccount,
    sendEmailOtp, verifyEmailOtp, forgotPasswordOtp, resetPasswordOtp,
    requestEmailOtp, verifyOtp, requestPasswordResetOtp, resetPasswordWithOtp,
} = require('../controllers/authController')
const protect = require('../middleware/authMiddleware')

const router = express.Router()
const profilePhotoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { files: 1, fileSize: authController.MAX_PROFILE_IMAGE_BYTES },
})
const parseProfilePhoto = (req, res, next) => profilePhotoUpload.single('photo')(req, res, (error) => {
    if (!error) return next()
    const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Profile photos must be 3MB or smaller.'
        : error.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Upload one profile photo using the photo field.'
            : 'The profile photo upload could not be read.'
    return res.status(400).json({ success: false, message })
})
const createLimiter = (limit, windowMs = 15 * 60 * 1000) => rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'Too many attempts. Please try again later.' },
})

router.post('/register', createLimiter(5, 60 * 60 * 1000), register)
router.post('/login', createLimiter(10), login)
router.post('/google', createLimiter(10), googleLogin)
router.post('/forgot-password', createLimiter(5, 60 * 60 * 1000), forgotPassword)
router.post('/reset-password', createLimiter(10), resetPassword)
router.post('/verify-email', createLimiter(10), verifyEmail)
router.post('/resend-verification', createLimiter(5, 60 * 60 * 1000), resendVerification)

// Email OTP verification aliases
for (const path of ['/send-otp', '/send_otp', '/request-otp', '/request_otp', '/otp/send', '/email-otp', '/resend-otp', '/resend_otp', '/request-email-otp', '/request_email_otp']) {
    router.post(path, createLimiter(5, 60 * 60 * 1000), sendEmailOtp)
}
for (const path of ['/verify-otp', '/verify_otp', '/otp/verify', '/verify-email-otp', '/verify_email_otp', '/verify-otp-code']) {
    router.post(path, createLimiter(10), verifyEmailOtp)
}

// Forgot-password OTP aliases
for (const path of ['/forgot-password-otp', '/forgot_password_otp', '/forgot-otp', '/forgot_otp', '/password-reset-otp', '/request-password-reset-otp']) {
    router.post(path, createLimiter(5, 60 * 60 * 1000), forgotPasswordOtp)
}
// Reset-password OTP is handled by /reset-password with otp in body; add convenience aliases
for (const path of ['/reset-password-otp', '/reset_password_otp', '/reset-otp', '/reset_otp']) {
    router.post(path, createLimiter(10), resetPasswordOtp)
}

router.get('/me', protect, getCurrentUser)
router.get('/dashboard', createLimiter(60), protect, getStudentDashboard)
router.post('/logout', protect, logout)
router.put('/profile', protect, updateProfile)
router.post('/profile/photo', protect, parseProfilePhoto, authController.uploadProfilePhoto)
router.put('/password', protect, createLimiter(5), changePassword)
router.post('/deactivate', protect, createLimiter(3), deactivateAccount)

module.exports = router