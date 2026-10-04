const mongoose = require('mongoose')

const resourceSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    type: { type: String, enum: ['notes', 'previous_paper', 'syllabus', 'study_material', 'useful_link'], required: true, index: true },
    subject: { type: String, trim: true, maxlength: 150, default: '' },
    course: { type: String, trim: true, maxlength: 150, default: '' },
    semester: { type: String, trim: true, maxlength: 50, default: '' },
    year: { type: Number, min: 1900, max: 2100, default: undefined },
    fileUrl: { type: String, trim: true, default: undefined },
    externalUrl: { type: String, trim: true, default: undefined },
    thumbnailUrl: { type: String, trim: true, default: undefined },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'hidden', 'removed'], default: 'active', index: true },
    downloads: { type: Number, min: 0, default: 0 },
}, { timestamps: true })

resourceSchema.pre('validate', function validateResourceTarget() {
    const hasFile = Boolean(this.fileUrl)
    const hasExternal = Boolean(this.externalUrl)
    if (hasFile === hasExternal) this.invalidate('fileUrl', 'A resource must have exactly one file or external URL')
    if (this.type === 'useful_link' && (!hasExternal || hasFile)) this.invalidate('externalUrl', 'Useful links must use an external URL')
})

resourceSchema.index({ status: 1, createdAt: -1 })
resourceSchema.index({ status: 1, downloads: -1, createdAt: -1 })
resourceSchema.index({ status: 1, type: 1, createdAt: -1 })
resourceSchema.index({ status: 1, subject: 1, course: 1, semester: 1 })
resourceSchema.index({ title: 'text', description: 'text', subject: 'text', course: 'text' })
resourceSchema.index({ uploadedBy: 1, createdAt: -1 })

module.exports = mongoose.model('Resource', resourceSchema)
