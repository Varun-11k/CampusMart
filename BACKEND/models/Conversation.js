const mongoose = require('mongoose')

const conversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }],
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        default: undefined,
    },
    lostFoundReport: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LostFoundReport',
        default: undefined,
    },
    campusExchange: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CampusExchange',
        default: undefined,
    },
    participantKey: {
        type: String,
        select: false,
    },
    lastMessage: {
        type: String,
        default: '',
        trim: true,
    },
}, {
    timestamps: true,
    toJSON: {
        transform: (document, returned) => {
            delete returned.participantKey
            return returned
        },
    },
})

conversationSchema.path('participants').validate(
    (participants) => Array.isArray(participants) && participants.length === 2,
    'A conversation must have exactly two participants'
)

conversationSchema.pre('validate', function validateTarget() {
    if ([this.product, this.lostFoundReport, this.campusExchange].filter(Boolean).length !== 1) {
        throw new Error('A conversation must reference exactly one marketplace product, Lost & Found report, or Campus Exchange listing')
    }
})

conversationSchema.index(
    { product: 1, participantKey: 1 },
    { unique: true, partialFilterExpression: { participantKey: { $type: 'string' } } }
)
conversationSchema.index(
    { lostFoundReport: 1, participantKey: 1 },
    { unique: true, partialFilterExpression: { participantKey: { $type: 'string' }, lostFoundReport: { $type: 'objectId' } } }
)
conversationSchema.index(
    { campusExchange: 1, participantKey: 1 },
    { unique: true, partialFilterExpression: { participantKey: { $type: 'string' }, campusExchange: { $type: 'objectId' } } }
)

module.exports = mongoose.model('Conversation', conversationSchema)
