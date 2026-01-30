const express = require('express');
const router = express.Router();
const controller = require('./controller');
const authMiddleware = require('../../utils/authMiddleware');
const { checkPermission } = require('../../utils/checkPermission');

// All routes require authentication
router.use(authMiddleware.authenticateToken);

// Get all roles
router.get('/', controller.getAllRoles);

// Get role by ID with permissions
router.get('/:id', controller.getRoleById);

// Create new role (Admin only)
router.post('/', checkPermission('roles.create'), controller.createRole);

// Update role (Admin only)
router.put('/:id', checkPermission('roles.update'), controller.updateRole);

// Delete role (Admin only)
router.delete('/:id', checkPermission('roles.delete'), controller.deleteRole);

// Assign permission to role (Admin only)
router.post(
  '/:id/permissions',
  checkPermission('roles.update'),
  controller.assignPermission
);

// Remove permission from role (Admin only)
router.delete(
  '/:id/permissions/:permissionId',
  checkPermission('roles.update'),
  controller.removePermission
);

module.exports = router;
