const { createHash, randomBytes } = require('node:crypto')
const AuthToken = require('../models/AuthToken')

const TOKEN_TTL_MS = 30 * 60 * 1000

function hashToken(token) {
    return createHash('sha256').update(token).digest('hex')
}

async function issueToken(userId, purpose, ttlMs = TOKEN_TTL_MS) {
    const token = randomBytes(32).toString('base64url')
    await AuthToken.create({
        user: userId,
        tokenHash: hashToken(token),
        purpose,
        expiresAt: new Date(Date.now() + ttlMs),
    })
    return token
}

async function consumeToken(token, purpose) {
    if (typeof token !== 'string' || token.length < 40 || token.length > 100) return null
    return AuthToken.findOneAndUpdate({
        tokenHash: hashToken(token),
        purpose,
        usedAt: null,
        expiresAt: { $gt: new Date() },
    }, { $set: { usedAt: new Date() } }, { new: true })
}

module.exports = { issueToken, consumeToken, hashToken, TOKEN_TTL_MS }
