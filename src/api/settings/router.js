const router = require('express').Router();
const {
  authenticateToken,
  requireAdmin,
  requireMaster,
} = require('../../utils/authMiddleware');

const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getAvailableRoles,
  getUserStats,
} = require('./controller');

// Middleware to check if user is ADMIN or MASTER
const requireAdminOrMaster = (req, res, next) => {
  if (!req.userRole || !['ADMIN', 'MASTER'].includes(req.userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Master role required.',
    });
  }
  next();
};

// Settings routes - Only ADMIN and MASTER can access
// GET routes
router.get(
  '/settings/users',
  authenticateToken,
  requireAdminOrMaster,
  getAllUsers
); // Get all manageable users

router.get(
  '/settings/users/stats',
  authenticateToken,
  requireAdminOrMaster,
  getUserStats
); // Get user statistics

router.get(
  '/settings/roles',
  authenticateToken,
  requireAdminOrMaster,
  getAvailableRoles
); // Get available roles for assignment

router.get(
  '/settings/users/:id',
  authenticateToken,
  requireAdminOrMaster,
  getUserById
); // Get specific user by ID

// POST routes
router.post(
  '/settings/users',
  authenticateToken,
  requireAdminOrMaster,
  createUser
); // Create new user (staff/admin based on permissions)

// PUT routes
router.put(
  '/settings/users/:id',
  authenticateToken,
  requireAdminOrMaster,
  updateUser
); // Update user information

// DELETE routes
router.delete(
  '/settings/users/:id',
  authenticateToken,
  requireAdminOrMaster,
  deleteUser
); // Delete user (soft delete)

module.exports = router;
