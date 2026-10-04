const mongoose = require('mongoose')
const Resource = require('../models/Resource')
const cloudinary = require('../config/cloudinary')
const resourceSearchService = require('../services/resourceSearchService')

const types = ['notes', 'previous_paper', 'syllabus', 'study_material', 'useful_link']
const fields = ['title', 'description', 'type', 'subject', 'course', 'semester', 'year', 'externalUrl']
const resourceFields = 'title description type subject course semester year fileUrl externalUrl thumbnailUrl status downloads createdAt updatedAt'
const allowedFileTypes = new Set(['application/pdf', 'text/plain', 'image/jpeg', 'image/png'])
const allowedExtensions = { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] }
const maxFileBytes = 10 * 1024 * 1024
const downloadCooldownMs = 24 * 60 * 60 * 1000
const countedDownloads = new Map()

function validateUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null
    try {
        const url = new URL(value.trim())
        if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null
        return url.toString()
    } catch { return null }
}

function validateUploadFile(file) {
    if (!file || !allowedFileTypes.has(file.mimetype) || file.size > maxFileBytes) return false
    const extension = file.originalname ? file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase() : ''
    if (!allowedExtensions[file.mimetype]?.includes(extension)) return false
    const bytes = file.buffer || Buffer.alloc(0)
    if (file.mimetype === 'application/pdf') return bytes.subarray(0, 5).toString() === '%PDF-'
    if (file.mimetype === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    if (file.mimetype === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    return file.mimetype === 'text/plain' && !bytes.includes(0)
}

function validateBody(body, { partial = false, file } = {}) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 'A JSON or multipart request body is required'
    if (Object.keys(body).some((field) => !fields.includes(field))) return 'Request contains unsupported fields'
    if (!partial && (!Object.hasOwn(body, 'title') || !Object.hasOwn(body, 'type'))) return 'title and type are required'
    if (Object.hasOwn(body, 'title') && (typeof body.title !== 'string' || !body.title.trim())) return 'title must be a non-empty string'
    const limits = { title: 200, description: 2000, subject: 150, course: 150, semester: 50 }
    for (const [field, max] of Object.entries(limits)) {
        if (typeof body[field] === 'string' && body[field].trim().length > max) return `${field} must be ${max} characters or fewer`
        if (Object.hasOwn(body, field) && typeof body[field] !== 'string') return `${field} must be a string`
    }
    if (Object.hasOwn(body, 'type') && !types.includes(body.type)) return `type must be one of: ${types.join(', ')}`
    if (Object.hasOwn(body, 'year') && body.year !== '') {
        const year = Number(body.year)
        if (!Number.isInteger(year) || year < 1900 || year > 2100) return 'year must be a valid four-digit year'
    }
    if (Object.hasOwn(body, 'externalUrl') && body.externalUrl && !validateUrl(body.externalUrl)) return 'externalUrl must be a valid HTTPS URL'
    if (file && !validateUploadFile(file)) return 'Choose a valid PDF, TXT, JPG, or PNG file that is 10MB or smaller'
    if (partial && Object.keys(body).length === 0 && !file) return 'Provide at least one field to update'
    return null
}

function cleanOptional(value) {
    return typeof value === 'string' ? value.trim() || undefined : undefined
}

function serializeResource(resource, userId) {
    const data = typeof resource.toObject === 'function' ? resource.toObject() : { ...resource }
    const ownerId = data.uploadedBy
    delete data.uploadedBy
    delete data.__v
    return { ...data, isMine: Boolean(userId && ownerId && ownerId.toString() === userId.toString()) }
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100) }

function buildFilter(query) {
    return resourceSearchService.buildResourceFilter({ ...query, query: query.search })
}

async function uploadFile(file) {
    if (!file) return null
    if (!validateUploadFile(file)) {
        const error = new Error('Choose a valid PDF, TXT, JPG, or PNG file that is 10MB or smaller')
        error.statusCode = 400
        throw error
    }
    const isImage = file.mimetype.startsWith('image/')
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
            folder: 'campusmart/resources',
            resource_type: isImage ? 'image' : 'raw',
            use_filename: false,
            unique_filename: true,
        }, (error, result) => error ? reject(error) : resolve({ fileUrl: result.secure_url, thumbnailUrl: isImage ? result.secure_url : undefined }))
        stream.end(file.buffer)
    })
}

async function listResources(req, res, next) {
    try {
        if (req.query.type && !types.includes(req.query.type)) return res.status(400).json({ success: false, message: `type must be one of: ${types.join(', ')}` })
        const filter = buildFilter(req.query)
        if (!filter) return res.status(400).json({ success: false, message: 'year must be a valid four-digit year' })
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 12))
        const { resources, total } = await resourceSearchService.searchResources({ filter, page, limit })
        res.json({ success: true, resources: resources.map((resource) => ({ ...resource, isMine: false })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) { next(error) }
}

async function getResource(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid resource ID' })
        const resource = await Resource.findById(req.params.id).select(`${resourceFields} uploadedBy`).lean()
        if (!resource || (resource.status !== 'active' && resource.uploadedBy.toString() !== req.user?._id?.toString())) return res.status(404).json({ success: false, message: 'Resource not found' })
        res.json({ success: true, resource: serializeResource(resource, req.user?._id) })
    } catch (error) { next(error) }
}

async function createResource(req, res, next) {
    try {
        const body = req.body || {}
        const validation = validateBody(body, { file: req.file })
        if (validation) return res.status(400).json({ success: false, message: validation })
        const externalUrl = cleanOptional(body.externalUrl)
        if (Boolean(req.file) === Boolean(externalUrl)) return res.status(400).json({ success: false, message: 'Provide exactly one file or external URL' })
        if (body.type === 'useful_link' && (!externalUrl || req.file)) return res.status(400).json({ success: false, message: 'Useful links must use an external URL' })
        const uploaded = await uploadFile(req.file)
        const resource = await Resource.create({
            title: body.title.trim(),
            description: cleanOptional(body.description) || '',
            type: body.type,
            subject: cleanOptional(body.subject) || '',
            course: cleanOptional(body.course) || '',
            semester: cleanOptional(body.semester) || '',
            year: body.year ? Number(body.year) : undefined,
            fileUrl: uploaded?.fileUrl,
            thumbnailUrl: uploaded?.thumbnailUrl,
            externalUrl,
            uploadedBy: req.user._id,
        })
        res.status(201).json({ success: true, resource: serializeResource(resource, req.user._id) })
    } catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message }); next(error) }
}

async function updateResource(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid resource ID' })
        const body = req.body || {}
        const validation = validateBody(body, { partial: true, file: req.file })
        if (validation) return res.status(400).json({ success: false, message: validation })
        const resource = await Resource.findById(req.params.id)
        if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' })
        if (resource.uploadedBy.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only the resource owner can edit this resource' })
        const nextType = body.type || resource.type
        const externalUrl = Object.hasOwn(body, 'externalUrl') ? cleanOptional(body.externalUrl) : resource.externalUrl
        const uploaded = await uploadFile(req.file)
        const nextFileUrl = req.file ? uploaded.fileUrl : externalUrl ? undefined : resource.fileUrl
        if (Boolean(nextFileUrl) === Boolean(externalUrl)) return res.status(400).json({ success: false, message: 'Provide exactly one file or external URL' })
        if (nextType === 'useful_link' && (!externalUrl || nextFileUrl)) return res.status(400).json({ success: false, message: 'Useful links must use an external URL' })
        for (const field of ['title', 'description', 'type', 'subject', 'course', 'semester']) {
            if (Object.hasOwn(body, field)) resource[field] = field === 'title' || field === 'description' ? body[field].trim() : body[field]
        }
        if (Object.hasOwn(body, 'year')) resource.year = body.year ? Number(body.year) : undefined
        resource.fileUrl = nextFileUrl
        resource.externalUrl = externalUrl
        if (req.file) resource.thumbnailUrl = uploaded.thumbnailUrl
        else if (externalUrl) resource.thumbnailUrl = undefined
        await resource.save()
        res.json({ success: true, resource: serializeResource(resource, req.user._id) })
    } catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message }); next(error) }
}

async function deleteResource(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid resource ID' })
        const resource = await Resource.findById(req.params.id)
        if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' })
        if (resource.uploadedBy.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only the resource owner can delete this resource' })
        await resource.deleteOne()
        res.json({ success: true, message: 'Resource deleted' })
    } catch (error) { next(error) }
}

async function myResources(req, res, next) {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20))
        const filter = { uploadedBy: req.user._id }
        const [resources, total] = await Promise.all([
            Resource.find(filter).select(resourceFields).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Resource.countDocuments(filter),
        ])
        res.json({ success: true, resources: resources.map((resource) => ({ ...resource, isMine: true })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    } catch (error) { next(error) }
}

async function downloadResource(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid resource ID' })
        const resource = await Resource.findOne({ _id: req.params.id, status: 'active' }).select('fileUrl externalUrl downloads')
        if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' })
        const userId = req.user._id.toString()
        const key = `${userId}:${resource._id.toString()}`
        const now = Date.now()
        const lastCounted = countedDownloads.get(key)
        let counted = false
        if (!lastCounted || now - lastCounted >= downloadCooldownMs) {
            countedDownloads.set(key, now)
            try {
                const updated = await Resource.updateOne({ _id: resource._id, status: 'active' }, { $inc: { downloads: 1 } })
                counted = updated.modifiedCount === 1
                if (!counted) countedDownloads.delete(key)
            } catch (error) { countedDownloads.delete(key); throw error }
        }
        for (const [entry, timestamp] of countedDownloads) if (now - timestamp >= downloadCooldownMs) countedDownloads.delete(entry)
        res.json({ success: true, url: resource.fileUrl || resource.externalUrl, counted, downloads: resource.downloads + (counted ? 1 : 0) })
    } catch (error) { next(error) }
}

module.exports = { listResources, getResource, createResource, updateResource, deleteResource, myResources, downloadResource, validateBody, validateUrl, validateUploadFile, serializeResource, buildFilter, allowedFileTypes, maxFileBytes }
