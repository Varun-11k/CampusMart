const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const LostFoundReport = require('../models/LostFoundReport')
const LostFoundClaim = require('../models/LostFoundClaim')
const Conversation = require('../models/Conversation')
const { validateBody, MAX_IMAGES, imageSignatureMatches, serializeReport, updateReport, uploadImages } = require('../controllers/lostFoundController')
const lostFoundClaims = require('../controllers/lostFoundClaimController')
const { buildLostFoundFilter, publicReportFields } = require('../services/lostFoundSearchService')
const cloudinary = require('../config/cloudinary')
const Notification = require('../models/Notification')
const Report = require('../models/Report')
const reportController = require('../controllers/reportController')

const validReport = {
    type: 'lost',
    title: 'Black wallet',
    category: 'Wallets & Cards',
    description: 'Small black wallet with a campus card inside.',
    location: 'Library',
    date: '2026-09-27',
    images: [],
}

test('accepts a valid report and rejects frontend ownership fields', () => {
    assert.equal(validateBody(validReport), null)
    assert.match(validateBody({ ...validReport, reportedBy: new mongoose.Types.ObjectId() }), /unsupported fields/)
})

test('validates report type, required fields, dates, and image URL safety', () => {
    assert.match(validateBody({ ...validReport, type: 'missing' }), /type must be lost or found/)
    assert.match(validateBody({ ...validReport, date: 'not-a-date' }), /valid date/)
    assert.match(validateBody({ ...validReport, images: ['http://res.cloudinary.com/example/image.png'] }), /secure Cloudinary URLs/)
    assert.match(validateBody({ ...validReport, images: ['https://example.com/image.png'] }), /secure Cloudinary URLs/)
    assert.equal(validateBody({ ...validReport, images: ['https://res.cloudinary.com/demo/image/upload/sample.png'] }), null)
    assert.match(validateBody({ ...validReport, description: 'Contact me at student@example.edu' }), /Remove email addresses/)
    assert.match(validateBody({ ...validReport, location: 'Call 9876543210' }), /Remove email addresses/)
})

test('filters reports by status and public projections omit reporter identifiers', () => {
    const filter = buildLostFoundFilter({ type: 'found', status: 'claimed', category: 'Keys' })
    assert.equal(filter.status, 'claimed')
    assert.equal(filter.type, 'found')
    assert.ok(!publicReportFields.includes('reportedBy'))
    assert.ok(!publicReportFields.includes('moderationStatus'))
})

test('report serialization strips private reporter identifiers and account fields', () => {
    const reporterId = new mongoose.Types.ObjectId()
    const serialized = serializeReport({
        _id: new mongoose.Types.ObjectId(),
        moderationStatus: 'hidden',
        reportedBy: { _id: reporterId, name: 'Student', college: 'Campus', profileImage: 'https://example.test/photo', email: 'private@example.edu', role: 'admin' },
    }, reporterId)
    assert.equal(serialized.isMine, true)
    assert.deepEqual(serialized.reportedBy, { name: 'Student', college: 'Campus', profileImage: 'https://example.test/photo' })
    assert.equal(serialized.reportedBy.email, undefined)
    assert.equal(serialized.reportedBy._id, undefined)
    assert.equal(serialized.moderationStatus, undefined)
})

test('image validation checks file signatures instead of trusting MIME type', () => {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    assert.equal(imageSignatureMatches({ mimetype: 'image/png', buffer: pngSignature }), true)
    assert.equal(imageSignatureMatches({ mimetype: 'image/png', buffer: Buffer.from('not an image') }), false)
})

test('image upload sends only validated image bytes to the configured image provider', async () => {
    const originalUploadStream = cloudinary.uploader.upload_stream
    let uploadOptions
    cloudinary.uploader.upload_stream = (options, callback) => {
        uploadOptions = options
        return { end: (buffer) => callback(null, { secure_url: 'https://res.cloudinary.com/demo/image/upload/item.png', receivedBytes: buffer.length }) }
    }
    try {
        const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
        const images = await uploadImages([{ mimetype: 'image/png', size: buffer.length, buffer }])
        assert.deepEqual(images, ['https://res.cloudinary.com/demo/image/upload/item.png'])
        assert.deepEqual(uploadOptions, { folder: 'campusmart/lost-found', resource_type: 'image' })
        await assert.rejects(uploadImages([{ mimetype: 'image/png', size: 12, buffer: Buffer.from('not an image!') }]), /contents do not match/)
        await assert.rejects(uploadImages([{ mimetype: 'image/png', size: 5 * 1024 * 1024 + 1, buffer }]), /5MB or smaller/)
    } finally { cloudinary.uploader.upload_stream = originalUploadStream }
})

test('users cannot edit another user report or decide another user claim', async () => {
    const ownId = new mongoose.Types.ObjectId()
    const otherId = new mongoose.Types.ObjectId()
    const reportId = new mongoose.Types.ObjectId()
    const originalFindById = LostFoundReport.findById
    LostFoundReport.findById = async () => ({ _id: reportId, reportedBy: ownId, status: 'active' })
    const makeResponse = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
    try {
        const editResponse = makeResponse()
        await updateReport({ params: { id: reportId.toString() }, body: { title: 'Changed item' }, user: { _id: otherId } }, editResponse, (error) => { throw error })
        assert.equal(editResponse.statusCode, 403)

        const claimResponse = makeResponse()
        await lostFoundClaims.updateClaim({ params: { id: reportId.toString(), claimId: new mongoose.Types.ObjectId().toString() }, body: { status: 'approved' }, user: { _id: otherId, role: 'student' } }, claimResponse, (error) => { throw error })
        assert.equal(claimResponse.statusCode, 403)
    } finally {
        LostFoundReport.findById = originalFindById
    }
})

test('reporter can decide a claim and claimant can submit distinguishing details', async () => {
    const ownerId = new mongoose.Types.ObjectId()
    const claimantId = new mongoose.Types.ObjectId()
    const reportId = new mongoose.Types.ObjectId()
    const claimId = new mongoose.Types.ObjectId()
    const originalFindReport = LostFoundReport.findById
    const originalFindClaim = LostFoundClaim.findOne
    const originalCreateClaim = LostFoundClaim.create
    const originalNotificationCreate = Notification.create
    const originalNotificationFind = Notification.findById
    let savedClaimData
    let report = { _id: reportId, reportedBy: ownerId, status: 'active', async save() {} }
    const claim = { _id: claimId, claimant: claimantId, status: 'pending', async save() { savedClaimData = { status: this.status, reviewerNote: this.reviewerNote } }, async populate() { this.claimant = { _id: claimantId }; return this } }
    LostFoundReport.findById = async () => report
    LostFoundClaim.findOne = async () => claim
    LostFoundClaim.create = async (data) => { savedClaimData = data; return { ...data, _id: claimId, async populate() { this.claimant = { _id: claimantId, name: 'Student' }; return this } } }
    Notification.create = async (data) => ({ _id: new mongoose.Types.ObjectId(), recipient: data.recipient })
    Notification.findById = () => ({ populate() { return this } })
    const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
    try {
        const decisionResponse = response()
        await lostFoundClaims.updateClaim({ params: { id: reportId.toString(), claimId: claimId.toString() }, body: { status: 'more_info_requested', reviewerNote: 'Describe a mark on the back.' }, user: { _id: ownerId, role: 'student' } }, decisionResponse, (error) => { throw error })
        assert.equal(decisionResponse.statusCode, 200)
        assert.equal(savedClaimData.status, 'more_info_requested')
        assert.equal(report.status, 'active')

        const submitResponse = response()
        LostFoundReport.findById = () => ({ select: async () => ({ _id: reportId, reportedBy: ownerId, status: 'active', moderationStatus: 'active' }) })
        await lostFoundClaims.submitClaim({ params: { id: reportId.toString() }, body: { message: 'There is a unique scratch by the clasp.' }, user: { _id: claimantId } }, submitResponse, (error) => { throw error })
        assert.equal(submitResponse.statusCode, 201)
        assert.equal(savedClaimData.claimant.toString(), claimantId.toString())
        assert.equal(submitResponse.body.claim.message, 'There is a unique scratch by the clasp.')
    } finally {
        LostFoundReport.findById = originalFindReport
        LostFoundClaim.findOne = originalFindClaim
        LostFoundClaim.create = originalCreateClaim
        Notification.create = originalNotificationCreate
        Notification.findById = originalNotificationFind
    }
})

test('approving one claim atomically closes the report and closes other pending claims', async () => {
    const ownerId = new mongoose.Types.ObjectId()
    const claimantId = new mongoose.Types.ObjectId()
    const reportId = new mongoose.Types.ObjectId()
    const claimId = new mongoose.Types.ObjectId()
    const originals = {
        findById: LostFoundReport.findById,
        findOneAndUpdate: LostFoundReport.findOneAndUpdate,
        findOne: LostFoundClaim.findOne,
        find: LostFoundClaim.find,
        updateMany: LostFoundClaim.updateMany,
        notificationCreate: Notification.create,
        notificationFindById: Notification.findById,
    }
    let reportUpdateFilter
    let otherClaimsFilter
    const report = { _id: reportId, reportedBy: ownerId, status: 'active' }
    const claim = { _id: claimId, claimant: claimantId, status: 'pending', async save() {}, async populate() { this.claimant = { _id: claimantId }; return this } }
    LostFoundReport.findById = async () => report
    LostFoundReport.findOneAndUpdate = async (filter) => { reportUpdateFilter = filter; return { ...report, status: 'claimed' } }
    LostFoundClaim.findOne = async () => claim
    LostFoundClaim.find = (filter) => { otherClaimsFilter = filter; return { select() { return this }, async lean() { return [] } } }
    LostFoundClaim.updateMany = async () => ({ modifiedCount: 0 })
    Notification.create = async (data) => ({ _id: new mongoose.Types.ObjectId(), recipient: data.recipient })
    Notification.findById = () => ({ populate() { return this } })
    const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
    try {
        await lostFoundClaims.updateClaim({ params: { id: reportId.toString(), claimId: claimId.toString() }, body: { status: 'approved' }, user: { _id: ownerId, role: 'student' } }, response, (error) => { throw error })
        assert.equal(response.statusCode, 200)
        assert.deepEqual(reportUpdateFilter.status, { $in: ['active', 'under_review'] })
        assert.equal(reportUpdateFilter._id.toString(), reportId.toString())
        assert.equal(otherClaimsFilter.report.toString(), reportId.toString())
        assert.equal(response.body.report.status, 'claimed')
    } finally {
        LostFoundReport.findById = originals.findById
        LostFoundReport.findOneAndUpdate = originals.findOneAndUpdate
        LostFoundClaim.findOne = originals.findOne
        LostFoundClaim.find = originals.find
        LostFoundClaim.updateMany = originals.updateMany
        Notification.create = originals.notificationCreate
        Notification.findById = originals.notificationFindById
    }
})

test('authenticated users can send Lost & Found abuse reports into the existing moderation queue', async () => {
    const reportId = new mongoose.Types.ObjectId()
    const reporterId = new mongoose.Types.ObjectId()
    const originals = { exists: LostFoundReport.exists, reportExists: Report.exists, reportCreate: Report.create }
    let createdReport
    LostFoundReport.exists = async () => true
    Report.exists = async () => false
    Report.create = async (data) => { createdReport = data; return { _id: new mongoose.Types.ObjectId(), ...data } }
    const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
    try {
        await reportController.createReport({ body: { lostFoundReportId: reportId.toString(), reason: 'personal_information' }, user: { _id: reporterId } }, response, (error) => { throw error })
        assert.equal(response.statusCode, 201)
        assert.equal(createdReport.reporter.toString(), reporterId.toString())
        assert.equal(createdReport.lostFoundReport.toString(), reportId.toString())
        assert.equal(createdReport.product, undefined)
    } finally {
        LostFoundReport.exists = originals.exists
        Report.exists = originals.reportExists
        Report.create = originals.reportCreate
    }
})

test('caps report images and report description length', () => {
    assert.equal(MAX_IMAGES, 5)
    assert.match(validateBody({ ...validReport, images: Array.from({ length: 6 }, () => 'https://res.cloudinary.com/demo/image/upload/sample.png') }), /at most 5/)
    assert.match(validateBody({ ...validReport, description: 'x'.repeat(2001) }), /2000 characters or fewer/)
})

test('lost and found models define required states and scoped claim indexes', () => {
    assert.deepEqual(LostFoundReport.schema.path('type').enumValues, ['lost', 'found'])
    assert.deepEqual(LostFoundReport.schema.path('status').enumValues, ['active', 'under_review', 'claimed', 'resolved', 'returned', 'closed'])
    assert.deepEqual(LostFoundReport.schema.path('moderationStatus').enumValues, ['active', 'hidden', 'removed'])
    assert.deepEqual(LostFoundReport.schema.path('contactPreference').enumValues, ['in_app', 'claims_only'])
    assert.deepEqual(LostFoundClaim.schema.path('status').enumValues, ['pending', 'more_info_requested', 'approved', 'rejected'])
    assert.ok(Notification.schema.path('type').enumValues.includes('lost_found'))
    assert.ok(LostFoundClaim.schema.indexes().some(([keys, options]) => keys.report === 1 && keys.claimant === 1 && options.unique))
})

test('chat conversations support exactly one product or lost and found target', async () => {
    const first = new mongoose.Types.ObjectId()
    const second = new mongoose.Types.ObjectId()
    await new Conversation({ participants: [first, second], product: first }).validate()
    await new Conversation({ participants: [first, second], lostFoundReport: first }).validate()
    await new Conversation({ participants: [first, second], campusExchange: first }).validate()
    await assert.rejects(new Conversation({ participants: [first, second] }).validate(), /exactly one/)
    await assert.rejects(new Conversation({ participants: [first, second], product: first, lostFoundReport: second }).validate(), /exactly one/)
})
