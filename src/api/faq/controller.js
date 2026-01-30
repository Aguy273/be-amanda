const prisma = require('../../database/db');
const { getFileUrls, deleteFiles } = require('../../utils/fileUpload');

module.exports = {
  // Get all FAQs
  getAll: async (req, res) => {
    try {
      const { type, search } = req.query;

      let whereClause = {
        deletedAt: null,
      };

      // Filter by type if provided
      if (type && ['TEXT', 'ARTICLE', 'FILE'].includes(type.toUpperCase())) {
        whereClause.type = type.toUpperCase();
      }

      // Search in question and answer if search query provided
      if (search) {
        whereClause.OR = [
          { question: { contains: search, mode: 'insensitive' } },
          { answer: { contains: search, mode: 'insensitive' } },
        ];
      }

      const faqs = await prisma.fAQ.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      });

      return res.json({
        success: true,
        message: 'FAQs retrieved successfully',
        data: faqs,
      });
    } catch (error) {
      console.error('Error fetching FAQs:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  // Get FAQ by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const faq = await prisma.fAQ.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!faq) {
        return res.status(404).json({
          success: false,
          message: 'FAQ not found',
        });
      }

      return res.json({
        success: true,
        message: 'FAQ retrieved successfully',
        data: faq,
      });
    } catch (error) {
      console.error('Error fetching FAQ:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  // Create new FAQ
  create: async (req, res) => {
    try {
      const { question, answer, type } = req.body;

      // Validate required fields
      if (!question || !answer || !type) {
        return res.status(400).json({
          success: false,
          message: 'Question, answer, and type are required',
        });
      }

      // Validate type
      if (!['TEXT', 'ARTICLE', 'FILE'].includes(type.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: 'Type must be TEXT, ARTICLE, or FILE',
        });
      }

      // Handle file uploads
      let fileUrls = [];
      if (req.files && req.files.length > 0) {
        fileUrls = getFileUrls(
          req.files,
          `${req.protocol}://${req.get('host')}`
        );
      }

      const newFAQ = await prisma.fAQ.create({
        data: {
          question,
          answer,
          type: type.toUpperCase(),
          files: fileUrls,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'FAQ created successfully',
        data: newFAQ,
      });
    } catch (error) {
      console.error('Error creating FAQ:', error);

      // Delete uploaded files if FAQ creation fails
      if (req.files && req.files.length > 0) {
        const fileUrls = getFileUrls(req.files);
        deleteFiles(fileUrls);
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  // Update FAQ
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { question, answer, type, keepExistingFiles } = req.body;

      console.log('check body', req.body);
      console.log('check files', req.files);
      console.log('check params', req.params);

      // Debug logging (can be removed in production)
      console.log('Update FAQ - Files received:', req.files?.length || 0);
      if (req.files?.length > 0) {
        console.log(
          'File field names:',
          req.files.map((f) => f.fieldname)
        );
      }

      // Check if FAQ exists
      const existingFAQ = await prisma.fAQ.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existingFAQ) {
        return res.status(404).json({
          success: false,
          message: 'FAQ not found',
        });
      }

      // Validate type if provided
      if (type && !['TEXT', 'ARTICLE', 'FILE'].includes(type.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: 'Type must be TEXT, ARTICLE, or FILE',
        });
      }

      const updateData = {};
      if (question) updateData.question = question;
      if (answer) updateData.answer = answer;
      if (type) updateData.type = type.toUpperCase();

      // Handle file uploads
      let newFileUrls = [];
      if (req.files && req.files.length > 0) {
        newFileUrls = getFileUrls(
          req.files,
          `${req.protocol}://${req.get('host')}`
        );
      }

      // Determine final files array
      let finalFiles = [];
      if (keepExistingFiles === 'true' && existingFAQ.files) {
        // Keep existing files and add new ones
        finalFiles = [...existingFAQ.files, ...newFileUrls];
      } else if (newFileUrls.length > 0) {
        // Replace all files with new ones
        if (existingFAQ.files && existingFAQ.files.length > 0) {
          deleteFiles(existingFAQ.files);
        }
        finalFiles = newFileUrls;
      } else if (keepExistingFiles !== 'true') {
        // Remove all files if keepExistingFiles is not true and no new files
        if (existingFAQ.files && existingFAQ.files.length > 0) {
          deleteFiles(existingFAQ.files);
        }
        finalFiles = [];
      } else {
        // Keep existing files only
        finalFiles = existingFAQ.files || [];
      }

      updateData.files = finalFiles;

      const updatedFAQ = await prisma.fAQ.update({
        where: { id },
        data: updateData,
      });

      return res.json({
        success: true,
        message: 'FAQ updated successfully',
        data: updatedFAQ,
      });
    } catch (error) {
      console.error('Error updating FAQ:', error);

      // Delete uploaded files if update fails
      if (req.files && req.files.length > 0) {
        const fileUrls = getFileUrls(req.files);
        deleteFiles(fileUrls);
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  // Soft delete FAQ
  destroy: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if FAQ exists
      const existingFAQ = await prisma.fAQ.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existingFAQ) {
        return res.status(404).json({
          success: false,
          message: 'FAQ not found',
        });
      }

      // Delete associated files
      if (existingFAQ.files && existingFAQ.files.length > 0) {
        deleteFiles(existingFAQ.files);
      }

      await prisma.fAQ.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return res.json({
        success: true,
        message: 'FAQ deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },
};
