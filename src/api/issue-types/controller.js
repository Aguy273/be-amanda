const prisma = require('../../database/db');

module.exports = {
  // Get all issue types
  getAll: async (req, res) => {
    try {
      const { search } = req.query;

      let whereClause = {
        deletedAt: null,
      };

      // Search in name and description if search query provided
      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const issueTypes = await prisma.issueType.findMany({
        where: whereClause,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { reports: true },
          },
        },
      });

      return res.json({
        success: true,
        message: 'Issue types retrieved successfully',
        data: issueTypes,
      });
    } catch (error) {
      console.error('Error fetching issue types:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  // Get issue type by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const issueType = await prisma.issueType.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          _count: {
            select: { reports: true },
          },
        },
      });

      if (!issueType) {
        return res.status(404).json({
          success: false,
          message: 'Issue type not found',
        });
      }

      return res.json({
        success: true,
        message: 'Issue type retrieved successfully',
        data: issueType,
      });
    } catch (error) {
      console.error('Error fetching issue type:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  // Get reports by issue type
  getReportsByIssueType: async (req, res) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 10, status, priority } = req.query;

      // Check if issue type exists
      const issueType = await prisma.issueType.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!issueType) {
        return res.status(404).json({
          success: false,
          message: 'Issue type not found',
        });
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      let whereClause = {
        issueTypeId: id,
        deletedAt: null,
      };

      // Filter by status if provided
      if (status) {
        whereClause.status = status;
      }

      // Filter by priority if provided
      if (priority && ['RENDAH', 'SEDANG', 'TINGGI'].includes(priority.toUpperCase())) {
        whereClause.priority = priority.toUpperCase();
      }

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where: whereClause,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            responses: {
              include: {
                admin: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        }),
        prisma.report.count({ where: whereClause }),
      ]);

      return res.json({
        success: true,
        message: 'Reports retrieved successfully',
        data: {
          issueType,
          reports,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
          },
        },
      });
    } catch (error) {
      console.error('Error fetching reports by issue type:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  // Create new issue type
  create: async (req, res) => {
    try {
      const { name, description, icon, color } = req.body;

      // Validate required fields
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Name is required',
        });
      }

      // Check if issue type with same name already exists
      const existingIssueType = await prisma.issueType.findFirst({
        where: {
          name,
          deletedAt: null,
        },
      });

      if (existingIssueType) {
        return res.status(400).json({
          success: false,
          message: 'Issue type with this name already exists',
        });
      }

      const newIssueType = await prisma.issueType.create({
        data: {
          name,
          description,
          icon,
          color,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Issue type created successfully',
        data: newIssueType,
      });
    } catch (error) {
      console.error('Error creating issue type:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  // Update issue type
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, icon, color } = req.body;

      // Check if issue type exists
      const existingIssueType = await prisma.issueType.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existingIssueType) {
        return res.status(404).json({
          success: false,
          message: 'Issue type not found',
        });
      }

      // Check if new name conflicts with existing issue type
      if (name && name !== existingIssueType.name) {
        const nameConflict = await prisma.issueType.findFirst({
          where: {
            name,
            deletedAt: null,
            id: { not: id },
          },
        });

        if (nameConflict) {
          return res.status(400).json({
            success: false,
            message: 'Issue type with this name already exists',
          });
        }
      }

      const updateData = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (icon !== undefined) updateData.icon = icon;
      if (color !== undefined) updateData.color = color;

      const updatedIssueType = await prisma.issueType.update({
        where: { id },
        data: updateData,
      });

      return res.json({
        success: true,
        message: 'Issue type updated successfully',
        data: updatedIssueType,
      });
    } catch (error) {
      console.error('Error updating issue type:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },

  // Soft delete issue type
  destroy: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if issue type exists
      const existingIssueType = await prisma.issueType.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existingIssueType) {
        return res.status(404).json({
          success: false,
          message: 'Issue type not found',
        });
      }

      // Check if there are reports using this issue type
      const reportsCount = await prisma.report.count({
        where: {
          issueTypeId: id,
          deletedAt: null,
        },
      });

      if (reportsCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete issue type. It is being used by ${reportsCount} report(s)`,
        });
      }

      await prisma.issueType.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return res.json({
        success: true,
        message: 'Issue type deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting issue type:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },
};
