const prisma = require('../../database/db');

/**
 * Get all global notifications
 * Returns all notifications ordered by newest first
 * Accessible by ADMIN and MASTER only
 */
const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { limit = 20, offset = 0 } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const whereClause = {
      deletedAt: null,
      userId: userId,
    };

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    const totalCount = await prisma.notification.count({
      where: whereClause,
    });

    return res.json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: {
        notifications,
        totalCount,
        currentPage: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get latest notification
 * Returns the most recent notification
 */
const getLatestNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        deletedAt: null,
        userId: userId, // Filter by current user's ID
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('latest notification', notification);

    return res.json({
      success: true,
      message: 'Latest notification retrieved successfully',
      data: notification,
    });
  } catch (error) {
    console.error('Error fetching latest notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Create a global notification for report
 * All admins and masters will see this notification
 */
const createNotification = async (req, res) => {
  try {
    const { title, message } = req.body;
    const userId = req.user?.id;
    // const userRole = req.user?.role?.name;
    // if (!userRole || !['ADMIN', 'MASTER'].includes(userRole)) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Only admin and master can create notifications',
    //   });
    // }

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        userId,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: notification,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Delete a notification (soft delete)
 */
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    // Users can only delete their own notifications
    if (notification.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own notifications',
      });
    }

    await prisma.notification.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get notification statistics (Master only)
 */
const getNotificationStats = async (req, res) => {
  try {
    const userRole = req.user?.role?.name;

    if (!userRole || userRole !== 'MASTER') {
      return res.status(403).json({
        success: false,
        message: 'Only master can access notification statistics',
      });
    }

    const totalNotifications = await prisma.notification.count({
      where: { deletedAt: null },
    });

    const notificationsToday = await prisma.notification.count({
      where: {
        deletedAt: null,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    const recentNotifications = await prisma.notification.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return res.json({
      success: true,
      message: 'Notification statistics retrieved successfully',
      data: {
        totalNotifications,
        notificationsToday,
        recentNotifications,
      },
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
  
/**
 * Mark a notification as read
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    // Users can only mark their own notifications
    if (notification.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only mark your own notifications',
      });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return res.json({
      success: true,
      message: 'Notification marked as read',
      data: updatedNotification,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Mark all notifications as read for current user
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Update all unread notifications for this user
    await prisma.notification.updateMany({
      where: {
        userId: userId,
        isRead: false,
        deletedAt: null,
      },
      data: { isRead: true },
    });

    return res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  getMyNotifications,
  getLatestNotifications,
  createNotification,
  deleteNotification,
  getNotificationStats,
  markAsRead,
  markAllAsRead,
};
