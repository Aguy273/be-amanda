const router = require('express').Router();
const { uploadMiddleware } = require('../../utils/fileUpload');
const {
  authenticateToken,
  requireOwnerOrAdmin,
} = require('../../utils/authMiddleware');
const { checkPermission, checkAnyPermission } = require('../../utils/checkPermission');

const {
  getAll,
  getById,
  create,
  update,
  addResponse,
  destroy,
} = require('./controller');

router.get('/reports', authenticateToken, getAll);  

router.get('/reports/:id', authenticateToken, getById); 

router.post(
  '/reports',
  authenticateToken,
  checkPermission('reports.create'),
  uploadMiddleware.reportFiles,
  create
); 

router.put(
  '/reports/:id',
  authenticateToken,
  requireOwnerOrAdmin,
  checkAnyPermission(['reports.update', 'reports.assign']), 
  uploadMiddleware.reportFiles,
  update
); 

router.post(
  '/reports/:id/responses',
  authenticateToken,
  checkAnyPermission(['reports.update', 'reports.assign']), 
  uploadMiddleware.responseFiles,
  addResponse
); 

router.delete(
  '/reports/:id',
  authenticateToken,
  checkPermission('reports.delete'),
  destroy
); 

module.exports = router;
