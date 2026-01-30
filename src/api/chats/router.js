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

// Import middleware functions
const { authenticateToken } = require('../../utils/authMiddleware');
const {
  authorize,
  chatSecurity,
  validateChatMessage,
  validateChatResponse,
} = require('./auth-middleware'); // Sesuaikan path middleware auth Anda

// Rate limiting untuk prevent spam
const messageLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 menit
  max: 10, // 10 pesan per menit
  message: { success: false, message: 'Too many messages sent' },
});

// Chat routes
router.get(
  '/chats',
  authenticateToken,
  chatSecurity,
  authorize(['ADMIN', 'MASTER']),
  getAllChats
); // Get all chats (admin/master only)
router.get(
  '/chats/my-conversations',
  authenticateToken,
  chatSecurity,
  getMyConversations
); // Get user's own chats
router.get(
  '/chats/stats',
  authenticateToken,
  authorize(['MASTER']),
  getChatStats
); // Get stats (master only)
router.get(
  '/chats/user/:userId',
  authenticateToken,
  chatSecurity,
  authorize(['ADMIN', 'MASTER']),
  getUserConversation
); // Get specific conversation (admin/master only)
router.post(
  '/chats/send',
  authenticateToken,
  chatSecurity,
  messageLimit,
  validateChatMessage,
  authorize(['STAFF', 'ADMIN', 'MASTER']),
  sendMessage
); // Send message (all authenticated users)
router.delete(
  '/chats/:id',
  authenticateToken,
  authorize(['ADMIN', 'MASTER']),
  deleteMessage
); // Delete message (admin/master only)

// Additional utility endpoints
router.put('/chats/:chatId/read', authenticateToken, chatSecurity, markAsRead); // Mark chat as read

router.get(
  '/chats/unread/count',
  authenticateToken,
  chatSecurity,
  getUnreadCount
); // Get unread messages count

router.get(
  '/chats/available-users',
  authenticateToken,
  chatSecurity,
  authorize(['STAFF', 'ADMIN', 'MASTER']),
  getAvailableUsers
); // Get users available for messaging

router.put(
  '/chats/broadcasts/mark-read',
  authenticateToken,
  chatSecurity,
  markBroadcastsAsRead
);

module.exports = router;
