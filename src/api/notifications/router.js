const router = require('express').Router();
const rateLimit = require('express-rate-limit');

const {
  getMyNotifications,
  createNotification,
  getLatestNotifications,
  deleteNotification,
  getNotificationStats,
  markAsRead,
  markAllAsRead,
} = require('./controller');

// Import middleware functions
const { authenticateToken } = require('../../utils/authMiddleware');
const { authorize } = require('../chats/auth-middleware');

// Rate limiting untuk prevent spam
const notificationLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 menit
  max: 30, // 30 requests per menit
  message: { success: false, message: 'Too many requests' },
});

// Notification routes - Now accessible to all authenticated users

// Get all global notifications
router.get(
  '/',
  authenticateToken,
  notificationLimit,
  getMyNotifications
);

// Get notification statistics (Master only)
router.get('/stats', authorize(['MASTER']), getNotificationStats);

// Get latest notification
router.get(
  '/latest',
  authenticateToken,
  notificationLimit,
  getLatestNotifications
);

// Create global notification
router.post(
  '/',
  authenticateToken,
  notificationLimit,
  createNotification
);

// Delete notification
router.delete(
  '/:id',
  authenticateToken,
  notificationLimit,
  deleteNotification
);

// Mark as read
router.put(
  '/:id/read',
  authenticateToken,
  notificationLimit,
  markAsRead
);

// Mark all as read
router.put(
  '/read-all',
  authenticateToken,
  notificationLimit,
  markAllAsRead
);

module.exports = router;
