const prisma = require('../../database/db');

// Get all roles with permission count
const getAllRoles = async (req, res) => {
  try {
    const { search } = req.query;

    const whereClause = {
      deletedAt: null,
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const roles = await prisma.role.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            rolePermissions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      message: 'Roles retrieved successfully',
      data: roles,
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Get role by ID with all permissions
const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role || role.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    return res.json({
      success: true,
      message: 'Role retrieved successfully',
      data: role,
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Create new role
const createRole = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Role name is required',
      });
    }

    // Check if role already exists
    const existingRole = await prisma.role.findFirst({
      where: {
        name: name.toUpperCase(),
        deletedAt: null,
      },
    });

    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: 'Role with this name already exists',
      });
    }

    const newRole = await prisma.role.create({
      data: {
        name: name.toUpperCase(),
        description,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: newRole,
    });
  } catch (error) {
    console.error('Error creating role:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Update role
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role || role.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    // Check if new name conflicts with existing role
    if (name && name.toUpperCase() !== role.name) {
      const existingRole = await prisma.role.findFirst({
        where: {
          name: name.toUpperCase(),
          deletedAt: null,
          id: { not: id },
        },
      });

      if (existingRole) {
        return res.status(400).json({
          success: false,
          message: 'Role with this name already exists',
        });
      }
    }

    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        name: name ? name.toUpperCase() : undefined,
        description,
      },
    });

    return res.json({
      success: true,
      message: 'Role updated successfully',
      data: updatedRole,
    });
  } catch (error) {
    console.error('Error updating role:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Delete role (soft delete)
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!role || role.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    // Check if role is being used by any users
    if (role._count.users > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role. It is being used by ${role._count.users} user(s)`,
      });
    }

    await prisma.role.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Assign permission to role
const assignPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissionId } = req.body;

    if (!permissionId) {
      return res.status(400).json({
        success: false,
        message: 'Permission ID is required',
      });
    }

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role || role.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    // Check if permission exists
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found',
      });
    }

    // Check if already assigned
    const existing = await prisma.rolePermission.findFirst({
      where: {
        roleId: id,
        permissionId,
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Permission already assigned to this role',
      });
    }

    const rolePermission = await prisma.rolePermission.create({
      data: {
        roleId: id,
        permissionId,
      },
      include: {
        permission: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Permission assigned successfully',
      data: rolePermission,
    });
  } catch (error) {
    console.error('Error assigning permission:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Remove permission from role
const removePermission = async (req, res) => {
  try {
    const { id, permissionId } = req.params;

    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        roleId: id,
        permissionId,
      },
    });

    if (!rolePermission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not assigned to this role',
      });
    }

    await prisma.rolePermission.delete({
      where: {
        id: rolePermission.id,
      },
    });

    return res.json({
      success: true,
      message: 'Permission removed successfully',
    });
  } catch (error) {
    console.error('Error removing permission:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

module.exports = {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  assignPermission,
  removePermission,
};
