const fs=require('fs');
const p='c:/Users/user/Desktop/MARKET/BACKEND/controllers/authController.js';
let s=fs.readFileSync(p,'utf8');
const start=s.indexOf('async function sendVerification(user) {');
const end=s.indexOf('async function register(req, res, next) {');
if(start<0||end<0){ console.error('markers not found',start,end); process.exit(1);}
const helper=`const OTP_TTL_MS = 10 * 60 * 1000
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
    if (typeof code !== 'string' || !/^\\d{4,8}$/.test(code.trim())) return null
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
    if (/^\\d{4,8}$/.test(String(body?.token || '').trim())) return String(body.token).trim()
    return ''
}

function extractEmail(body) {
    const value = body?.email ?? body?.username ?? body?.userEmail ?? body?.user_email
    return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

`;
const newSendVerification=`async function sendVerification(user) {
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
            text: \`Hi \${user.name},\\n\\nYour CampusMart email verification code is \${otp}. It expires in 10 minutes.\\n\\nYou can also verify using this single-use link (expires in 24 hours):\\n\${link}\\n\\nIf you did not create a CampusMart account, you can ignore this email.\`,
        })
        return true
    } catch {
        console.error('CampusMart verification email delivery failed')
        return false
    }
}

`;
s=s.slice(0,start)+helper+newSendVerification+s.slice(end);
fs.writeFileSync(p,s);
console.log('done');
`;
fs.writeFileSync('c:/Users/user/Desktop/MARKET/patch1.js', script);
console.log('written');