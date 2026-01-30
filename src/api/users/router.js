const router = require('express').Router();
const {
  authenticateToken,
  requireAdmin,
  requireMaster,
} = require('../../utils/authMiddleware');
const { authorize } = require('../chats/auth-middleware');

const {
  get,
  getById,
  create,
  update,
  destroy,
  getAvailableRoles,
  getStats,
} = require('./controller');
const { uploadMiddleware } = require('../../utils/fileUpload');

// All user routes require authentication
router.get(
  '/users/stats',
  authenticateToken,
  authorize(['MASTER', 'ADMIN']),
  getStats
);
router.get(
  '/users/available-roles',
  authenticateToken,
  authorize(['MASTER', 'ADMIN']),
  getAvailableRoles
);
router.get(
  '/users/:id',
  authenticateToken,
  authorize(['MASTER', 'ADMIN']),
  getById
);
router.get('/users', authenticateToken, authorize(['MASTER', 'ADMIN']), get);
router.post(
  '/users',
  authenticateToken,
  authorize(['MASTER', 'ADMIN']),
  create
);
router.put(
  '/users/:id',
  authenticateToken,
  uploadMiddleware.profileImage,
  update
);
router.delete(
  '/users/:id',
  authenticateToken,
  authorize(['MASTER', 'ADMIN']),
  destroy
);

module.exports = router;
