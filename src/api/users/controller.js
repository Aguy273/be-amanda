const prisma = require("../../database/db");
const bcrypt = require("bcrypt");
const { ADMIN_ROLE, MASTER_ROLE, STAFF_ROLE } = require("../../lib/constants");
const { getFileUrls } = require("../../utils/fileUpload");

module.exports = {
  get: async (req, res) => {
    try {
      const { page = 1, limit = 10, search = "", roleFilter = "" } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      // Build where clause for filtering
      const where = {
        deletedAt: null,
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }),
        ...(roleFilter && {
          role: { name: { equals: roleFilter, mode: "insensitive" } },
        }),
      };

      if (req.user.role.name === ADMIN_ROLE) {
        if (roleFilter && roleFilter.toUpperCase() === MASTER_ROLE) {
          where.role = { name: { equals: 'NON_EXISTENT_ROLE' } };
        } else if (!roleFilter) {
          where.role = { name: { in: [STAFF_ROLE, ADMIN_ROLE] } };
        }
      }


      const total = await prisma.user.count({ where });

      // Get paginated users
      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: {
            select: {
              id: true,
              name: true,
            },
          },
          phone: true,
          createdAt: true,
          updatedAt: true,
          hireDate: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      });

      const totalPages = Math.ceil(total / take);

      // console.log('Fetched users:', users);

      return res.json({
        success: true,
        message: "Users retrieved successfully",
        data: users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: take,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: {
          id,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: {
            select: {
              id: true,
              name: true,
            },
          },
          phone: true,
          createdAt: true,
          updatedAt: true,
          hireDate: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          data: null,
        });
      }

      return res.json({
        success: true,
        message: "User retrieved successfully",
        data: user,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        data: null,
      });
    }
  },
  create: async (req, res) => {
    try {
      const { name, email, phone, password, roleId, hireDate } = req.body;

      const user = req.user;

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser && !existingUser.deletedAt) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
          data: null,
        });
      }

      const role = await prisma.role.findUnique({
        where: { id: roleId, deletedAt: null },
      });

      console.log("role akun yang dibikin", role);

      if (role.name === req.user.role.name && role.name === ADMIN_ROLE) {
        return res.status(403).json({
          success: false,
          message: "Admin users cannot create other Admin users",
          data: null,
        });
      }

      if (req.user.role.name === ADMIN_ROLE && role.name !== STAFF_ROLE) {
        return res.status(403).json({
          success: false,
          message: "Admin users can only create Staff users",
          data: null,
        });
      }

      if (
        req.user.role.name === MASTER_ROLE &&
        role.name !== ADMIN_ROLE &&
        role.name !== STAFF_ROLE
      ) {
        return res.status(403).json({
          success: false,
          message: "Master users can only create Admin and Staff users",
          data: null,
        });
      }

      console.log("Creating user with role:", role, "user:", user);

      const getSalt = 10;
      const hashPassword = await bcrypt.hash(password, getSalt);

      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          phone,
          password: hashPassword,
          roleId,
          hireDate: hireDate ? new Date(hireDate) : new Date(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: {
            select: {
              id: true,
              name: true,
            },
          },
          phone: true,
          createdAt: true,
          updatedAt: true,
          hireDate: true,
        },
      });

      return res.status(201).json({
        success: true,
        message: "User created successfully",
        data: newUser,
      });
    } catch (error) {
      console.error("Error creating user:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone, password, roleId, hireDate, address } =
        req.body;

      const isSelfUpdate = req.user.id === id;
      const canUpdateOthers =
        req.user.role.name === ADMIN_ROLE || req.user.role.name === MASTER_ROLE;

      if (!isSelfUpdate && !canUpdateOthers) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to update this user",
          data: null,
        });
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          data: null,
        });
      }

      // Check if email is taken by another user
      if (email && email !== existingUser.email) {
        const emailTaken = await prisma.user.findUnique({
          where: { email },
        });

        if (emailTaken && !emailTaken.deletedAt && emailTaken.id !== id) {
          return res.status(400).json({
            success: false,
            message: "Email already exists",
            data: null,
          });
        }
      }

      // Prepare update data
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (password !== undefined) {
        const getSalt = 10;
        updateData.password = await bcrypt.hash(password, getSalt);
      }
      if (roleId !== undefined) updateData.roleId = roleId;
      if (roleId !== undefined) updateData.roleId = roleId;
      if (hireDate !== undefined) updateData.hireDate = new Date(hireDate);

      if (req.file) {
        const fileUrls = getFileUrls([req.file]);
        if (fileUrls.length > 0) {
          updateData.avatar = fileUrls[0];
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          address: true,
          role: {
            select: {
              id: true,
              name: true,
            },
          },
          phone: true,
          createdAt: true,
          updatedAt: true,
          hireDate: true,
        },
      });

      return res.json({
        success: true,
        message: "User updated successfully",
        data: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        data: null,
      });
    }
  },

  destroy: async (req, res) => {
    const { id } = req.params;
    try {
      const user = await prisma.user.findUnique({
        where: {
          id,
          deletedAt: null,
        },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }
      await prisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return res.json({
        success: true,
        message: "User deleted successfully",
        data: null,
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  getAvailableRoles: async (req, res) => {
    try {
      // Get current user's role to determine which roles they can assign
      const currentUserRole = req.user.role.name;
      let allowedRoles = [];

      if (currentUserRole === ADMIN_ROLE) {
        allowedRoles = [STAFF_ROLE];
      } else if (currentUserRole === MASTER_ROLE) {
        allowedRoles = [ADMIN_ROLE, STAFF_ROLE];
      }

      const result = await prisma.role.findMany({
        where: {
          deletedAt: null,
          name: {
            in: allowedRoles,
          },
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: "asc" },
      });

      return res.json({
        success: true,
        message: "Available roles retrieved successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error fetching available roles:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        data: [],
      });
    }
  },

  getStats: async (req, res) => {
    try {
      // Get total users count (excluding deleted)
      const totalUsers = await prisma.user.count({
        where: {
          deletedAt: null,
        },
      });

      // Get users by role
      const usersByRole = await prisma.role.findMany({
        where: {
          deletedAt: null,
        },
        select: {
          name: true,
          _count: {
            select: {
              users: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      });

      // Format users by role data
      const formattedUsersByRole = usersByRole.map((role) => ({
        roleName: role.name,
        count: role._count.users,
      }));

      // Get recent users (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentUsers = await prisma.user.count({
        where: {
          deletedAt: null,
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      });

      return res.json({
        success: true,
        message: "User statistics retrieved successfully",
        data: {
          totalUsers,
          usersByRole: formattedUsersByRole,
          recentUsers,
        },
      });
    } catch (error) {
      console.error("Error fetching user statistics:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        data: {
          totalUsers: 0,
          usersByRole: [],
          recentUsers: 0,
        },
      });
    }
  },
};
