const CampusVoice = require('../models/CampusVoice')
const notifications = require('./notificationService')

async function moderateCampusVoice(postId, status, moderatorId, note = '') {
    const post = await CampusVoice.findById(postId).select('+author +moderationHistory')
    if (!post) return null
    if (post.status === status) return post
    const previousStatus = post.status
    const action = status === 'active'
        ? previousStatus === 'pending' ? 'approved' : 'restored'
        : status
    post.status = status
    post.moderationHistory.push({ action, moderator: moderatorId, note })
    await post.save()

    if (post.category === 'confession' && post.author) {
        const notificationCopy = status === 'active'
            ? previousStatus === 'pending'
                ? { title: 'Your confession was approved', message: 'Your anonymous confession is now visible in Campus Voices.' }
                : { title: 'Your confession is visible again', message: 'A moderator restored your anonymous confession to Campus Voices.' }
            : status === 'hidden'
                ? { title: 'Your confession was hidden', message: 'A moderator hid your anonymous confession from the public feed.' }
                : status === 'rejected'
                    ? { title: 'Your confession was not approved', message: 'A moderator did not approve your anonymous confession for publication.' }
                    : { title: 'Your confession was removed', message: 'A moderator removed your anonymous confession from the public feed.' }
        try {
            await notifications.createAndEmitNotification({
                recipient: post.author,
                type: 'system',
                ...notificationCopy,
            })
        } catch (error) {
            console.error('Campus confession notification failed:', error.name || 'Error')
        }
    }
    return post
}

module.exports = { moderateCampusVoice }
