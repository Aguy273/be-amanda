const router = require('express').Router();
const {
  authenticateToken,
  requireOwnerOrAdmin,
} = require('../../utils/authMiddleware');
const { checkPermission } = require('../../utils/checkPermission');

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
  checkPermission('users.read'),
  getStats
);
router.get(
  '/users/available-roles',
  authenticateToken,
  checkPermission('users.read'),
  getAvailableRoles
);
router.get(
  '/users/:id',
  authenticateToken,
  checkPermission('users.read'),
  getById
);
router.get('/users', authenticateToken, checkPermission('users.read'), get);
router.post(
  '/users',
  authenticateToken,
  checkPermission('users.create'),
  create
);
router.put(
  '/users/:id',
  authenticateToken,
  requireOwnerOrAdmin,
  checkPermission('users.update'),
  uploadMiddleware.profileImage,
  update
);
router.delete(
  '/users/:id',
  authenticateToken,
  checkPermission('users.delete'),
  destroy
);

module.exports = router;
