const test = require('node:test')
const assert = require('node:assert/strict')
const User = require('../models/User')
const AuthToken = require('../models/AuthToken')
const authController = require('../controllers/authController')
const authMiddleware = require('../middleware/authMiddleware')
const { consumeToken, hashToken, TOKEN_TTL_MS } = require('../services/authTokenService')
const { invalidateUserSessions } = require('../services/authSessionService')
const socketManager = require('../socketManager')

const validEmail = 'student@example.edu'
const validPassword = 'CampusSecure!2026'

test('email, password, and profile validation enforce bounded account inputs', () => {
    assert.equal(authController.validateEmail(validEmail), true)
    assert.equal(authController.validateEmail('not-an-email'), false)
    assert.equal(authController.validateEmail(`${'a'.repeat(250)}@example.edu`), false)
    assert.equal(authController.validatePassword(validPassword), true)
    assert.equal(authController.validatePassword('short'), false)
    assert.equal(authController.validatePassword('é'.repeat(40)), false)
    assert.deepEqual(authController.validateProfileFields({ name: 'A', college: '' }), {
        name: 'Enter a name between 2 and 80 characters.',
        college: 'Enter a college or university between 2 and 120 characters.',
    })
})

test('JWTs use the configured strong secret, HS256, bounded session expiry, and no user role claim', () => {
    const originalSecret = process.env.JWT_SECRET
    process.env.JWT_SECRET = 'test-only-jwt-secret-with-at-least-32-characters'
    try {
        const jwt = require('jsonwebtoken')
        const token = authController.createToken('012345678901234567890123', 3)
        const claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
        assert.equal(claims.tokenVersion, 3)
        assert.equal(claims.role, undefined)
        assert.equal(claims.exp - claims.iat, 7 * 24 * 60 * 60)
        const remembered = jwt.verify(authController.createToken('012345678901234567890123', 3, true), process.env.JWT_SECRET)
        assert.equal(remembered.exp - remembered.iat, 30 * 24 * 60 * 60)
        process.env.JWT_SECRET = 'short'
        assert.throws(() => authController.createToken('012345678901234567890123'), /at least 32 characters/)
    } finally {
        if (originalSecret === undefined) delete process.env.JWT_SECRET
        else process.env.JWT_SECRET = originalSecret
    }
})

test('passwords and Google identities have separate supported account providers', async () => {
    assert.equal(User.schema.path('password').options.select, false)
    assert.equal(User.schema.path('googleId').options.select, false)
    assert.equal(User.schema.path('tokenVersion').options.select, false)
    assert.deepEqual(User.schema.path('role').enumValues, ['student', 'admin'])
    assert.ok(User.schema.indexes().some(([keys, options]) => keys.googleId === 1 && options.unique && options.sparse))

    const googleAccount = new User({
        name: 'Campus Student',
        email: 'google@example.edu',
        college: 'Example College',
        googleId: 'google-subject',
        authProviders: ['google'],
    })
    await assert.doesNotReject(googleAccount.validate())

    const passwordAccount = new User({
        name: 'Campus Student',
        email: 'password@example.edu',
        college: 'Example College',
        password: '$2b$12$abcdefghijklmnopqrstuu7J8T/GnqF9z2bLkNPR2.mP4JHKJ6u',
    })
    await assert.doesNotReject(passwordAccount.validate())
    const uncredentialed = new User({ name: 'Campus Student', email: validEmail, college: 'Example College' })
    await assert.rejects(uncredentialed.validate(), /password/)
})

test('one-time account tokens store hashes and expire automatically', () => {
    const rawToken = 'single-use-secret'
    assert.notEqual(hashToken(rawToken), rawToken)
    assert.equal(hashToken(rawToken), hashToken(rawToken))
    assert.equal(TOKEN_TTL_MS, 30 * 60 * 1000)
    assert.equal(AuthToken.schema.path('tokenHash').options.select, false)
    assert.ok(AuthToken.schema.indexes().some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0))
})

test('password reset token consumption is atomic, purpose-scoped, hashed, and expiry-bounded', async () => {
    const originalFindOneAndUpdate = AuthToken.findOneAndUpdate
    const rawToken = 'a-single-use-reset-token-that-is-long-enough'
    let filterUsed
    AuthToken.findOneAndUpdate = async (filter, update) => {
        filterUsed = filter
        assert.equal(update.$set.usedAt instanceof Date, true)
        return { user: 'user-id' }
    }
    try {
        assert.deepEqual(await consumeToken(rawToken, 'password-reset'), { user: 'user-id' })
        assert.equal(filterUsed.tokenHash, hashToken(rawToken))
        assert.equal(filterUsed.tokenHash.includes(rawToken), false)
        assert.equal(filterUsed.purpose, 'password-reset')
        assert.equal(filterUsed.usedAt, null)
        assert.ok(filterUsed.expiresAt.$gt instanceof Date)
        assert.equal(await consumeToken('short', 'password-reset'), null)
    } finally {
        AuthToken.findOneAndUpdate = originalFindOneAndUpdate
    }
})

test('authorization rejects stale JWTs after logout, password changes, or deactivation', async () => {
    const originalSecret = process.env.JWT_SECRET
    const originalFindById = User.findById
    const userVersion = 8
    process.env.JWT_SECRET = 'test-only-jwt-secret-with-at-least-32-characters'
    User.findById = () => ({
        select: async () => ({ _id: '012345678901234567890123', tokenVersion: userVersion, deactivatedAt: null }),
    })

    test('session invalidation increments the account token version and disconnects sockets', async () => {
        const originalUpdateOne = User.updateOne
        let roomJoined
        let disconnected
        User.updateOne = async (filter, update) => {
            assert.equal(filter._id, 'user-id')
            assert.equal(update.$inc.tokenVersion, 1)
            return { matchedCount: 1 }
        }
        socketManager.setIO({
            in(room) {
                roomJoined = room
                return { disconnectSockets(close) { disconnected = close } }
            },
        })

        try {
            assert.equal(await invalidateUserSessions('user-id'), true)
            assert.equal(roomJoined, 'user:user-id')
            assert.equal(disconnected, true)
        } finally {
            User.updateOne = originalUpdateOne
            socketManager.setIO(null)
        }
    })

    const req = {
        headers: {
            authorization: `Bearer ${authController.createToken('012345678901234567890123', userVersion - 1)}`,
        },
    }
    const response = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this },
        json(body) { this.body = body; return this },
    }
    let nextCalled = false
    try {
        await authMiddleware(req, response, () => { nextCalled = true })
        assert.equal(response.statusCode, 401)
        assert.equal(nextCalled, false)
    } finally {
        User.findById = originalFindById
        if (originalSecret === undefined) delete process.env.JWT_SECRET
        else process.env.JWT_SECRET = originalSecret
    }
})

test('public user objects omit credentials and cannot expose an admin role without the designated email', () => {
    const originalAdminEmail = process.env.ADMIN_EMAIL
    process.env.ADMIN_EMAIL = 'admin@example.edu'
    try {
        const user = authController.publicUser({
            _id: 'user-id',
            name: 'Student',
            email: 'student@example.edu',
            college: 'Example College',
            password: 'hash-that-must-not-be-returned',
            googleId: 'google-id-that-must-not-be-returned',
            authProviders: ['google'],
            role: 'admin',
        })
        assert.equal(user.role, 'student')
        assert.equal(user.hasPassword, false)
        assert.equal(Object.hasOwn(user, 'password'), false)
        assert.equal(Object.hasOwn(user, 'googleId'), false)
    } finally {
        if (originalAdminEmail === undefined) delete process.env.ADMIN_EMAIL
        else process.env.ADMIN_EMAIL = originalAdminEmail
    }
})

test('auth endpoints apply security headers, deny untrusted browser origins, and rate-limit registration', async () => {
    const app = require('../app')
    const server = await new Promise((resolve) => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
    })
    const baseUrl = `http://127.0.0.1:${server.address().port}`

    try {
        const responses = []
        for (let attempt = 0; attempt < 6; attempt += 1) {
            responses.push(await fetch(`${baseUrl}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Origin: 'https://untrusted.example',
                },
                body: JSON.stringify({ name: 'x', email: 'bad-email', password: 'short', college: '' }),
            }))
        }

        assert.equal(responses[0].status, 400)
        assert.equal(responses[0].headers.get('x-content-type-options'), 'nosniff')
        assert.equal(responses[0].headers.get('access-control-allow-origin'), null)
        assert.equal(responses[5].status, 429)
    } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
})
