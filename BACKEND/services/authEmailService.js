const nodemailer = require('nodemailer')

function getMailConfig() {
    const from = process.env.EMAIL_FROM
    if (!from) return null

    if (process.env.SMTP_URL) {
        return { from, transport: nodemailer.createTransport(process.env.SMTP_URL) }
    }

    const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASSWORD: pass } = process.env
    if (!host || !user || !pass) return null

    const port = Number(process.env.SMTP_PORT || 587)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT must be a valid port')

    return {
        from,
        transport: nodemailer.createTransport({
            host,
            port,
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user, pass },
        }),
    }
}

async function sendAccountEmail({ email, subject, text }) {
    const config = getMailConfig()
    if (!config) return false
    await config.transport.sendMail({ from: config.from, to: email, subject, text })
    return true
}

function buildFrontendLink(path, token) {
    const base = process.env.FRONTEND_URL
    if (!base) return null
    const url = new URL(path, base)
    url.hash = new URLSearchParams({ token }).toString()
    return url.toString()
}

module.exports = { sendAccountEmail, buildFrontendLink, getMailConfig }
