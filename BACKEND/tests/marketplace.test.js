const test = require('node:test')
const assert = require('node:assert/strict')
const Product = require('../models/Product')
const ProductCategory = require('../models/ProductCategory')
const {
    getProducts,
    updateProduct,
    validateImageUpload,
    validateProductInput,
} = require('../controllers/productController')
const productCategoryController = require('../controllers/productCategoryController')

function mockResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code
            return this
        },
        json(body) {
            this.body = body
            return this
        },
    }
}

test('validates general listing fields and rejects privileged or unknown fields', () => {
    const valid = {
        title: 'Used calculator',
        description: 'Scientific calculator in good working order.',
        price: '450',
        category: 'Electronics and Gadgets',
        condition: 'Good',
        brand: 'Example',
        quantity: '1',
        negotiable: 'true',
        salePreference: 'both',
        contactMethod: 'chat',
    }
    assert.equal(validateProductInput(valid), null)
    assert.match(validateProductInput({ ...valid, role: 'admin' }), /unsupported fields/i)
    assert.match(validateProductInput({ ...valid, status: { $ne: 'sold' } }), /status must be one of/i)
    assert.match(validateProductInput({ ...valid, price: { $gt: 0 } }), /non-negative number/i)
})

test('validates dynamic category administration fields', () => {
    assert.equal(productCategoryController.validateCategory({ name: 'Vintage goods', subcategories: ['Books', 'Audio'] }), null)
    assert.match(productCategoryController.validateCategory({ name: 'X', subcategories: [] }), /2 to 80 characters/i)
    assert.match(productCategoryController.validateCategory({ name: 'Valid', active: 'false' }), /active must be true or false/i)
})

test('rejects image bytes that do not match the declared image type', () => {
    const invalid = {
        mimetype: 'image/png',
        size: 8,
        buffer: Buffer.from('not a png'),
    }
    assert.match(validateImageUpload(invalid), /does not match/i)
    const validPng = {
        ...invalid,
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    }
    assert.equal(validateImageUpload(validPng), null)
})

test('product search builds server-side keyword, category, price, location, sort and pagination queries', async (t) => {
    const original = {
        productFind: Product.find,
        productCount: Product.countDocuments,
        productAggregate: Product.aggregate,
        categoryBulkWrite: ProductCategory.bulkWrite,
        categoryFind: ProductCategory.find,
        categoryFindOne: ProductCategory.findOne,
    }
    t.after(() => {
        Product.find = original.productFind
        Product.countDocuments = original.productCount
        Product.aggregate = original.productAggregate
        ProductCategory.bulkWrite = original.categoryBulkWrite
        ProductCategory.find = original.categoryFind
        ProductCategory.findOne = original.categoryFindOne
    })

    let capturedFilter
    let capturedSort
    let capturedSkip
    let capturedLimit
    ProductCategory.bulkWrite = async () => ({})
    ProductCategory.find = () => ({
        select() { return this },
        sort() { return this },
        lean: async () => [],
    })
    ProductCategory.findOne = () => ({
        lean: async () => ({
            name: 'Electronics and Gadgets',
            aliases: ['Electronics'],
            subcategories: ['Laptops'],
        }),
    })
    Product.find = (filter) => {
        capturedFilter = filter
        const query = {
            select() { return this },
            populate() { return this },
            sort(value) { capturedSort = value; return this },
            skip(value) { capturedSkip = value; return this },
            limit(value) { capturedLimit = value; return this },
            lean: async () => [{ _id: 'listing-1' }],
        }
        return query
    }
    Product.countDocuments = async () => 1
    Product.aggregate = async () => []

    const response = mockResponse()
    await getProducts({
        query: {
            search: 'laptop',
            category: 'Electronics',
            subcategory: 'Laptops',
            condition: 'Good',
            location: 'North Campus',
            minPrice: '100',
            maxPrice: '1000',
            sort: 'price-asc',
            page: '2',
            limit: '5',
        },
    }, response, (error) => { throw error })

    assert.equal(response.statusCode, 200)
    assert.equal(response.body.count, 1)
    assert.equal(response.body.pagination.page, 2)
    assert.equal(capturedSkip, 5)
    assert.equal(capturedLimit, 5)
    assert.deepEqual(capturedSort, { price: 1, createdAt: -1 })
    assert.ok(capturedFilter.$and.some((clause) => clause.$text?.$search === 'laptop'))
    assert.ok(capturedFilter.$and.some((clause) => clause.category?.$in.includes('Electronics and Gadgets')))
    assert.ok(capturedFilter.$and.some((clause) => clause.subcategory?.$regex === '^Laptops$'))
    assert.ok(capturedFilter.$and.some((clause) => clause.price?.$gte === 100 && clause.price?.$lte === 1000))
    assert.ok(capturedFilter.$and.some((clause) => clause.$or?.some((part) => part.location?.$regex === 'North Campus')))
})

test('listing owners are enforced by the update controller', async (t) => {
    const originalFindById = Product.findById
    t.after(() => { Product.findById = originalFindById })

    const ownerId = '507f1f77bcf86cd799439011'
    let saveCount = 0
    const product = {
        _id: ownerId,
        seller: { toString: () => ownerId },
        status: 'available',
        images: [],
        async save() { saveCount += 1 },
        async populate() { return this },
    }
    Product.findById = async () => product

    const unauthorizedResponse = mockResponse()
    await updateProduct({
        params: { id: ownerId },
        body: { status: 'archived' },
        user: { _id: '507f1f77bcf86cd799439012' },
    }, unauthorizedResponse, (error) => { throw error })
    assert.equal(unauthorizedResponse.statusCode, 403)
    assert.equal(saveCount, 0)

    const ownerResponse = mockResponse()
    await updateProduct({
        params: { id: ownerId },
        body: { status: 'archived' },
        user: { _id: ownerId },
    }, ownerResponse, (error) => { throw error })
    assert.equal(ownerResponse.statusCode, 200)
    assert.equal(product.status, 'archived')
    assert.equal(saveCount, 1)
})
