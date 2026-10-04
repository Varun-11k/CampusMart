const express = require('express')
const {
    getNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
} = require('../controllers/notificationController')
const protect = require('../middleware/authMiddleware')

const router = express.Router()

router.use(protect)
router.get('/', getNotifications)
router.get('/unread-count', getUnreadCount)
router.put('/read-all', markAllNotificationsRead)
router.put('/:id/read', markNotificationRead)
router.delete('/:id', deleteNotification)

module.exports = router
