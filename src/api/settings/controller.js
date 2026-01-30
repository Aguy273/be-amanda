const prisma = require('../../database/db');
const { hashPassword } = require('../../utils/hashPassword');

module.exports = {
  // Get all users that can be managed based on user role
  getAllUsers: async (req, res) => {
    try {
      const { page = 1, limit = 10, search, roleFilter } = req.query;
      const currentUserRole = req.userRole;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      let whereClause = {
        deletedAt: null,
      };

      // Role-based access control
      if (currentUserRole === 'ADMIN') {
        // Admin can only manage STAFF
        whereClause.role = {
          name: 'STAFF',
        };
      } else if (currentUserRole === 'MASTER') {
        // Master can manage STAFF and ADMIN
        if (roleFilter && ['STAFF', 'ADMIN'].includes(roleFilter)) {
          whereClause.role = {
            name: roleFilter,
          };
        } else {
          whereClause.role = {
            name: { in: ['STAFF', 'ADMIN'] },
          };
        }
      }

      // Search functionality
      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Get total count for pagination
      const totalCount = await prisma.user.count({
        where: whereClause,
      });

      // Calculate pagination
      const totalPages = Math.ceil(totalCount / limitNum);
      const skip = (pageNum - 1) * limitNum;

      // Fetch users
      const users = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          hireDate: true,
          createdAt: true,
          updatedAt: true,
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        take: limitNum,
        skip: skip,
        orderBy: { createdAt: 'desc' },
      });

      return res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: users,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalItems: totalCount,
          itemsPerPage: limitNum,
        },
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  // Get user by ID
  getUserById: async (req, res) => {
    try {
      const { id } = req.params;
      const currentUserRole = req.userRole;

      // First, get the user to check their role
      const user = await prisma.user.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          hireDate: true,
          createdAt: true,
          updatedAt: true,
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Role-based access control
      if (currentUserRole === 'ADMIN' && user.role.name !== 'STAFF') {
        return res.status(403).json({
          success: false,
          message: 'Admin can only access STAFF users',
        });
      }

      if (
        currentUserRole === 'MASTER' &&
        !['STAFF', 'ADMIN'].includes(user.role.name)
      ) {
        return res.status(403).json({
          success: false,
          message: 'Master can only access STAFF and ADMIN users',
        });
      }

      return res.json({
        success: true,
        message: 'User retrieved successfully',
        data: user,
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  // Create new user (staff/admin based on permissions)
  createUser: async (req, res) => {
    try {
      const { name, email, phone, password, roleId, hireDate } = req.body;
      const currentUserRole = req.userRole;

      // Validate required fields
      if (!name || !email || !password || !roleId) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, password, and roleId are required',
        });
      }

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists',
        });
      }

      // Get role information to validate permissions
      const targetRole = await prisma.role.findUnique({
        where: { id: roleId },
      });

      if (!targetRole) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role ID',
        });
      }

      // Role-based access control
      if (currentUserRole === 'ADMIN' && targetRole.name !== 'STAFF') {
        return res.status(403).json({
          success: false,
          message: 'Admin can only create STAFF users',
        });
      }

      if (
        currentUserRole === 'MASTER' &&
        !['STAFF', 'ADMIN'].includes(targetRole.name)
      ) {
        return res.status(403).json({
          success: false,
          message: 'Master can only create STAFF and ADMIN users',
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          roleId,
          hireDate: hireDate ? new Date(hireDate) : new Date(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          hireDate: true,
          createdAt: true,
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: newUser,
      });
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  // Update user information
  updateUser: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone, password, roleId, hireDate } = req.body;
      const currentUserRole = req.userRole;

      // Check if user exists
      const existingUser = await prisma.user.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          role: true,
        },
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Role-based access control for existing user
      if (currentUserRole === 'ADMIN' && existingUser.role.name !== 'STAFF') {
        return res.status(403).json({
          success: false,
          message: 'Admin can only update STAFF users',
        });
      }

      if (
        currentUserRole === 'MASTER' &&
        !['STAFF', 'ADMIN'].includes(existingUser.role.name)
      ) {
        return res.status(403).json({
          success: false,
          message: 'Master can only update STAFF and ADMIN users',
        });
      }

      // Check email uniqueness if email is being updated
      if (email && email !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email },
        });

        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: 'Email already exists',
          });
        }
      }

      // Validate role change permissions
      if (roleId && roleId !== existingUser.roleId) {
        const newRole = await prisma.role.findUnique({
          where: { id: roleId },
        });

        if (!newRole) {
          return res.status(400).json({
            success: false,
            message: 'Invalid role ID',
          });
        }

        // Role-based access control for role changes
        if (currentUserRole === 'ADMIN' && newRole.name !== 'STAFF') {
          return res.status(403).json({
            success: false,
            message: 'Admin can only assign STAFF role',
          });
        }

        if (
          currentUserRole === 'MASTER' &&
          !['STAFF', 'ADMIN'].includes(newRole.name)
        ) {
          return res.status(403).json({
            success: false,
            message: 'Master can only assign STAFF and ADMIN roles',
          });
        }
      }

      // Prepare update data
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (roleId) updateData.roleId = roleId;
      if (hireDate) updateData.hireDate = new Date(hireDate);

      // Hash password if provided
      if (password) {
        updateData.password = await hashPassword(password);
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          hireDate: true,
          createdAt: true,
          updatedAt: true,
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return res.json({
        success: true,
        message: 'User updated successfully',
        data: updatedUser,
      });
    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  // Soft delete user
  deleteUser: async (req, res) => {
    try {
      const { id } = req.params;
      const currentUserRole = req.userRole;

      // Check if user exists
      const existingUser = await prisma.user.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          role: true,
        },
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Role-based access control
      if (currentUserRole === 'ADMIN' && existingUser.role.name !== 'STAFF') {
        return res.status(403).json({
          success: false,
          message: 'Admin can only delete STAFF users',
        });
      }

      if (
        currentUserRole === 'MASTER' &&
        !['STAFF', 'ADMIN'].includes(existingUser.role.name)
      ) {
        return res.status(403).json({
          success: false,
          message: 'Master can only delete STAFF and ADMIN users',
        });
      }

      // Prevent self-deletion
      if (existingUser.id === req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'You cannot delete your own account',
        });
      }

      // Soft delete user
      await prisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  // Get available roles that current user can assign
  getAvailableRoles: async (req, res) => {
    try {
      const currentUserRole = req.userRole;

      let roleNames = [];

      if (currentUserRole === 'ADMIN') {
        roleNames = ['STAFF'];
      } else if (currentUserRole === 'MASTER') {
        roleNames = ['STAFF', 'ADMIN'];
      }

      const roles = await prisma.role.findMany({
        where: {
          name: { in: roleNames },
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      });

      return res.json({
        success: true,
        message: 'Available roles retrieved successfully',
        data: roles,
      });
    } catch (error) {
      console.error('Error fetching available roles:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  // Get user statistics
  getUserStats: async (req, res) => {
    try {
      const currentUserRole = req.userRole;

      let whereClause = {
        deletedAt: null,
      };

      // Role-based filtering for stats
      if (currentUserRole === 'ADMIN') {
        whereClause.role = { name: 'STAFF' };
      } else if (currentUserRole === 'MASTER') {
        whereClause.role = { name: { in: ['STAFF', 'ADMIN'] } };
      }

      // Get user counts by role
      const userCounts = await prisma.user.groupBy({
        by: ['roleId'],
        where: whereClause,
        _count: { id: true },
      });

      // Get role names for the counts
      const rolesWithCounts = await Promise.all(
        userCounts.map(async (count) => {
          const role = await prisma.role.findUnique({
            where: { id: count.roleId },
            select: { name: true },
          });
          return {
            roleName: role?.name || 'Unknown',
            count: count._count.id,
          };
        })
      );

      // Get total count
      const totalUsers = await prisma.user.count({ where: whereClause });

      // Get recently added users (last 7 days)
      const recentUsers = await prisma.user.count({
        where: {
          ...whereClause,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      });

      return res.json({
        success: true,
        message: 'User statistics retrieved successfully',
        data: {
          totalUsers,
          usersByRole: rolesWithCounts,
          recentUsers,
        },
      });
    } catch (error) {
      console.error('Error fetching user statistics:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },
};
