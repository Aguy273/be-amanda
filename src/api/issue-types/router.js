const express = require('express');
const router = express.Router();
const controller = require('./controller');
const authMiddleware = require('../../utils/authMiddleware');
const { checkPermission } = require('../../utils/checkPermission');

// All routes require authentication
router.use(authMiddleware.authenticateToken);

// Get all issue types (all authenticated users can view)
router.get('/', controller.getAll);

// Get issue type by ID (all authenticated users can view)
router.get('/:id', controller.getById);

// Get reports by issue type (all authenticated users can view)
router.get('/:id/reports', controller.getReportsByIssueType);

// Create new issue type (requires permission)
router.post('/', checkPermission('issue-types.create'), controller.create);

// Update issue type (requires permission)
router.put('/:id', checkPermission('issue-types.update'), controller.update);

// Delete issue type (requires permission)
router.delete('/:id', checkPermission('issue-types.delete'), controller.destroy);

module.exports = router;
