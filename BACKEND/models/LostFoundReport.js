const mongoose = require('mongoose')

const lostFoundReportSchema = new mongoose.Schema({
    type: { type: String, enum: ['lost', 'found'], required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    location: { type: String, required: true, trim: true, maxlength: 160 },
    date: { type: Date, required: true },
    images: { type: [String], default: [] },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'claimed', 'returned', 'closed'], default: 'active', index: true },
}, { timestamps: true })

lostFoundReportSchema.index({ status: 1, type: 1, createdAt: -1 })
lostFoundReportSchema.index({ status: 1, category: 1, createdAt: -1 })
lostFoundReportSchema.index({ status: 1, location: 1, createdAt: -1 })
lostFoundReportSchema.index({ reportedBy: 1, createdAt: -1 })

module.exports = mongoose.model('LostFoundReport', lostFoundReportSchema)
