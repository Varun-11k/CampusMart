const test = require('node:test')
const assert = require('node:assert/strict')

const { scoreProduct, priceRange, productModerationFilter } = require('../services/recommendationService')
const ProductView = require('../models/ProductView')

const product = {
    category: 'Books',
    price: 800,
    college: 'North Campus',
    condition: 'Good',
}

test('scores saved, viewed, price, college, and condition signals transparently', () => {
    const result = scoreProduct(product, {
        savedCategorySet: new Set(['Books']),
        viewedCategorySet: new Set(['Books']),
        priceRange: { min: 500, max: 1000 },
        college: 'North Campus',
        commonCondition: 'Good',
    })

    assert.equal(result.score, 13)
    assert.equal(result.reason, 'Because you saved similar items.')
})

test('uses a truthful reason for viewed-category and college matches', () => {
    const result = scoreProduct(product, {
        savedCategorySet: new Set(),
        viewedCategorySet: new Set(['Books']),
        priceRange: null,
        college: 'North Campus',
        commonCondition: null,
    })

    assert.equal(result.score, 5)
    assert.equal(result.reason, 'Because you viewed similar items.')
})

test('does not score a product with no matching activity or college signal', () => {
    const result = scoreProduct(product, {
        savedCategorySet: new Set(),
        viewedCategorySet: new Set(),
        priceRange: null,
        college: 'Different Campus',
        commonCondition: null,
    })

    assert.deepEqual(result, { score: 0, reason: null })
})

test('derives a bounded central price range from activity prices', () => {
    const range = priceRange([{ price: 500 }, { price: 800 }, { price: 1200 }, { price: 2000 }])
    assert.ok(range.min < 800)
    assert.ok(range.max > 1200)
    assert.equal(priceRange([{ price: 0 }, { price: 'invalid' }]), null)
})

test('product view storage has unique user/product and recent-view indexes', () => {
    const indexes = ProductView.schema.indexes().map(([keys]) => keys)
    assert.ok(indexes.some((keys) => keys.user === 1 && keys.product === 1))
    assert.ok(indexes.some((keys) => keys.user === 1 && keys.lastViewedAt === -1))
})

test('recommendation visibility requires available status and active-or-legacy moderation state', () => {
    const filter = productModerationFilter()
    assert.deepEqual(filter.$or, [
        { moderationStatus: 'active' },
        { moderationStatus: { $exists: false } },
    ])
})
