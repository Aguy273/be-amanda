const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = uploadsDir;

    // Create subdirectories based on file type
    if (file.fieldname === 'reportImages' || file.fieldname === 'reportFiles') {
      uploadPath = path.join(uploadsDir, 'reports');
    } else if (file.fieldname === 'responseFiles') {
      uploadPath = path.join(uploadsDir, 'reports', 'responses');
    } else if (file.fieldname === 'chatImages') {
      uploadPath = path.join(uploadsDir, 'chats');
    } else if (file.fieldname === 'faqFiles') {
      uploadPath = path.join(uploadsDir, 'faqs');
    } else if (file.fieldname === 'profileImage') {
      uploadPath = path.join(uploadsDir, 'profiles');
    }

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  },
});

// File filter for images only
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extName = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimeType = allowedTypes.test(file.mimetype);

  if (mimeType && extName) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// File filter for FAQ files (documents and images)
const faqFileFilter = (req, file, cb) => {
  const allowedTypes =
    /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|xls|xlsx|ppt|pptx/;
  const extName = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];
  const mimeType = allowedMimeTypes.includes(file.mimetype);

  if (mimeType && extName) {
    return cb(null, true);
  } else {
    cb(
      new Error(
        'Only document and image files are allowed (pdf, doc, docx, txt, xls, xlsx, ppt, pptx, jpeg, jpg, png, gif, webp)'
      )
    );
  }
};

// Configure upload middleware for images
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5, // Maximum 5 files
  },
  fileFilter: imageFilter,
});

// Configure upload middleware for FAQ files
const faqUpload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for documents
    files: 3, // Maximum 3 files
  },
  fileFilter: faqFileFilter,
});

// Create a more flexible FAQ upload middleware that handles unexpected fields
const createFaqUploadMiddleware = () => {
  return (req, res, next) => {
    // Use multer with fields specification - more flexible approach
    const flexibleFaqUpload = multer({
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for documents
        files: 3, // Maximum 3 files
      },
      fileFilter: faqFileFilter,
    }).fields([{ name: 'faqFiles', maxCount: 3 }]);

    flexibleFaqUpload(req, res, (err) => {
      if (err) {
        console.error('File upload error:', err);
        // Handle specific multer errors
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            message:
              'Unexpected file field. Please use "faqFiles" as the field name.',
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed',
        });
      }

      // Convert multer fields format to array format for backward compatibility
      if (req.files && req.files.faqFiles) {
        req.files = req.files.faqFiles;
      } else {
        req.files = [];
      }

      next();
    });
  };
};

// Create report upload middleware for reportFiles
const createReportUploadMiddleware = () => {
  return (req, res, next) => {
    const reportUpload = multer({
      storage: storage,
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
        files: 10, // Allow more files initially
      },
    }).any();

    reportUpload(req, res, (err) => {
      if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed',
        });
      }

      // Filter and validate only reportFiles
      if (req.files && req.files.length > 0) {
        const reportFiles = req.files.filter(
          (file) => file.fieldname === 'reportFiles'
        );

        const validFiles = [];
        for (const file of reportFiles) {
          const allowedTypes =
            /jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv|webm|pdf|doc|docx|txt|xls|xlsx|ppt|pptx/;
          const extName = allowedTypes.test(
            path.extname(file.originalname).toLowerCase()
          );
          const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/quicktime',
            'video/x-msvideo',
            'video/x-matroska',
            'video/webm',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          ];
          const mimeType = allowedMimeTypes.includes(file.mimetype);

          if (mimeType && extName) {
            validFiles.push(file);
          } else {
            // Delete invalid file
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
        }

        // Limit to 5 files max
        req.files = validFiles.slice(0, 5);
      } else {
        req.files = [];
      }

      next();
    });
  };
};

// Create response upload middleware for responseFiles
const createResponseUploadMiddleware = () => {
  return (req, res, next) => {
    const responseUpload = multer({
      storage: storage,
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
        files: 10, // Allow more files initially
      },
    }).any();

    responseUpload(req, res, (err) => {
      if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed',
        });
      }

      // Filter and validate only responseFiles
      if (req.files && req.files.length > 0) {
        const responseFiles = req.files.filter(
          (file) => file.fieldname === 'responseFiles'
        );

        const validFiles = [];
        for (const file of responseFiles) {
          const allowedTypes =
            /jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv|webm|pdf|doc|docx|txt|xls|xlsx|ppt|pptx/;
          const extName = allowedTypes.test(
            path.extname(file.originalname).toLowerCase()
          );
          const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/quicktime',
            'video/x-msvideo',
            'video/x-matroska',
            'video/webm',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          ];
          const mimeType = allowedMimeTypes.includes(file.mimetype);

          if (mimeType && extName) {
            validFiles.push(file);
          } else {
            // Delete invalid file
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
        }

        // Limit to 3 files max for responses
        req.files = validFiles.slice(0, 3);
      } else {
        req.files = [];
      }

      next();
    });
  };
};

// Alternative FAQ upload middleware using .any() to avoid unexpected field errors
const createFaqUploadMiddlewareAny = () => {
  return (req, res, next) => {
    const anyUpload = multer({
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 10, // Allow more files initially
      },
    }).any();

    anyUpload(req, res, (err) => {
      if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed',
        });
      }

      // Filter and validate only faqFiles
      if (req.files && req.files.length > 0) {
        const faqFiles = req.files.filter(
          (file) => file.fieldname === 'faqFiles'
        );

        // Validate file types for faqFiles
        const validFiles = [];
        for (const file of faqFiles) {
          const allowedTypes =
            /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|xls|xlsx|ppt|pptx/;
          const extName = allowedTypes.test(
            path.extname(file.originalname).toLowerCase()
          );
          const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          ];
          const mimeType = allowedMimeTypes.includes(file.mimetype);

          if (mimeType && extName) {
            validFiles.push(file);
          } else {
            // Delete invalid file
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
        }

        // Limit to 3 files max
        req.files = validFiles.slice(0, 3);
      } else {
        req.files = [];
      }

      next();
    });
  };
};

// Upload middleware for different types
const uploadMiddleware = {
  reportImages: upload.array('reportImages', 5),
  reportFiles: createReportUploadMiddleware(),
  responseFiles: createResponseUploadMiddleware(),
  chatImages: upload.array('chatImages', 3),
  faqFiles: createFaqUploadMiddlewareAny(), // Use the more flexible version
  faqFilesStrict: createFaqUploadMiddleware(), // Keep the strict version as alternative
  single: upload.single('image'),
  profileImage: upload.single('profileImage'),
};

// Helper function to get file URLs
const getFileUrls = (files, baseUrl = '') => {
  if (!files || !Array.isArray(files)) return [];

  return files.map((file) => {
    const relativePath = file.path
      .replace(process.cwd(), '')
      .replace(/\\/g, '/');
    return `${baseUrl}${relativePath}`;
  });
};

// Helper function to delete uploaded files
const deleteFiles = (filePaths) => {
  if (!filePaths || !Array.isArray(filePaths)) return;

  filePaths.forEach((filePath) => {
    const fullPath = path.join(process.cwd(), filePath.replace(/^\//, ''));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  });
};

module.exports = {
  uploadMiddleware,
  getFileUrls,
  deleteFiles,
  faqUpload,
  upload,
};
