const router = require('express').Router();
const rateLimit = require('express-rate-limit');

const {
  getAllChats,
  getUserConversation,
  sendMessage,
  getChatStats,
  deleteMessage,
  getMyConversations,
  markAsRead,
  getUnreadCount,
  getAvailableUsers,
  markBroadcastsAsRead,
} = require('./controller');

// Middleware
const { authenticateToken } = require('../../utils/authMiddleware');
const {
  authorize,
  chatSecurity,
  validateChatMessage,
  validateChatResponse,
} = require('./auth-middleware');

// ✅ IMPORT PERMISSION MIDDLEWARE
const { checkPermission } = require('../../utils/checkPermission');

// Rate limiting
const messageLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many messages sent' },
});

// =======================
// CHAT ROUTES
// =======================

router.get(
  '/chats',
  authenticateToken,
  chatSecurity,
  authorize(['ADMIN', 'MASTER']),
  getAllChats
);

router.get(
  '/chats/my-conversations',
  authenticateToken,
  chatSecurity,
  getMyConversations
);

// ✅ FINAL: CHAT STATS BASED ON PERMISSION
router.get(
  '/chats/stats',
  authenticateToken,
  checkPermission('chats.monitor'),
  getChatStats
);

router.get(
  '/chats/user/:userId',
  authenticateToken,
  chatSecurity,
  authorize(['ADMIN', 'MASTER']),
  getUserConversation
);

router.post(
  '/chats/send',
  authenticateToken,
  chatSecurity,
  messageLimit,
  validateChatMessage,
  authorize(['STAFF', 'ADMIN', 'MASTER']),
  sendMessage
);

router.delete(
  '/chats/:id',
  authenticateToken,
  authorize(['ADMIN', 'MASTER']),
  deleteMessage
);

router.put(
  '/chats/:chatId/read',
  authenticateToken,
  chatSecurity,
  markAsRead
);

router.get(
  '/chats/unread/count',
  authenticateToken,
  chatSecurity,
  getUnreadCount
);

router.get(
  '/chats/available-users',
  authenticateToken,
  chatSecurity,
  authorize(['STAFF', 'ADMIN', 'MASTER']),
  getAvailableUsers
);

router.put(
  '/chats/broadcasts/mark-read',
  authenticateToken,
  chatSecurity,
  markBroadcastsAsRead
);

module.exports = router;