// Removed authenticateToken - now using centralized version from utils/authMiddleware.js

/**
 * Role-based authorization middleware
 * Use this after authenticateToken to check for specific roles
 *
 * @param {string[]} allowedRoles - Array of role names that are allowed
 * @returns {Function} Express middleware function
 *
 * Example usage:
 * router.get('/admin-only', authenticateToken, authorize(['ADMIN', 'MASTER']), handler);
 */
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role || !req.user.role.name) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
        });
      }

      const userRole = req.user.role.name;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. This endpoint requires one of the following roles: ${allowedRoles.join(
            ', '
          )}. Your role: ${userRole}`,
        });
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during authorization.',
      });
    }
  };
};

/**
 * Optional: Additional security middleware for chat endpoints
 * Checks for suspicious activity or additional business rules
 */
const chatSecurity = (req, res, next) => {
  try {
    // Example: Check if user is active/not suspended
    if (req.user && req.user.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'Account is suspended. Cannot access chat features.',
      });
    }

    // Example: Check business hours (if needed)
    const now = new Date();
    const hour = now.getHours();

    // Uncomment if you want to restrict chat to business hours
    // if (hour < 8 || hour > 18) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Chat is only available during business hours (8 AM - 6 PM).',
    //   });
    // }

    next();
  } catch (error) {
    console.error('Chat security check error:', error);
    next(); // Continue even if security check fails (optional)
  }
};

/**
 * Middleware to validate request body for chat endpoints
 */
const validateChatMessage = (req, res, next) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Message is required and must be a string.',
    });
  }

  if (message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message cannot be empty.',
    });
  }

  if (message.length > 2000) {
    return res.status(400).json({
      success: false,
      message: 'Message is too long. Maximum length is 2000 characters.',
    });
  }

  // Trim the message
  req.body.message = message.trim();
  next();
};

/**
 * Middleware to validate chat response request
 */
const validateChatResponse = (req, res, next) => {
  const { chatId, message } = req.body;

  if (!chatId || typeof chatId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Chat ID is required and must be a string.',
    });
  }

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Message is required and must be a string.',
    });
  }

  if (message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message cannot be empty.',
    });
  }

  if (message.length > 2000) {
    return res.status(400).json({
      success: false,
      message: 'Message is too long. Maximum length is 2000 characters.',
    });
  }

  // Trim the message
  req.body.message = message.trim();
  next();
};

module.exports = {
  authorize,
  chatSecurity,
  validateChatMessage,
  validateChatResponse,
};
