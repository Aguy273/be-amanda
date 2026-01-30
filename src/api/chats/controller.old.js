const { clouddebugger_v2 } = require('googleapis');
const prisma = require('../../database/db');

/**
 * Get all chats (Admin/Master only)
 * Returns all chat conversations grouped by user in format expected by frontend
 * Perbaikan: Admin sekarang bisa melihat SEMUA chat dari staff, tidak hanya yang mereka balas
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

    let chatsToReturn = [];

    if (userRole === 'MASTER') {
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
          responses: {
            where: { deletedAt: null },
            include: {
              admin: {
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
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Group chats by user
      const groupedChats = {};
      chats.forEach((chat) => {
        const chatUserId = chat.user.id;
        if (!groupedChats[chatUserId]) {
          groupedChats[chatUserId] = {
            user: chat.user,
            messages: [],
          };
        }

        // Add user message
        groupedChats[chatUserId].messages.push({
          id: chat.id,
          message: chat.message,
          isFromUser: true,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        });

        // Add admin responses
        chat.responses.forEach((response) => {
          groupedChats[chatUserId].messages.push({
            id: response.id,
            message: response.message,
            isFromUser: false,
            admin: response.admin,
            createdAt: response.createdAt,
            updatedAt: response.updatedAt,
          });
        });
      });

      // Sort messages in each conversation by date
      Object.keys(groupedChats).forEach((chatUserId) => {
        groupedChats[chatUserId].messages.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
      });

      chatsToReturn = Object.values(groupedChats);
    } else if (userRole === 'ADMIN') {
      // Admin bisa melihat chat dari semua user dengan role yang lebih rendah atau sama
      const whereClause = {
        deletedAt: null,
        user: {
          role: {
            name: { in: ['STAFF', 'ADMIN'] }, // Admin bisa lihat chat STAFF dan ADMIN lain
          },
        },
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
          responses: {
            where: { deletedAt: null },
            include: {
              admin: {
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
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Group chats by user
      const groupedChats = {};
      chats.forEach((chat) => {
        const chatUserId = chat.user.id;
        if (!groupedChats[chatUserId]) {
          groupedChats[chatUserId] = {
            user: chat.user,
            messages: [],
          };
        }

        // Add user message
        groupedChats[chatUserId].messages.push({
          id: chat.id,
          message: chat.message,
          isFromUser: true,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        });

        // Ini memungkinkan admin melihat response dari admin lain
        chat.responses.forEach((response) => {
          groupedChats[chatUserId].messages.push({
            id: response.id,
            message: response.message,
            isFromUser: false,
            admin: response.admin,
            createdAt: response.createdAt,
            updatedAt: response.updatedAt,
          });
        });
      });

      // Sort messages in each conversation by date
      Object.keys(groupedChats).forEach((chatUserId) => {
        groupedChats[chatUserId].messages.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
      });

      chatsToReturn = Object.values(groupedChats);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    return res.json({
      success: true,
      message: 'Chats retrieved successfully',
      data: chatsToReturn,
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get user's own conversations (All authenticated users)
 * Returns chats created by the authenticated user grouped by recipient and date
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

    // Get all chats created by current user with responses
    const userAsSenderChats = await prisma.chat.findMany({
      where: {
        userId: userId,
        deletedAt: null,
      },
      include: {
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
        responses: {
          where: { deletedAt: null },
          include: {
            admin: {
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
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const userAsRecipientChats = await prisma.chat.findMany({
      where: {
        recipientId: userId,
        deletedAt: null,
      },
      include: {
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
        responses: {
          where: { deletedAt: null },
          include: {
            admin: {
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
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log('check user sebagai recipient', userAsRecipientChats);

    // Gabungkan kedua array
    const allChats = [...userAsSenderChats, ...userAsRecipientChats];

    // Helper function to format date as YYYY-MM-DD
    const formatDate = (date) => {
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    };

    // Helper function to check if date is today, yesterday, or return formatted date
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

      // Format: "Monday, Jan 15, 2025"
      return messageDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };

    // Group conversations by recipientId or userId (untuk chat yang diterima)
    const conversationsByRecipient = {};

    allChats.forEach((chat) => {
      // Jika user adalah sender, gunakan recipientId sebagai key
      // Jika user adalah recipient, gunakan userId (pengirim) sebagai key
      let recipientKey;
      let recipientInfo;

      if (chat.userId === userId) {
        recipientKey = chat.recipientId || 'general';
        recipientInfo = chat.recipient || {
          id: null,
          name: 'General Chat',
          email: null,
          role: { name: 'SYSTEM' },
        };
      } else {
        recipientKey = chat.userId;
        recipientInfo = chat.user || {
          id: chat.userId,
          name: 'Unknown User',
          email: null,
          role: { name: 'USER' },
        };
      }

      if (!conversationsByRecipient[recipientKey]) {
        conversationsByRecipient[recipientKey] = {
          id: chat.id,
          isRead: chat.isRead,
          recipientId: recipientKey === 'general' ? null : recipientKey,
          recipient: recipientInfo,
          messagesByDate: {},
        };
      }

      // Collect all messages (chat + responses)
      const allMessages = [];

      // Tentukan apakah pesan ini dari user atau bukan
      const isFromCurrentUser = chat.userId === userId;

      // Add message
      allMessages.push({
        id: chat.id,
        message: chat.message,
        isFromUser: isFromCurrentUser,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        isRead: chat.isRead,
        sender: isFromCurrentUser ? null : chat.user, // Jika dari current user, sender null
      });

      // Add admin responses
      chat.responses.forEach((response) => {
        allMessages.push({
          id: response.id,
          message: response.message,
          isFromUser: false,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt,
          isRead: response.isRead,
          sender: response.admin, // Admin who sent the response
        });
      });

      // Group messages by date
      allMessages.forEach((msg) => {
        const dateKey = formatDate(msg.createdAt);
        const dateLabel = getDateLabel(msg.createdAt);

        if (!conversationsByRecipient[recipientKey].messagesByDate[dateKey]) {
          conversationsByRecipient[recipientKey].messagesByDate[dateKey] = {
            date: dateKey,
            dateLabel: dateLabel,
            messages: [],
          };
        }

        conversationsByRecipient[recipientKey].messagesByDate[
          dateKey
        ].messages.push(msg);
      });
    });

    // Convert to array and sort messages within each date group
    const conversations = Object.values(conversationsByRecipient).map(
      (conv) => {
        const messagesByDate = Object.values(conv.messagesByDate)
          .map((dateGroup) => ({
            ...dateGroup,
            messages: dateGroup.messages.sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            ),
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        console.log('conversation will be send', conv);

        return {
          id: conv.id,
          isRead: conv.isRead,
          recipientId: conv.recipientId,
          recipient: conv.recipient,
          messagesByDate: messagesByDate,
          totalMessages: messagesByDate.reduce(
            (sum, dateGroup) => sum + dateGroup.messages.length,
            0
          ),
          lastMessageAt:
            messagesByDate.length > 0
              ? messagesByDate[messagesByDate.length - 1].messages[
                  messagesByDate[messagesByDate.length - 1].messages.length - 1
                ].createdAt
              : null,
        };
      }
    );

    // Sort conversations by last message time (most recent first)
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
 * Get conversation with a specific user (Admin/Master only)
 * Returns all chat messages for a specific user in format expected by frontend
 * Perbaikan: Admin sekarang bisa melihat semua response dari admin lain juga
 */
const getUserConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    const currentUserRole = req.user?.role?.name;

    const newUserId = userId.replace('staff-', '');

    console.log('userId getUserConversation', newUserId, currentUserId);

    if (!currentUserId || !currentUserRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Authorization check
    if (currentUserRole === 'STAFF' && userId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Staff can only access their own conversations',
      });
    }

    if (currentUserRole === 'ADMIN') {
      // Admin bisa mengakses conversation dengan STAFF dan ADMIN lain
      const targetUser = await prisma.user.findUnique({
        where: { id: newUserId },
        include: {
          role: true,
        },
      });

      console.log('target user nya siapa', targetUser);

      if (!targetUser || !['STAFF', 'ADMIN'].includes(targetUser.role.name)) {
        return res.status(403).json({
          success: false,
          message:
            'Admin can only access conversations with STAFF and other ADMINs',
        });
      }
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get user messages
    const userChats = await prisma.chat.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Ini memungkinkan admin melihat response dari admin lain
    const adminResponses = await prisma.chatResponse.findMany({
      where: {
        deletedAt: null,
        chat: { userId },
      },
      include: {
        admin: {
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
      orderBy: { createdAt: 'asc' },
    });

    // Combine and sort all messages
    const allMessages = [];

    userChats.forEach((chat) => {
      allMessages.push({
        id: chat.id,
        message: chat.message,
        isFromUser: true,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      });
    });

    adminResponses.forEach((response) => {
      allMessages.push({
        id: response.id,
        message: response.message,
        isFromUser: false,
        admin: response.admin,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      });
    });

    allMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return res.json({
      success: true,
      message: 'Conversation retrieved successfully',
      data: {
        user,
        messages: allMessages,
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
 * Send a new chat message (All authenticated users)
 * Creates a new chat message from any authenticated user
 */
const sendMessage = async (req, res) => {
  try {
    const { message, recipientId } = req.body;
    const userId = req.user.id;
    const userRole = req.user?.role?.name;

    console.log('check body ketika mengirim pesan', req.body);

    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // All authenticated users can send messages
    if (!['STAFF', 'ADMIN', 'MASTER'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only authenticated users can send messages',
      });
    }

    // Check if user exists and is active
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    const recipientUser = await prisma.user.findFirst({
      where: {
        id: recipientId,
        deletedAt: null,
      },
      include: {
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log('penerima pesan', recipientUser);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found or account is inactive',
      });
    }

    const newChat = await prisma.chat.create({
      data: {
        userId,
        message,
        recipientId: recipientUser ? recipientUser.id : null,
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

    await prisma.chat.update({
      data: { isRead: false },
      where: { id: newChat.id },
    });

    console.log('newChat sendMessage', newChat);

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
 * Send response to a chat (Admin/Master only)
 * Adds a response to an existing chat conversation
 * Admin manapun sekarang bisa membalas chat staff, tidak harus admin yang sama
 */
const sendResponse = async (req, res) => {
  try {
    const { chatId, message } = req.body;
    const adminId = req.user.id;
    const adminRole = req.user?.role?.name;

    console.log('Admin role:', adminRole, 'Admin ID:', adminId);
    console.log('Chat ID:', chatId, 'Message:', message);

    if (!chatId || !adminId || !message) {
      return res.status(400).json({
        success: false,
        message: 'ChatId and message are required',
      });
    }

    // Only admin and master can send responses
    if (!['ADMIN', 'MASTER'].includes(adminRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin or master can send responses',
      });
    }

    // Check if chat exists
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    // Check if admin exists
    const admin = await prisma.user.findFirst({
      where: {
        id: adminId,
        role: {
          name: { in: ['ADMIN', 'MASTER'] },
        },
        deletedAt: null,
      },
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found or insufficient permissions',
      });
    }

    const response = await prisma.chatResponse.create({
      data: {
        message,
        chatId,
        adminId,
      },
      include: {
        admin: {
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
        chat: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Response sent successfully',
      data: response,
    });
  } catch (error) {
    console.error('Error sending response:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get chat statistics (Master only)
 * Returns statistics in format expected by frontend
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

    // Only master can access full chat statistics
    if (userRole !== 'MASTER') {
      return res.status(403).json({
        success: false,
        message: 'Only master can access chat statistics',
      });
    }

    const totalChats = await prisma.chat.count({
      where: { deletedAt: null },
    });

    const totalResponses = await prisma.chatResponse.count({
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
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return res.json({
      success: true,
      message: 'Chat statistics retrieved successfully',
      data: {
        totalChats,
        totalResponses,
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
 * Delete a chat message (Admin/Master only)
 * Soft delete with proper authorization
 */
const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'chat' or 'response'
    const userId = req.user?.id;
    const userRole = req.user?.role?.name;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (type === 'response') {
      const response = await prisma.chatResponse.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          admin: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!response) {
        return res.status(404).json({
          success: false,
          message: 'Response not found',
        });
      }

      // Only the admin who sent the response or master can delete it
      if (response.admin.id !== userId && userRole !== 'MASTER') {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own responses',
        });
      }

      await prisma.chatResponse.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } else {
      const chat = await prisma.chat.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Chat not found',
        });
      }

      // Only the user who sent the message or master can delete it
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
    }

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

/**
 * Mark chat as read (Update last read timestamp)
 * Helper endpoint for frontend to track read status
 */
const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    console.log('chatId', chatId);
    console.log(userId);

    // Verify chat exists and user has access
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        deletedAt: null,
      },
      include: {
        user: { select: { id: true } },
      },
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    await prisma.chat.update({
      data: {
        isRead: true,
      },
      where: {
        id: chatId,
      },
    });

    console.log('chat has been updated', chat);

    // Authorization check
    const userRole = req.user?.role?.name;
    if (userRole === 'STAFF' && chat.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only mark your own chats as read',
      });
    }

    return res.json({
      success: true,
      message: 'Chat marked as read',
      data: {
        chatId,
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
 * Helper endpoint to show notification badges
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

    let unreadCount = 0;

    const responses = await prisma.chat.findMany({
      where: {
        deletedAt: null,
        isRead: false,
        recipientId: userId,
      },
      include: {
        recipient: true,
      },
    });

    unreadCount = responses.length;

    console.log('get unread count', responses);

    return res.json({
      success: true,
      data: {
        unreadCount,
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
 * Start a conversation with a specific user (All authenticated users)
 * Creates a new chat message directed to a specific user
 */
// const startConversationWith = async (req, res) => {
//   try {
//     const { targetUserId, message } = req.body;
//     const senderId = req.user.id;
//     const senderRole = req.user?.role?.name;

//     if (!targetUserId || !message) {
//       return res.status(400).json({
//         success: false,
//         message: 'Target user ID and message are required',
//       });
//     }

//     if (!senderId || !senderRole) {
//       return res.status(401).json({
//         success: false,
//         message: 'Authentication required',
//       });
//     }

//     // Check if sender exists and is active
//     const sender = await prisma.user.findFirst({
//       where: {
//         id: senderId,
//         deletedAt: null,
//       },
//       include: {
//         role: {
//           select: {
//             name: true,
//           },
//         },
//       },
//     });

//     if (!sender) {
//       return res.status(404).json({
//         success: false,
//         message: 'Sender account not found or is inactive',
//       });
//     }

//     // Check if target user exists and is active
//     const targetUser = await prisma.user.findFirst({
//       where: {
//         id: targetUserId,
//         deletedAt: null,
//       },
//       include: {
//         role: {
//           select: {
//             name: true,
//           },
//         },
//       },
//     });

//     if (!targetUser) {
//       return res.status(404).json({
//         success: false,
//         message: 'Target user not found or account is inactive',
//       });
//     }

//     // Prevent sending message to yourself
//     if (senderId === targetUserId) {
//       return res.status(400).json({
//         success: false,
//         message: 'Cannot start conversation with yourself',
//       });
//     }

//     // Authorization check based on roles
//     if (senderRole === 'STAFF') {
//       // STAFF can message ADMIN and MASTER
//       if (!['ADMIN', 'MASTER'].includes(targetUser.role.name)) {
//         return res.status(403).json({
//           success: false,
//           message: 'STAFF can only message ADMIN or MASTER',
//         });
//       }
//     } else if (senderRole === 'ADMIN') {
//       // ADMIN can message STAFF, other ADMINs, and MASTER
//       if (!['STAFF', 'ADMIN', 'MASTER'].includes(targetUser.role.name)) {
//         return res.status(403).json({
//           success: false,
//           message: 'ADMIN can message STAFF, other ADMINs, or MASTER',
//         });
//       }
//     } else if (senderRole === 'MASTER') {
//       // MASTER can message anyone
//       if (!['STAFF', 'ADMIN', 'MASTER'].includes(targetUser.role.name)) {
//         return res.status(403).json({
//           success: false,
//           message: 'Invalid target user role',
//         });
//       }
//     }

//     // Create the chat message
//     const newChat = await prisma.chat.create({
//       data: {
//         userId: senderId,
//         message: `[To: ${targetUser.name}] ${message}`, // Indicate this is directed to specific user
//       },
//       include: {
//         user: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//             role: {
//               select: {
//                 name: true,
//               },
//             },
//           },
//         },
//       },
//     });

//     return res.status(201).json({
//       success: true,
//       message: `Conversation started with ${targetUser.name}`,
//       data: {
//         chat: newChat,
//         targetUser: {
//           id: targetUser.id,
//           name: targetUser.name,
//           email: targetUser.email,
//           role: targetUser.role,
//         },
//       },
//     });
//   } catch (error) {
//     console.error('Error starting conversation:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined,
//     });
//   }
// };

/**
 * Get all users that can be messaged (Helper endpoint for frontend)
 * Returns list of users based on current user's role
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
      orderBy: [
        { role: { name: 'desc' } }, // MASTER, ADMIN, STAFF
        { name: 'asc' },
      ],
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
 * Start a conversation (SIMPLIFIED - No target user needed!)
 */
const startConversationWith = async (req, res) => {
  try {
    const { message } = req.body; // HANYA message!
    const senderId = req.user.id;
    const senderRole = req.user?.role?.name;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    if (!senderId || !senderRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const sender = await prisma.user.findFirst({
      where: {
        id: senderId,
        deletedAt: null,
      },
      include: {
        role: { select: { name: true } },
      },
    });

    if (!sender) {
      return res.status(404).json({
        success: false,
        message: 'Sender account not found or is inactive',
      });
    }

    if (!['STAFF', 'ADMIN', 'MASTER'].includes(senderRole)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid user role',
      });
    }

    // Create chat - SIMPLE!
    const newChat = await prisma.chat.create({
      data: {
        userId: senderId,
        message: message,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: { select: { name: true } },
          },
        },
      },
    });

    console.log('new chat', newChat);

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newChat,
    });
  } catch (error) {
    console.error('Error starting conversation:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  getAllChats,
  getUserConversation,
  sendMessage,
  startConversationWith,
  sendResponse,
  getChatStats,
  deleteMessage,
  getMyConversations,
  markAsRead,
  getUnreadCount,
  startConversationWith,
  getAvailableUsers,
};
