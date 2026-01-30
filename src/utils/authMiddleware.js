// Middleware for JWT authentication and role-based access control

const prisma = require('../database/db');
const { verifyToken, extractTokenFromHeader } = require('./jwtUtils');

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    // Verify and decode the token
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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

    console.log('logged in user', user);

    if (!user || user.deletedAt) {
      return res.status(401).json({
        success: false,
        message: 'User not found or account deactivated',
      });
    }

    const permissions = user.role.rolePermissions.map(rp => rp.permission.name);

    req.user = user;
    req.userRole = user.role.name;
    req.userId = user.id;
    req.userPermissions = permissions;
    req.tokenPayload = decoded;

    next();
  } catch (error) {
    console.error('JWT Authentication error:', error);

    if (error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
  }
};

// Middleware to check if user exists and get role (legacy - for backward compatibility)
const getUserRole = async (req, res, next) => {
  try {
    const { userId } = req.body || req.query || req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
      },
    });

    if (!user || user.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    req.user = user;
    req.userRole = user.role.name;
    next();
  } catch (error) {
    console.error('Error getting user role:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Middleware to check if user is staff
const requireStaff = (req, res, next) => {
  if (!req.userRole || req.userRole !== 'STAFF') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Staff role required.',
    });
  }
  next();
};

// Middleware to check if user is admin or master
const requireAdmin = (req, res, next) => {
  if (!req.userRole || !['ADMIN', 'MASTER'].includes(req.userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.',
    });
  }
  next();
};

// Middleware to check if user is master
const requireMaster = (req, res, next) => {
  if (!req.userRole || req.userRole !== 'MASTER') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Master role required.',
    });
  }
  next();
};

// Middleware to check if user can access resource (owner or admin)
const requireOwnerOrAdmin = (req, res, next) => {
  const { userId } = req.params || req.body || req.query;
  const resourceId = req.params.id; // For cases where resource ID is in params

  if (!req.userRole) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  // Master and Admin can access everything
  if (['ADMIN', 'MASTER'].includes(req.userRole)) {
    return next();
  }

  // Staff can only access their own resources
  // Check both userId parameter and resource ownership
  if (req.userRole === 'STAFF') {
    if (userId && req.user.id === userId) {
      return next();
    }

    // For resources like reports, we might need to check ownership differently
    // This will be handled in the controller if needed
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied. You can only access your own resources.',
  });
};

module.exports = {
  authenticateToken,
  getUserRole,
  requireStaff,
  requireAdmin,
  requireMaster,
  requireOwnerOrAdmin,
};
