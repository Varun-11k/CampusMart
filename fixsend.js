const fs = require('fs');
const p = 'c:/Users/user/Desktop/MARKET/BACKEND/controllers/authController.js';
const s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('async function sendVerification(user) {');
const end = s.indexOf('async function register(req, res, next) {');
if (start < 0 || end < 0) { console.error('markers', start, end); process.exit(1); }
const replacement = [
"async function sendVerification(user) {",
"    try {",
"        const configured = getMailConfig()",
"        if (!configured || !process.env.FRONTEND_URL) return false",
"        const otp = await issueOtp(user._id, 'email-verification', OTP_TTL_MS)",
"        const token = await issueToken(user._id, 'email-verification', 24 * 60 * 60 * 1000)",
"        const link = buildFrontendLink('/verify-email', token)",
"        if (!link) return false",
"        await sendAccountEmail({",
"            email: user.email,",
"            subject: 'Verify your CampusMart email',",
"            text: 'Hi ' + user.name + ',\\n\\nYour CampusMart email verification code is ' + otp + '. It expires in 10 minutes.\\n\\nYou can also verify using this single-use link (expires in 24 hours):\\n' + link + '\\n\\nIf you did not create a CampusMart account, you can ignore this email.',",
"        })",
"        return true",
"    } catch {",
"        console.error('CampusMart verification email delivery failed')",
"        return false",
"    }",
"}",
"",
].join('\r\n');
const out = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(p, out);
console.log('done');
console.log('done');