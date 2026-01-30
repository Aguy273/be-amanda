// Validation helper functions

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number format (Indonesian format)
const isValidPhone = (phone) => {
  if (!phone) return true; // Phone is optional
  const phoneRegex = /^(\+62|62|0)[0-9]{9,13}$/;
  return phoneRegex.test(phone.replace(/\s|-/g, ''));
};

// Validate password strength
const isValidPassword = (password) => {
  if (!password || password.length < 6) return false;
  return true;
};

// Validate required fields
const validateRequiredFields = (data, requiredFields) => {
  const errors = [];

  requiredFields.forEach((field) => {
    if (
      !data[field] ||
      (typeof data[field] === 'string' && data[field].trim() === '')
    ) {
      errors.push(`${field} is required`);
    }
  });

  return errors;
};

// Validate user role
const isValidRole = (roleName) => {
  const validRoles = ['STAFF', 'ADMIN', 'MASTER'];
  return validRoles.includes(roleName.toUpperCase());
};

// Validate FAQ type
const isValidFAQType = (type) => {
  const validTypes = ['TEXT', 'ARTICLE', 'FILE'];
  return validTypes.includes(type.toUpperCase());
};

// Validate report status
const isValidReportStatus = (status) => {
  const validStatuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  return validStatuses.includes(status.toUpperCase());
};

// Sanitize string input
const sanitizeString = (str) => {
  if (!str || typeof str !== 'string') return str;
  return str.trim().replace(/\s+/g, ' '); // Remove extra whitespaces
};

// Validate UUID format
const isValidUUID = (uuid) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Response formatter
const formatResponse = (success, message, data = null, errors = null) => {
  const response = {
    success,
    message,
    timestamp: new Date().toISOString(),
  };

  if (data !== null) response.data = data;
  if (errors !== null) response.errors = errors;

  return response;
};

// Error handler middleware
const handleValidationError = (error) => {
  if (error.code === 'P2002') {
    // Unique constraint violation
    return {
      success: false,
      message: `${error.meta?.target?.[0] || 'Field'} already exists`,
      errors: ['Duplicate entry'],
    };
  }

  if (error.code === 'P2025') {
    // Record not found
    return {
      success: false,
      message: 'Record not found',
      errors: ['The requested resource does not exist'],
    };
  }

  return {
    success: false,
    message: 'Validation error',
    errors: [error.message],
  };
};

module.exports = {
  isValidEmail,
  isValidPhone,
  isValidPassword,
  validateRequiredFields,
  isValidRole,
  isValidFAQType,
  isValidReportStatus,
  sanitizeString,
  isValidUUID,
  formatResponse,
  handleValidationError,
};
