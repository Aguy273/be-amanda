const express = require('express');
const router = express.Router();
const controller = require('./controller');
const authMiddleware = require('../../utils/authMiddleware');
const { checkPermission } = require('../../utils/checkPermission');

// All routes require authentication
router.use(authMiddleware.authenticateToken);

// Get all permissions
router.get('/', controller.getAllPermissions);

// Get permission by ID
router.get('/:id', controller.getPermissionById);

// Create new permission (Admin only)
router.post(
  '/',
  checkPermission('permissions.create'),
  controller.createPermission
);

// Update permission (Admin only)
router.put(
  '/:id',
  checkPermission('permissions.update'),
  controller.updatePermission
);

// Delete permission (Admin only)
router.delete(
  '/:id',
  checkPermission('permissions.delete'),
  controller.deletePermission
);

module.exports = router;
