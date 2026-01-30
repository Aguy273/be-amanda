const prisma = require('../../database/db');
const { getFileUrls, deleteFiles } = require('../../utils/fileUpload');

/**
 * Get all broadcasts (All authenticated users)
 * Returns all broadcast messages ordered by creation date
 */
const getAllBroadcasts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.role?.name;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Convert to integers
    const pageNum = Number.parseInt(page);
    const limitNum = Number.parseInt(limit);

    const whereClause = {
      deletedAt: null,
    };

    // Search in message if search query provided
    if (search) {
      whereClause.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Get total count for pagination metadata
    const totalCount = await prisma.broadcast.count({
      where: whereClause,
    });

    // Calculate pagination values
    const totalPages = Math.ceil(totalCount / limitNum);
    const skip = (pageNum - 1) * limitNum;

    // Fetch paginated data
    const broadcasts = await prisma.broadcast.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      take: limitNum,
      skip: skip,
      orderBy: { createdAt: 'asc' },
    });

    return res.json({
      success: true,
      message: 'Broadcasts retrieved successfully',
      data: broadcasts,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
      },
    });
  } catch (error) {
    console.error('Error fetching broadcasts:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get broadcast by ID (All authenticated users)
 * Returns specific broadcast message with full details
 */
const getBroadcastById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role?.name;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found',
      });
    }

    return res.json({
      success: true,
      message: 'Broadcast retrieved successfully',
      data: broadcast,
    });
  } catch (error) {
    console.error('Error fetching broadcast:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Create new broadcast (Admin/Master/Staff)
 * Creates a new broadcast message that all users can see
 */
const createBroadcast = async (req, res) => {
  try {
    const { message, files } = req.body;
    const userId = req.user.id;
    const userRole = req.user?.role?.name;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Only admin, master, and staff can create broadcasts
    if (!['ADMIN', 'MASTER', 'STAFF'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin, master, or staff can create broadcasts',
      });
    }

    // Validate required fields
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // Check if user exists and has proper role
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        role: {
          name: { in: ['ADMIN', 'MASTER', 'STAFF'] },
        },
        deletedAt: null,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found or insufficient permissions',
      });
    }

    // Handle file uploads
    let fileUrls = [];
    if (req.files && req.files.length > 0) {
      fileUrls = getFileUrls(req.files, `${req.protocol}://${req.get('host')}`);
    }

    // Use uploaded files or existing files from body
    const finalFiles = fileUrls.length > 0 ? fileUrls : files || [];

    const newBroadcast = await prisma.broadcast.create({
      data: {
        message,
        userId,
        files: finalFiles,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    try {
      const allUsers = await prisma.user.findMany({
        where: {
          deletedAt: null,
          id: { not: userId },
        },
        select: { id: true },
      });

      const notificationsData = allUsers.map((targetUser) => ({
        userId: targetUser.id,
        title: '📢 Broadcast Baru',
        message: `${user.name} mengirim broadcast baru`,
        isRead: false,
      }));

      if (notificationsData.length > 0) {
        await prisma.notification.createMany({
          data: notificationsData,
        });
      }

      console.log(
        `Created ${notificationsData.length} notifications for new broadcast`
      );
    } catch (notifError) {
      console.error('Error creating broadcast notifications:', notifError);
    }

    return res.status(201).json({
      success: true,
      message: 'Broadcast created successfully',
      data: newBroadcast,
    });
  } catch (error) {
    console.error('Error creating broadcast:', error);

    // Delete uploaded files if broadcast creation fails
    if (req.files && req.files.length > 0) {
      const fileUrls = getFileUrls(req.files);
      deleteFiles(fileUrls);
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Update broadcast (Admin/Master/Staff - only own broadcasts or Master can edit any)
 * Updates broadcast message and files
 */
const updateBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, files, keepExistingFiles } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role?.name;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Only admin, master, and staff can update broadcasts
    if (!['ADMIN', 'MASTER', 'STAFF'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin, master, or staff can update broadcasts',
      });
    }

    // Check if broadcast exists
    const existingBroadcast = await prisma.broadcast.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!existingBroadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found',
      });
    }

    // Authorization check: only the creator or master can update
    if (existingBroadcast.userId !== userId && userRole !== 'MASTER') {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own broadcasts',
      });
    }

    const updateData = {};
    if (message) updateData.message = message;

    // Handle file uploads
    let newFileUrls = [];
    if (req.files && req.files.length > 0) {
      newFileUrls = getFileUrls(
        req.files,
        `${req.protocol}://${req.get('host')}`
      );
    }

    // Determine final files array
    let finalFiles = [];
    if (keepExistingFiles === 'true' && existingBroadcast.files) {
      // Keep existing files and add new ones
      finalFiles = [...existingBroadcast.files, ...newFileUrls];
    } else if (newFileUrls.length > 0) {
      // Replace all files with new ones
      if (existingBroadcast.files && existingBroadcast.files.length > 0) {
        deleteFiles(existingBroadcast.files);
      }
      finalFiles = newFileUrls;
    } else if (files && Array.isArray(files)) {
      // Use files from body (for direct URL updates)
      finalFiles = files;
    } else if (keepExistingFiles !== 'true') {
      // Remove all files if keepExistingFiles is not true and no new files
      if (existingBroadcast.files && existingBroadcast.files.length > 0) {
        deleteFiles(existingBroadcast.files);
      }
      finalFiles = [];
    } else {
      // Keep existing files only
      finalFiles = existingBroadcast.files || [];
    }

    updateData.files = finalFiles;

    const updatedBroadcast = await prisma.broadcast.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return res.json({
      success: true,
      message: 'Broadcast updated successfully',
      data: updatedBroadcast,
    });
  } catch (error) {
    console.error('Error updating broadcast:', error);

    // Delete uploaded files if update fails
    if (req.files && req.files.length > 0) {
      const fileUrls = getFileUrls(req.files);
      deleteFiles(fileUrls);
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Delete broadcast (Admin/Master/Staff - only own broadcasts or Master can delete any)
 * Soft delete broadcast and cleanup associated files
 */
const deleteBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role?.name;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Only admin, master, and staff can delete broadcasts
    if (!['ADMIN', 'MASTER', 'STAFF'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin, master, or staff can delete broadcasts',
      });
    }

    // Check if broadcast exists
    const existingBroadcast = await prisma.broadcast.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!existingBroadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found',
      });
    }

    // Authorization check: only the creator or master can delete
    if (existingBroadcast.userId !== userId && userRole !== 'MASTER') {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own broadcasts',
      });
    }

    // Delete associated files
    if (existingBroadcast.files && existingBroadcast.files.length > 0) {
      deleteFiles(existingBroadcast.files);
    }

    // Soft delete the broadcast
    await prisma.broadcast.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return res.json({
      success: true,
      message: 'Broadcast deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting broadcast:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get broadcast statistics (Master only)
 * Returns statistics about broadcast usage
 */
const getBroadcastStats = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role?.name;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Only master can access full broadcast statistics
    if (userRole !== 'MASTER') {
      return res.status(403).json({
        success: false,
        message: 'Only master can access broadcast statistics',
      });
    }

    const totalBroadcasts = await prisma.broadcast.count({
      where: { deletedAt: null },
    });

    const broadcastsToday = await prisma.broadcast.count({
      where: {
        deletedAt: null,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    const broadcastsThisWeek = await prisma.broadcast.count({
      where: {
        deletedAt: null,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const authorStats = await prisma.broadcast.groupBy({
      by: ['userId'],
      where: { deletedAt: null },
      _count: {
        id: true,
      },
    });

    const recentBroadcasts = await prisma.broadcast.findMany({
      where: { deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return res.json({
      success: true,
      message: 'Broadcast statistics retrieved successfully',
      data: {
        totalBroadcasts,
        broadcastsToday,
        broadcastsThisWeek,
        totalAuthors: authorStats.length,
        recentBroadcasts,
        authorStats,
      },
    });
  } catch (error) {
    console.error('Error fetching broadcast stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get broadcasts by user (Admin/Master can see all, Staff can only see their own)
 * Returns broadcasts created by a specific user
 */
const getBroadcastsByUser = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const currentUserId = req.user?.id;
    const currentUserRole = req.user?.role?.name;

    if (!currentUserId || !currentUserRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Authorization check
    if (currentUserRole === 'STAFF' && targetUserId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Staff can only access their own broadcasts',
      });
    }

    // Convert to integers
    const pageNum = Number.parseInt(page);
    const limitNum = Number.parseInt(limit);

    const whereClause = {
      userId: targetUserId,
      deletedAt: null,
    };

    // Get total count for pagination
    const totalCount = await prisma.broadcast.count({
      where: whereClause,
    });

    // Calculate pagination values
    const totalPages = Math.ceil(totalCount / limitNum);
    const skip = (pageNum - 1) * limitNum;

    // Fetch data
    const broadcasts = await prisma.broadcast.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      take: limitNum,
      skip: skip,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      message: 'User broadcasts retrieved successfully',
      data: broadcasts,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
      },
    });
  } catch (error) {
    console.error('Error fetching user broadcasts:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const getLatestBroadcasts = async (req, res) => {
  try {
    const result = await prisma.broadcast.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    console.log('Latest broadcasts fetched:', result);

    return res.json({
      success: true,
      message: 'Latest broadcasts retrieved successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error fetching latest broadcasts:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  getAllBroadcasts,
  getBroadcastById,
  createBroadcast,
  updateBroadcast,
  deleteBroadcast,
  getBroadcastStats,
  getBroadcastsByUser,
  getLatestBroadcasts,
};
