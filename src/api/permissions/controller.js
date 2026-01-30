const prisma = require('../../database/db');

// Get all permissions grouped by resource
const getAllPermissions = async (req, res) => {
  try {
    const { search, resource } = req.query;

    const whereClause = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (resource) {
      whereClause.resource = resource;
    }

    const permissions = await prisma.permission.findMany({
      where: whereClause,
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });

    // Group by resource
    const grouped = permissions.reduce((acc, permission) => {
      if (!acc[permission.resource]) {
        acc[permission.resource] = [];
      }
      acc[permission.resource].push(permission);
      return acc;
    }, {});

    return res.json({
      success: true,
      message: 'Permissions retrieved successfully',
      data: permissions,
      grouped,
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Get permission by ID
const getPermissionById = async (req, res) => {
  try {
    const { id } = req.params;

    const permission = await prisma.permission.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            rolePermissions: true,
          },
        },
      },
    });

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found',
      });
    }

    return res.json({
      success: true,
      message: 'Permission retrieved successfully',
      data: permission,
    });
  } catch (error) {
    console.error('Error fetching permission:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Create new permission
const createPermission = async (req, res) => {
  try {
    const { name, description, resource, action } = req.body;

    if (!name || !resource || !action) {
      return res.status(400).json({
        success: false,
        message: 'Name, resource, and action are required',
      });
    }

    // Check if permission already exists
    const existingPermission = await prisma.permission.findFirst({
      where: { name },
    });

    if (existingPermission) {
      return res.status(400).json({
        success: false,
        message: 'Permission with this name already exists',
      });
    }

    const newPermission = await prisma.permission.create({
      data: {
        name,
        description,
        resource,
        action,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Permission created successfully',
      data: newPermission,
    });
  } catch (error) {
    console.error('Error creating permission:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Update permission
const updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, resource, action } = req.body;

    const permission = await prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found',
      });
    }

    // Check if new name conflicts
    if (name && name !== permission.name) {
      const existingPermission = await prisma.permission.findFirst({
        where: {
          name,
          id: { not: id },
        },
      });

      if (existingPermission) {
        return res.status(400).json({
          success: false,
          message: 'Permission with this name already exists',
        });
      }
    }

    const updatedPermission = await prisma.permission.update({
      where: { id },
      data: {
        name,
        description,
        resource,
        action,
      },
    });

    return res.json({
      success: true,
      message: 'Permission updated successfully',
      data: updatedPermission,
    });
  } catch (error) {
    console.error('Error updating permission:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Delete permission
const deletePermission = async (req, res) => {
  try {
    const { id } = req.params;

    const permission = await prisma.permission.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            rolePermissions: true,
          },
        },
      },
    });

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found',
      });
    }

    // Check if permission is being used
    if (permission._count.rolePermissions > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete permission. It is assigned to ${permission._count.rolePermissions} role(s)`,
      });
    }

    await prisma.permission.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: 'Permission deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting permission:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

module.exports = {
  getAllPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,
};
