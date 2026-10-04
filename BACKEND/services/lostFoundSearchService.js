const LostFoundReport = require('../models/LostFoundReport')

const publicReporterFields = 'name college profileImage'
const publicReportFields = 'type title category description location date images status createdAt'

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100) }

function buildLostFoundFilter({ type, query, category, location, date } = {}) {
    const filter = { status: 'active' }
    if (['lost', 'found'].includes(type)) filter.type = type
    if (typeof category === 'string' && category.trim()) filter.category = new RegExp(escapeRegex(category.trim()), 'i')
    if (typeof location === 'string' && location.trim()) filter.location = new RegExp(escapeRegex(location.trim()), 'i')
    if (typeof query === 'string' && query.trim()) {
        const pattern = new RegExp(escapeRegex(query.trim()), 'i')
        filter.$or = [{ title: pattern }, { description: pattern }, { category: pattern }, { location: pattern }]
    }
    if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
        const dayStart = new Date(`${date}T00:00:00.000Z`)
        if (Number.isNaN(dayStart.getTime()) || dayStart.toISOString().slice(0, 10) !== date) return null
        filter.date = { $gte: dayStart, $lt: new Date(dayStart.getTime() + 86400000) }
    }
    return filter
}

async function searchLostFoundReports({ filter, page = 1, limit = 20, includeReporter = false, publicOnly = false }) {
    const findQuery = LostFoundReport.find(filter).select(publicOnly ? publicReportFields : '-__v')
    if (includeReporter) findQuery.populate('reportedBy', publicReporterFields)
    const [reports, total] = await Promise.all([
        findQuery.sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        LostFoundReport.countDocuments(filter),
    ])
    return { reports, total }
}

module.exports = { buildLostFoundFilter, searchLostFoundReports, escapeRegex, publicReporterFields, publicReportFields }
