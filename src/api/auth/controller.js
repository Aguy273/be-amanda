const prisma = require('../../database/db');
const bcrypt = require('bcrypt');
const hashPassword = require('../../utils/hashPassword');
const { generateTokens, refreshAccessToken } = require('../../utils/jwtUtils');

module.exports = {
  register: async (req, res) => {
    const { email, password, name, roleId } = req.body;

    console.log('Register attempt for email:', req.body);

    try {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      const staffRole = await prisma.role.findUnique({
        where: { name: 'STAFF' },
      });

      if (existingUser) {
        return res
          .status(400)
          .json({ success: false, message: 'Email already exists' });
      }

      const hashedPassword = hashPassword(password);

      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          roleId: staffRole.id,
        },
      });

      // Generate tokens for new user
      const userWithRole = await prisma.user.findUnique({
        where: { id: newUser.id },
        include: { role: true },
      });

      const tokens = generateTokens(userWithRole);

      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            avatar: userWithRole.avatar,
            address: userWithRole.address,
            role: userWithRole.role,
          },
          ...tokens,
        },
      });
    } catch (error) {
      console.error('Error registering user:', error);
      return res
        .status(500)
        .json({ success: false, error: 'Internal server error' });
    }
  },
  login: async (req, res) => {
    const { email, password } = req.body;

    console.log('Login attempt for email:', email, password);

    try {
      const user = await prisma.user.findUnique({
        where: { email },
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

      console.log('User found:', user);

      if (!user) {
        return res.json({
          success: false,
          message: 'Invalid email or password',
        });
      }
      const isPasswordValid = bcrypt.compareSync(password, user.password);
      if (!isPasswordValid) {
        return res.json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Generate JWT tokens
      const tokens = generateTokens(user);

      // Flatten permissions
      const permissions = user.role?.rolePermissions
        ? user.role.rolePermissions.map((rp) => rp.permission.name)
        : [];

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            hireDate: user.hireDate,
            avatar: user.avatar,
            address: user.address,
            role: user.role,
            permissions,
            deletedAt: user.deletedAt,
            updatedAt: user.updatedAt,
            createdAt: user.createdAt,
          },
          ...tokens,
        },
      });
    } catch (error) {
      console.error('Error logging in:', error);
      return res
        .status(500)
        .json({ success: false, error: 'Internal server error' });
    }
  },

  refreshToken: async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    try {
      const result = await refreshAccessToken(refreshToken);

      return res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error refreshing token:', error);
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }
  },

  logout: async (req, res) => {
    // In a more advanced implementation, you might want to blacklist the token
    // For now, we'll just return success and let the client handle token removal
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  },

  // Get current user profile (requires authentication)
  profile: async (req, res) => {
    try {
      // Fetch fresh user data with permissions
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
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

      return res.status(200).json({
        success: true,
        message: 'User profile retrieved successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            hireDate: user.hireDate,
            avatar: user.avatar,
            address: user.address,
            role: user.role,
            permissions: user.role?.rolePermissions
              ? user.role.rolePermissions.map((rp) => rp.permission.name)
              : [],
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
        },
      });
    } catch (error) {
      console.error('Error getting user profile:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },
};
