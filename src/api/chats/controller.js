const moment = require('moment');
const prisma = require('../../database/db');

/**
 * Get all conversations (Admin/Master only)
 * Returns all chat conversations grouped by participants
 */
const getAllChats = async (req, res) => {
  try {
    const { search } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.role?.name;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Only ADMIN and MASTER can view all chats
    if (!['ADMIN', 'MASTER'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    const whereClause = {
      deletedAt: null,
    };

    if (search) {
      whereClause.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const chats = await prisma.chat.findMany({
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
        recipient: {
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
      orderBy: { createdAt: 'desc' },
    });

    // Group chats by conversation pairs
    // Format for frontend compatibility (Admin/Master view)
    const conversationMap = {};

    chats.forEach((chat) => {
      const user1 = chat.userId;
      const user2 = chat.recipientId || 'general';

      // Create a unique conversation key (sorted to ensure same key for both directions)
      const convKey = [user1, user2].sort().join('-');

      if (!conversationMap[convKey]) {
        // Determine which user is the "other" person from current user's perspective
        const otherUser = chat.userId === userId ? chat.recipient : chat.user;
        const otherUserId =
          chat.userId === userId ? chat.recipientId : chat.userId;

        conversationMap[convKey] = {
          id: chat.id, // Use first chat id as conversation id
          user: otherUser, // The other person in conversation
          recipient: otherUser, // Alias for compatibility
          recipientId: otherUserId,
          messages: [],
          participants: [chat.user],
        };

        if (chat.recipient) {
          conversationMap[convKey].participants.push(chat.recipient);
        }
      }

      conversationMap[convKey].messages.push({
        id: chat.id,
        message: chat.message,
        sender: chat.user,
        recipient: chat.recipient,
        isRead: chat.isRead,
        isFromUser: chat.userId !== userId, // Message from the other user
        admin: chat.userId === userId ? null : chat.user, // For compatibility
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      });
    });

    // Sort messages in each conversation and add metadata
    const conversations = Object.values(conversationMap).map((conv) => {
      const sortedMessages = conv.messages.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );

      // Count unread messages (messages not from current user that are unread)
      const unreadCount = sortedMessages.filter(
        (msg) => !msg.isRead && msg.sender.id !== userId
      ).length;

      return {
        id: conv.id,
        user: conv.user,
        recipient: conv.recipient,
        recipientId: conv.recipientId,
        messages: sortedMessages,
        participants: conv.participants,
        totalMessages: sortedMessages.length,
        unreadCount: unreadCount,
        lastMessageAt:
          sortedMessages.length > 0
            ? sortedMessages[sortedMessages.length - 1].createdAt
            : null,
      };
    });

    // Sort conversations by last message
    conversations.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
    });

    return res.json({
      success: true,
      message: 'Conversations retrieved successfully',
      data: conversations,
    });
  } catch (error) {
    console.error('Error fetching all chats:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get user's own conversations (All authenticated users)
 * Returns chats where user is sender or recipient, grouped by date
 */
const getMyConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user?.role?.name;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get all chats where user is sender or recipient
    const chats = await prisma.chat.findMany({
      where: {
        OR: [{ userId: userId }, { recipientId: userId }],
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: { name: true },
            },
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Helper functions for date formatting
    const formatDate = (date) => {
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    };

    const getDateLabel = (date) => {
      const messageDate = new Date(date);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const messageDateStr = formatDate(messageDate);
      const todayStr = formatDate(today);
      const yesterdayStr = formatDate(yesterday);

      if (messageDateStr === todayStr) return 'Today';
      if (messageDateStr === yesterdayStr) return 'Yesterday';

      return messageDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };

    // Group conversations by the other participant
    const conversationsByUser = {};

    chats.forEach((chat) => {
      // Determine the other participant (not current user)
      const isUserSender = chat.userId === userId;
      const otherUserId = isUserSender ? chat.recipientId : chat.userId;
      const otherUser = isUserSender ? chat.recipient : chat.user;

      const convKey = otherUserId || 'general';

      if (!conversationsByUser[convKey]) {
        conversationsByUser[convKey] = {
          id: chat.id,
          recipientId: otherUserId,
          recipient: otherUser || {
            id: null,
            name: 'General Chat',
            email: null,
            role: { name: 'SYSTEM' },
          },
          messagesByDate: {},
        };
      }

      // Add message to appropriate date group
      const dateKey = formatDate(chat.createdAt);
      const dateLabel = getDateLabel(chat.createdAt);

      if (!conversationsByUser[convKey].messagesByDate[dateKey]) {
        conversationsByUser[convKey].messagesByDate[dateKey] = {
          date: dateKey,
          dateLabel: dateLabel,
          messages: [],
        };
      }

      conversationsByUser[convKey].messagesByDate[dateKey].messages.push({
        id: chat.id,
        message: chat.message,
        isFromCurrentUser: isUserSender,
        sender: chat.user,
        recipient: chat.recipient,
        isRead: chat.isRead,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      });
    });

    // Convert to array and sort
    const conversations = Object.values(conversationsByUser).map((conv) => {
      const messagesByDate = Object.values(conv.messagesByDate)
        .map((dateGroup) => ({
          ...dateGroup,
          messages: dateGroup.messages.sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          ),
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      const allMessages = messagesByDate.flatMap((d) => d.messages);
      const lastMessage = allMessages[allMessages.length - 1];
      const unreadCount = allMessages.filter(
        (m) => !m.isRead && !m.isFromCurrentUser
      ).length;

      return {
        id: conv.id,
        recipientId: conv.recipientId,
        recipient: conv.recipient,
        messagesByDate: messagesByDate,
        totalMessages: allMessages.length,
        unreadCount: unreadCount,
        lastMessageAt: lastMessage?.createdAt || null,
        lastMessage: lastMessage?.message || null,
      };
    });

    // Sort by last message time
    conversations.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
    });

    return res.json({
      success: true,
      message: 'My conversations retrieved successfully',
      data: {
        conversations: conversations,
        totalConversations: conversations.length,
      },
    });
  } catch (error) {
    console.error('Error fetching my conversations:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get conversation with a specific user
 * Returns all messages between current user and target user
 */
const getUserConversation = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.user?.id;
    const currentUserRole = req.user?.role?.name;

    if (!currentUserId || !currentUserRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Clean userId if it has prefix
    const cleanTargetUserId = targetUserId.replace('staff-', '');

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: cleanTargetUserId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: {
          select: { name: true },
        },
      },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Authorization check
    if (currentUserRole === 'STAFF' && cleanTargetUserId !== currentUserId) {
      // Staff can only view their own conversations
      return res.status(403).json({
        success: false,
        message: 'Staff can only access their own conversations',
      });
    }

    // Get all messages between these two users
    const messages = await prisma.chat.findMany({
      where: {
        OR: [
          { userId: currentUserId, recipientId: cleanTargetUserId },
          { userId: cleanTargetUserId, recipientId: currentUserId },
        ],
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: { name: true },
            },
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      message: msg.message,
      isFromCurrentUser: msg.userId === currentUserId,
      sender: msg.user,
      recipient: msg.recipient,
      isRead: msg.isRead,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    }));

    return res.json({
      success: true,
      message: 'Conversation retrieved successfully',
      data: {
        user: targetUser,
        messages: formattedMessages,
      },
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Send a new message
 * Creates a new chat message from current user to recipient
 */
const sendMessage = async (req, res) => {
  try {
    const { message, recipientId } = req.body;
    const userId = req.user.id;
    const userRole = req.user?.role?.name;

    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    if (!['STAFF', 'ADMIN', 'MASTER'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only authenticated users can send messages',
      });
    }

    // Verify sender exists
    const sender = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        role: {
          select: { name: true },
        },
      },
    });

    if (!sender) {
      return res.status(404).json({
        success: false,
        message: 'Sender account not found or is inactive',
      });
    }

    // Verify recipient exists if recipientId provided
    let recipient = null;
    if (recipientId) {
      recipient = await prisma.user.findFirst({
        where: {
          id: recipientId,
          deletedAt: null,
        },
        include: {
          role: {
            select: { name: true },
          },
        },
      });

      if (!recipient) {
        return res.status(404).json({
          success: false,
          message: 'Recipient not found or inactive',
        });
      }

      console.log('siapa sender', sender);
      console.log('siapa recipient', recipient);

      // Prevent sending message to yourself
      if (userId === recipientId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot send message to yourself',
        });
      }
    }

    const newChat = await prisma.chat.create({
      data: {
        userId,
        message,
        recipientId: recipient ? recipient.id : null,
        isRead: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: { name: true },
            },
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: { name: true },
            },
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newChat,
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get chat statistics (Master only)
 */
const getChatStats = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role?.name;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (userRole !== 'MASTER') {
      return res.status(403).json({
        success: false,
        message: 'Only master can access chat statistics',
      });
    }

    const totalChats = await prisma.chat.count({
      where: { deletedAt: null },
    });

    const activeUsers = await prisma.chat.groupBy({
      by: ['userId'],
      where: {
        deletedAt: null,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    });

    const recentChats = await prisma.chat.findMany({
      where: { deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recipient: {
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
      message: 'Chat statistics retrieved successfully',
      data: {
        totalChats,
        activeUsersThisWeek: activeUsers.length,
        recentChats,
      },
    });
  } catch (error) {
    console.error('Error fetching chat stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Delete a chat message
 * Soft delete with proper authorization
 */
const deleteMessage = async (req, res) => {
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

    const chat = await prisma.chat.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        user: {
          select: { id: true },
        },
      },
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    // Only the sender or MASTER can delete
    if (chat.user.id !== userId && userRole !== 'MASTER') {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages',
      });
    }

    await prisma.chat.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return res.json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { recipientId: otherUserId } = req.body; // This is the OTHER user's ID (lawan bicara)
    const currentUserId = req.user.id;

    console.log('[markAsRead] Marking messages as read:', {
      chatId,
      otherUserId,
      currentUserId,
    });

    // Validate the other user ID is provided
    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        message: 'recipientId (other user ID) is required',
      });
    }

    // Mark all unread messages FROM the other user TO the current user as read
    // Logic: Messages where sender (userId) is the other user AND recipient is current user
    const result = await prisma.chat.updateMany({
      where: {
        userId: otherUserId,           // Messages SENT BY the other user
        recipientId: currentUserId,    // Messages ADDRESSED TO me (current user)
        isRead: false,                 // Only unread messages
        deletedAt: null,
      },
      data: { isRead: true },
    });

    console.log('[markAsRead] Updated messages count:', result.count);

    return res.json({
      success: true,
      message: `${result.count} messages marked as read`,
      data: {
        chatId,
        otherUserId,
        messagesUpdated: result.count,
        readAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error marking chat as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};


/**
 * Get unread messages count for current user
 */
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user?.role?.name;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const unreadChatsCount = await prisma.chat.count({
      where: {
        deletedAt: null,
        isRead: false,
        recipientId: userId,
      },
    });

    const allBroadcasts = await prisma.broadcast.findMany({
      where: {
        deletedAt: null,
        userId: { not: userId },
      },
      select: { id: true },
    });

    const readBroadcasts = await prisma.broadcastRead.findMany({
      where: {
        userId: userId,
      },
      select: { broadcastId: true },
    });

    const readBroadcastIds = readBroadcasts.map((br) => br.broadcastId);
    const unreadBroadcastsCount = allBroadcasts.filter(
      (b) => !readBroadcastIds.includes(b.id)
    ).length;

    const totalUnreadCount = unreadChatsCount + unreadBroadcastsCount;

    return res.json({
      success: true,
      data: {
        unreadCount: totalUnreadCount,
        unreadChatsCount,
        unreadBroadcastsCount,
      },
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get all users that can be messaged
 */
const getAvailableUsers = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role?.name;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    let whereClause = {
      id: { not: userId }, // Exclude current user
      deletedAt: null,
    };

    // Set available users based on current user role
    if (userRole === 'STAFF') {
      whereClause.role = {
        name: { in: ['ADMIN', 'MASTER'] },
      };
    } else if (userRole === 'ADMIN') {
      whereClause.role = {
        name: { in: ['STAFF', 'ADMIN', 'MASTER'] },
      };
    } else if (userRole === 'MASTER') {
      whereClause.role = {
        name: { in: ['STAFF', 'ADMIN', 'MASTER'] },
      };
    } else {
      return res.status(403).json({
        success: false,
        message: 'Invalid user role',
      });
    }

    const availableUsers = await prisma.user.findMany({
      where: whereClause,
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
      orderBy: [{ role: { name: 'desc' } }, { name: 'asc' }],
    });

    return res.json({
      success: true,
      message: 'Available users retrieved successfully',
      data: availableUsers,
    });
  } catch (error) {
    console.error('Error fetching available users:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Mark all broadcasts as read for current user
 */
const markBroadcastsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get all broadcasts (excluding those created by current user)
    const allBroadcasts = await prisma.broadcast.findMany({
      where: {
        deletedAt: null,
        userId: { not: userId },
      },
      select: { id: true },
    });

    // Get broadcasts already read by user
    const alreadyRead = await prisma.broadcastRead.findMany({
      where: { userId },
      select: { broadcastId: true },
    });

    const alreadyReadIds = alreadyRead.map((br) => br.broadcastId);

    // Find broadcasts that haven't been marked as read yet
    const unreadBroadcasts = allBroadcasts.filter(
      (b) => !alreadyReadIds.includes(b.id)
    );

    // Mark them as read
    if (unreadBroadcasts.length > 0) {
      await prisma.broadcastRead.createMany({
        data: unreadBroadcasts.map((b) => ({
          broadcastId: b.id,
          userId: userId,
        })),
        skipDuplicates: true,
      });
    }

    console.log(`[markBroadcastsAsRead] Marked ${unreadBroadcasts.length} broadcasts as read for user ${userId}`);

    return res.json({
      success: true,
      message: `${unreadBroadcasts.length} broadcasts marked as read`,
      data: {
        markedCount: unreadBroadcasts.length,
      },
    });
  } catch (error) {
    console.error('Error marking broadcasts as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  getAllChats,
  getMyConversations,
  getUserConversation,
  sendMessage,
  getChatStats,
  deleteMessage,
  markAsRead,
  getUnreadCount,
  getAvailableUsers,
  markBroadcastsAsRead,
};
