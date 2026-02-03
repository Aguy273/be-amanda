const router = require('express').Router();
const multer = require('multer');
const { uploadMiddleware } = require('../../utils/fileUpload');
const { authenticateToken } = require('../../utils/authMiddleware');
const { checkPermission } = require('../../utils/checkPermission');

const { getAll, getById, create, update, destroy } = require('./controller');

// FAQ routes - public read, admin write
router.get('/faqs', getAll); // Public access
router.get('/faqs/:id', getById); // Public access
router.post(
  '/faqs',
  authenticateToken,
  checkPermission('faqs.create'),
  uploadMiddleware.faqFiles,
  create
);
router.put(
  '/faqs/:id',
  authenticateToken,
  checkPermission('faqs.update'),
  uploadMiddleware.faqFiles,
  update
);
router.delete('/faqs/:id', authenticateToken, checkPermission('faqs.delete'), destroy);

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: `Unexpected field "${error.field}". Please use "faqFiles" as the field name for file uploads.`,
    });
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  next(error);
});

module.exports = router;
