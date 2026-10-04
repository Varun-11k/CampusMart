const express = require('express')
const {
    createConversation,
    createLostFoundConversation,
    createCampusExchangeConversation,
    getConversations,
    getConversationMessages,
    sendMessage,
} = require('../controllers/chatController')
const protect = require('../middleware/authMiddleware')

const router = express.Router()

router.use(protect)
router.post('/conversations', createConversation)
router.post('/lost-found', createLostFoundConversation)
router.post('/campus-exchange', createCampusExchangeConversation)
router.get('/conversations', getConversations)
router.get('/conversations/:conversationId/messages', getConversationMessages)
router.post('/conversations/:conversationId/messages', sendMessage)

module.exports = router
