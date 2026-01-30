const prisma = require('../database/db');

/**
 * Middleware to check if user has specific permission
 * @param {string} requiredPermission - Permission name (e.g., 'users.create', 'reports.delete')
 * @returns {Function} Express middleware function
 */
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated (should be set by authenticateToken middleware)
      if (!req.user || !req.user.roleId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Check if user's role has the required permission
      const rolePermission = await prisma.rolePermission.findFirst({
        where: {
          roleId: req.user.roleId,
          permission: {
            name: requiredPermission,
          },
        },
        include: {
          permission: true,
        },
      });

      if (!rolePermission) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action',
          requiredPermission,
        });
      }

      // Attach permission info to request for logging/debugging
      req.permission = rolePermission.permission;

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error during permission check',
      });
    }
  };
};

/**
 * Middleware to check if user has ANY of the specified permissions
 * @param {string[]} permissions - Array of permission names
 * @returns {Function} Express middleware function
 */
const checkAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.roleId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Check if user's role has any of the required permissions
      const rolePermission = await prisma.rolePermission.findFirst({
        where: {
          roleId: req.user.roleId,
          permission: {
            name: {
              in: permissions,
            },
          },
        },
        include: {
          permission: true,
        },
      });

      if (!rolePermission) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action',
          requiredPermissions: permissions,
        });
      }

      req.permission = rolePermission.permission;

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error during permission check',
      });
    }
  };
};

/**
 * Middleware to check if user has ALL of the specified permissions
 * @param {string[]} permissions - Array of permission names
 * @returns {Function} Express middleware function
 */
const checkAllPermissions = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.roleId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Check if user's role has all of the required permissions
      const rolePermissions = await prisma.rolePermission.findMany({
        where: {
          roleId: req.user.roleId,
          permission: {
            name: {
              in: permissions,
            },
          },
        },
        include: {
          permission: true,
        },
      });

      if (rolePermissions.length !== permissions.length) {
        return res.status(403).json({
          success: false,
          message: 'You do not have all required permissions to perform this action',
          requiredPermissions: permissions,
        });
      }

      req.permissions = rolePermissions.map(rp => rp.permission);

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error during permission check',
      });
    }
  };
};

/**
 * Helper function to get all permissions for a user
 * Can be used in controllers to check permissions programmatically
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} Array of permission names
 */
const getUserPermissions = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    return user.role.rolePermissions.map(rp => rp.permission.name);
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
};

/**
 * Helper function to check if user has specific permission
 * Can be used in controllers for conditional logic
 * @param {string} userId - User ID
 * @param {string} permissionName - Permission name to check
 * @returns {Promise<boolean>} True if user has permission
 */
const userHasPermission = async (userId, permissionName) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return false;
    }

    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        roleId: user.roleId,
        permission: {
          name: permissionName,
        },
      },
    });

    return !!rolePermission;
  } catch (error) {
    console.error('Error checking user permission:', error);
    return false;
  }
};

module.exports = {
  checkPermission,
  checkAnyPermission,
  checkAllPermissions,
  getUserPermissions,
  userHasPermission,
};
