const router = require('express').Router();
const rateLimit = require('express-rate-limit');

const {
  getAllBroadcasts,
  getBroadcastById,
  createBroadcast,
  updateBroadcast,
  deleteBroadcast,
  getBroadcastStats,
  getBroadcastsByUser,
  getLatestBroadcasts,
} = require('./controller');

// Import middleware functions
const { authenticateToken } = require('../../utils/authMiddleware');
const { checkPermission } = require('../../utils/checkPermission');
const { upload } = require('../../utils/fileUpload');

// Rate limiting untuk prevent spam
const broadcastLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 menit
  max: 10, // 10 broadcast per 5 menit
  message: { success: false, message: 'Too many broadcasts created' },
});

// Validation middleware
const validateBroadcastMessage = (req, res, next) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Message is required and must be a string',
    });
  }

  if (message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message cannot be empty',
    });
  }

  if (message.length > 2000) {
    return res.status(400).json({
      success: false,
      message: 'Message cannot exceed 2000 characters',
    });
  }

  next();
};

// Authorization middleware
const authorize = (roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role?.name;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        message: 'User role not found',
      });
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`,
      });
    }

    next();
  };
};

// Broadcast routes

// GET /broadcasts - Get all broadcasts (All authenticated users)
router.get('/broadcasts', authenticateToken, getAllBroadcasts);

// GET /broadcasts/stats - Get broadcast statistics (requires permission)
router.get(
  '/broadcasts/stats',
  authenticateToken,
  checkPermission('broadcasts.read'),
  getBroadcastStats
);

router.get(
  '/broadcasts/latest',
  authenticateToken,
  authorize(['MASTER', 'ADMIN', 'STAFF']),
  getLatestBroadcasts
);

// GET /broadcasts/user/:userId - Get broadcasts by specific user
router.get('/broadcasts/user/:userId', authenticateToken, getBroadcastsByUser);

// GET /broadcasts/:id - Get broadcast by ID (All authenticated users)
router.get('/broadcasts/:id', authenticateToken, getBroadcastById);

// POST /broadcasts - Create new broadcast (requires permission)
router.post(
  '/broadcasts',
  authenticateToken,
  checkPermission('broadcasts.create'),
  broadcastLimit,
  upload.array('files', 10), // Allow up to 10 files
  validateBroadcastMessage,
  createBroadcast
);

// PUT /broadcasts/:id - Update broadcast (requires permission)
router.put(
  '/broadcasts/:id',
  authenticateToken,
  checkPermission('broadcasts.update'),
  upload.array('files', 10), // Allow up to 10 files
  validateBroadcastMessage,
  updateBroadcast
);

// DELETE /broadcasts/:id - Delete broadcast (requires permission)
router.delete(
  '/broadcasts/:id',
  authenticateToken,
  checkPermission('broadcasts.delete'),
  deleteBroadcast
);

module.exports = router;
