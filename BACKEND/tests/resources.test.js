const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const Resource = require('../models/Resource')
const controller = require('../controllers/resourceController')

const owner = new mongoose.Types.ObjectId()
const otherUser = new mongoose.Types.ObjectId()
function responseMock() { return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } } }

test('resource schema models safe metadata, moderation and source validation', async () => {
  assert.equal(Resource.schema.path('title').options.maxlength, 200)
  assert.equal(Resource.schema.path('description').options.maxlength, 2000)
  assert.equal(Resource.schema.path('uploadedBy').instance, 'ObjectId')
  assert.equal(Resource.schema.path('downloads').defaultValue, 0)
  assert.ok(Resource.schema.indexes().some(([keys]) => keys.type === 1))
  assert.ok(Resource.schema.indexes().some(([keys]) => keys.status === 1 && keys.createdAt === -1))
  const invalid = new Resource({ title: 'Bad', type: 'notes', uploadedBy: owner, fileUrl: 'https://file.test/a', externalUrl: 'https://other.test/a' })
  await assert.rejects(invalid.validate(), /exactly one file or external URL/)
  const badLink = new Resource({ title: 'Bad link', type: 'useful_link', uploadedBy: owner, fileUrl: 'https://file.test/a' })
  await assert.rejects(badLink.validate(), /Useful links must use an external URL/)
})

test('body validation rejects spoofed ownership/moderation and unsafe URLs', () => {
  assert.equal(controller.validateBody({ title: 'DBMS Notes', type: 'notes' }), null)
  assert.match(controller.validateBody({ title: 'x', type: 'notes', uploadedBy: owner }), /unsupported fields/)
  assert.match(controller.validateBody({ title: 'x', type: 'notes', status: 'removed' }), /unsupported fields/)
  assert.match(controller.validateBody({ title: 'x', type: 'notes', downloads: 999 }), /unsupported fields/)
  assert.match(controller.validateBody({ title: 'x', type: 'notes', externalUrl: 'javascript:alert(1)' }), /HTTPS/)
  assert.equal(controller.validateUrl('https://campus.example.edu/file'), 'https://campus.example.edu/file')
  assert.equal(controller.validateUrl('data:text/html,hello'), null)
  assert.match(controller.validateBody({ title: 'x'.repeat(201), type: 'notes' }), /200 characters/)
})

test('file validation checks extension and file signature as well as MIME type', () => {
  assert.equal(controller.validateUploadFile({ mimetype: 'application/pdf', originalname: 'notes.pdf', size: 8, buffer: Buffer.from('%PDF-1.7') }), true)
  assert.equal(controller.validateUploadFile({ mimetype: 'application/pdf', originalname: 'notes.pdf', size: 8, buffer: Buffer.from('MZmalware') }), false)
  assert.equal(controller.validateUploadFile({ mimetype: 'application/pdf', originalname: 'notes.exe', size: 8, buffer: Buffer.from('%PDF-1.7') }), false)
})

test('public serialization removes uploader identity and internal mongoose fields', () => {
  const safe = controller.serializeResource({ _id: owner, title: 'Notes', uploadedBy: owner, __v: 0 }, otherUser)
  assert.equal(safe.uploadedBy, undefined)
  assert.equal(safe.__v, undefined)
  assert.equal(safe.isMine, false)
})

test('resource creation derives uploadedBy from the authenticated request user', async () => {
  const originalCreate = Resource.create
  let created
  Resource.create = async (document) => { created = document; return { _id: owner, ...document } }
  try {
    const res = responseMock()
    await controller.createResource({ user: { _id: owner }, body: { title: 'Useful guide', type: 'useful_link', externalUrl: 'https://campus.example/guide' } }, res, (error) => { throw error })
    assert.equal(res.statusCode, 201)
    assert.equal(created.uploadedBy.toString(), owner.toString())
    assert.equal(res.body.resource.uploadedBy, undefined)
  } finally { Resource.create = originalCreate }
})

test('user B cannot edit or delete user A resource by changing the request ID', async () => {
  const originalFindById = Resource.findById
  const doc = { _id: owner, uploadedBy: owner, type: 'notes', status: 'active', fileUrl: 'https://cdn.example/file.pdf', deleteOneCalled: false, async deleteOne() { this.deleteOneCalled = true }, async save() { throw new Error('Should not save') } }
  Resource.findById = async () => doc
  try {
    const updateResponse = responseMock()
    await controller.updateResource({ params: { id: owner.toString() }, user: { _id: otherUser }, body: { title: 'Changed' } }, updateResponse, (error) => { throw error })
    assert.equal(updateResponse.statusCode, 403)
    const deleteResponse = responseMock()
    await controller.deleteResource({ params: { id: owner.toString() }, user: { _id: otherUser } }, deleteResponse, (error) => { throw error })
    assert.equal(deleteResponse.statusCode, 403)
    assert.equal(doc.deleteOneCalled, false)
  } finally { Resource.findById = originalFindById }
})
