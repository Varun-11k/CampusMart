const test = require('node:test')
const assert = require('node:assert/strict')

const { validateEstimateRequest } = require('../controllers/aiController')
const { normalizePriceEstimate, AIServiceError } = require('../services/aiService')

const validRequest = {
    title: 'Desk lamp',
    category: 'Electronics',
    condition: 'Good',
    age: '8 months',
    originalPrice: '1200',
    details: 'Works properly, one small scratch on the base.',
}

test('accepts complete price estimate input', () => {
    assert.equal(validateEstimateRequest(validRequest), null)
})

test('rejects insufficient item information before calling AI', () => {
    assert.match(validateEstimateRequest({ ...validRequest, details: 'n/a' }), /more item details/i)
    assert.match(validateEstimateRequest({ ...validRequest, age: 'unknown' }), /item age/i)
})

test('rejects invalid original prices and extra client fields', () => {
    assert.match(validateEstimateRequest({ ...validRequest, originalPrice: '0' }), /greater than zero/i)
    assert.match(validateEstimateRequest({ ...validRequest, price: 400 }), /only title/i)
})

test('normalizes only numeric estimates with ordered bounds and an explicit disclaimer', () => {
    const estimate = normalizePriceEstimate({
        estimatedLow: 500,
        estimatedHigh: 800,
        suggestedPrice: 650,
        explanation: 'The condition and age suggest moderate wear.',
    })

    assert.equal(typeof estimate.estimatedLow, 'number')
    assert.equal(typeof estimate.estimatedHigh, 'number')
    assert.equal(typeof estimate.suggestedPrice, 'number')
    assert.ok(estimate.estimatedLow <= estimate.suggestedPrice)
    assert.ok(estimate.suggestedPrice <= estimate.estimatedHigh)
    assert.match(estimate.explanation, /not a guaranteed selling price/i)
    assert.match(estimate.explanation, /No live marketplace prices were checked/i)
})

test('rejects inconsistent estimates and returns a useful insufficient-information error', () => {
    assert.throws(
        () => normalizePriceEstimate({ estimatedLow: 900, estimatedHigh: 500, suggestedPrice: 650 }),
        (error) => error instanceof AIServiceError && error.statusCode === 502,
    )

    assert.throws(
        () => normalizePriceEstimate({ insufficientInformation: true, validationMessage: 'Add the item age.' }),
        (error) => error instanceof AIServiceError && error.statusCode === 400 && /item age/i.test(error.message),
    )
})
