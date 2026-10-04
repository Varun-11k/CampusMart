const test = require('node:test')
const assert = require('node:assert/strict')

const { validateImageUpload } = require('../controllers/productController')

const validFile = {
  originalname: 'photo.jpg',
  mimetype: 'image/jpeg',
  size: 500 * 1024,
}

test('accepts a valid image upload', () => {
  const result = validateImageUpload(validFile)
  assert.equal(result, null)
})

test('rejects non-image uploads', () => {
  const result = validateImageUpload({ ...validFile, mimetype: 'application/pdf' })
  assert.match(result, /image file type/i)
})

test('rejects files larger than 5MB', () => {
  const result = validateImageUpload({ ...validFile, size: 6 * 1024 * 1024 })
  assert.match(result, /5MB|5 MB|too large/i)
})
