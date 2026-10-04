const Resource = require('../models/Resource')

const resourceFields = 'title description type subject course semester year fileUrl externalUrl thumbnailUrl status downloads createdAt updatedAt'
const types = ['notes', 'previous_paper', 'syllabus', 'study_material', 'useful_link']

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100) }

function buildResourceFilter({ query, search, type, subject, course, semester, year } = {}) {
    const filter = { status: 'active' }
    if (type && types.includes(type)) filter.type = type
    for (const [field, value] of Object.entries({ subject, course, semester })) {
        if (typeof value === 'string' && value.trim()) filter[field] = new RegExp(`^${escapeRegex(value.trim())}$`, 'i')
    }
    if (year !== undefined && year !== null && year !== '') {
        const parsedYear = Number(year)
        if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2100) return null
        filter.year = parsedYear
    }
    const text = typeof query === 'string' ? query : search
    if (typeof text === 'string' && text.trim()) filter.$text = { $search: text.trim().slice(0, 200) }
    return filter
}

async function searchResources({ filter, page = 1, limit = 12 } = {}) {
    const [resources, total] = await Promise.all([
        Resource.find(filter).select(resourceFields)
            .sort(filter.$text ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 })
            .skip((page - 1) * limit).limit(limit).lean(),
        Resource.countDocuments(filter),
    ])
    return { resources, total }
}

module.exports = { buildResourceFilter, searchResources, resourceFields, types, escapeRegex }
