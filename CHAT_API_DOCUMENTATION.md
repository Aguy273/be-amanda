# Chat API Documentation - WhatsApp-Style Chat System

## 📋 Overview

Sistem chat ini telah dioptimasi untuk bekerja seperti WhatsApp - chat langsung dari orang ke orang tanpa konsep "admin response". Semua pesan disimpan dalam satu table `Chat` dengan struktur peer-to-peer.

## 🏗️ Database Structure

### Table: `chats`

```prisma
model Chat {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")        // Pengirim pesan
  message     String                           // Isi pesan
  recipientId String?  @map("recipient_id")   // Penerima pesan (null = broadcast/general)
  isRead      Boolean  @default(false)        // Status baca
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  user        User     @relation("UserChats", fields: [userId], references: [id])
  recipient   User?    @relation("RecipientChats", fields: [recipientId], references: [id])
}
```

**Key Changes:**

- ✅ Menghapus table `ChatResponse` (tidak diperlukan)
- ✅ Semua pesan ada di satu table `Chat`
- ✅ `userId` = pengirim pesan
- ✅ `recipientId` = penerima pesan (nullable untuk broadcast)
- ✅ `isRead` = status apakah pesan sudah dibaca

## 🚀 API Endpoints

### 1. **Send Message** (CREATE)

**Endpoint:** `POST /api/chats/send`  
**Auth:** Required (STAFF, ADMIN, MASTER)  
**Rate Limit:** 10 pesan per menit

**Request Body:**

```json
{
  "message": "Halo, saya butuh bantuan",
  "recipientId": "clxxxxx" // ID user penerima (optional untuk broadcast)
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "id": "clxxxxx",
    "userId": "clyyyyy",
    "message": "Halo, saya butuh bantuan",
    "recipientId": "clxxxxx",
    "isRead": false,
    "createdAt": "2025-10-22T10:30:00Z",
    "user": {
      "id": "clyyyyy",
      "name": "John Doe",
      "email": "john@example.com",
      "role": { "name": "STAFF" }
    },
    "recipient": {
      "id": "clxxxxx",
      "name": "Admin User",
      "email": "admin@example.com",
      "role": { "name": "ADMIN" }
    }
  }
}
```

**Use Case:**

- STAFF mengirim pesan ke ADMIN/MASTER
- ADMIN mengirim pesan ke STAFF/ADMIN lain/MASTER
- MASTER mengirim pesan ke siapa saja

---

### 2. **Get My Conversations** (READ - User's Chats)

**Endpoint:** `GET /api/chats/my-conversations`  
**Auth:** Required (All authenticated users)

**Response (200):**

```json
{
  "success": true,
  "message": "My conversations retrieved successfully",
  "data": {
    "conversations": [
      {
        "id": "clxxxxx",
        "recipientId": "clyyyyy",
        "recipient": {
          "id": "clyyyyy",
          "name": "Admin User",
          "email": "admin@example.com",
          "role": { "name": "ADMIN" }
        },
        "messagesByDate": [
          {
            "date": "2025-10-22",
            "dateLabel": "Today",
            "messages": [
              {
                "id": "msg1",
                "message": "Halo",
                "isFromCurrentUser": true,
                "sender": {...},
                "recipient": {...},
                "isRead": true,
                "createdAt": "2025-10-22T09:00:00Z"
              },
              {
                "id": "msg2",
                "message": "Halo juga, ada yang bisa dibantu?",
                "isFromCurrentUser": false,
                "sender": {...},
                "recipient": {...},
                "isRead": true,
                "createdAt": "2025-10-22T09:05:00Z"
              }
            ]
          }
        ],
        "totalMessages": 2,
        "unreadCount": 0,
        "lastMessageAt": "2025-10-22T09:05:00Z",
        "lastMessage": "Halo juga, ada yang bisa dibantu?"
      }
    ],
    "totalConversations": 1
  }
}
```

**Use Case:**

- User melihat daftar semua percakapannya
- Dikelompokkan per lawan bicara
- Messages dikelompokkan per tanggal dengan label (Today, Yesterday, atau tanggal lengkap)
- Menampilkan unread count per conversation

---

### 3. **Get User Conversation** (READ - Specific Conversation)

**Endpoint:** `GET /api/chats/user/:userId`  
**Auth:** Required (ADMIN, MASTER, atau STAFF untuk chat sendiri)

**Response (200):**

```json
{
  "success": true,
  "message": "Conversation retrieved successfully",
  "data": {
    "user": {
      "id": "clxxxxx",
      "name": "Staff User",
      "email": "staff@example.com",
      "role": { "name": "STAFF" }
    },
    "messages": [
      {
        "id": "msg1",
        "message": "Halo, butuh bantuan",
        "isFromCurrentUser": false,
        "sender": {...},
        "recipient": {...},
        "isRead": true,
        "createdAt": "2025-10-22T09:00:00Z"
      },
      {
        "id": "msg2",
        "message": "Siap, silakan",
        "isFromCurrentUser": true,
        "sender": {...},
        "recipient": {...},
        "isRead": false,
        "createdAt": "2025-10-22T09:05:00Z"
      }
    ]
  }
}
```

**Use Case:**

- Melihat detail percakapan dengan user tertentu
- All messages antara current user dan target user
- Urut berdasarkan waktu (ascending)

---

### 4. **Get All Chats** (READ - Admin/Master Only)

**Endpoint:** `GET /api/chats?search=keyword`  
**Auth:** Required (ADMIN, MASTER)

**Query Parameters:**

- `search` (optional): Search keyword untuk filter pesan

**Response (200):**

```json
{
  "success": true,
  "message": "Conversations retrieved successfully",
  "data": [
    {
      "participants": [
        {
          "id": "user1",
          "name": "John Doe",
          "email": "john@example.com",
          "role": { "name": "STAFF" }
        },
        {
          "id": "user2",
          "name": "Admin User",
          "email": "admin@example.com",
          "role": { "name": "ADMIN" }
        }
      ],
      "messages": [...],
      "totalMessages": 15,
      "lastMessageAt": "2025-10-22T09:05:00Z"
    }
  ]
}
```

**Use Case:**

- Admin/Master melihat semua percakapan di sistem
- Untuk monitoring dan oversight
- Dikelompokkan per pasangan conversation

---

### 5. **Mark as Read** (UPDATE)

**Endpoint:** `PUT /api/chats/:chatId/read`  
**Auth:** Required (Recipient only)

**Response (200):**

```json
{
  "success": true,
  "message": "Chat marked as read",
  "data": {
    "chatId": "clxxxxx",
    "readAt": "2025-10-22T10:30:00Z"
  }
}
```

**Use Case:**

- Penerima pesan menandai pesan sebagai sudah dibaca
- Hanya recipient yang bisa mark as read
- Update `isRead` menjadi `true`

---

### 6. **Get Unread Count** (READ)

**Endpoint:** `GET /api/chats/unread/count`  
**Auth:** Required (All authenticated users)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

**Use Case:**

- Menampilkan badge/notification unread messages
- Count pesan yang `isRead = false` dan `recipientId = currentUserId`

---

### 7. **Delete Message** (DELETE - Soft Delete)

**Endpoint:** `DELETE /api/chats/:id`  
**Auth:** Required (Message sender atau MASTER)

**Response (200):**

```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

**Use Case:**

- User hanya bisa delete pesan yang dia kirim sendiri
- MASTER bisa delete semua pesan
- Soft delete (set `deletedAt`)

---

### 8. **Get Available Users** (READ - Helper)

**Endpoint:** `GET /api/chats/available-users`  
**Auth:** Required (STAFF, ADMIN, MASTER)

**Response (200):**

```json
{
  "success": true,
  "message": "Available users retrieved successfully",
  "data": [
    {
      "id": "clxxxxx",
      "name": "Admin User",
      "email": "admin@example.com",
      "role": { "name": "ADMIN" }
    },
    {
      "id": "clyyyyy",
      "name": "Master User",
      "email": "master@example.com",
      "role": { "name": "MASTER" }
    }
  ]
}
```

**Use Case:**

- Get list users yang bisa dikirimi pesan
- STAFF: bisa kirim ke ADMIN & MASTER
- ADMIN: bisa kirim ke STAFF, ADMIN lain, & MASTER
- MASTER: bisa kirim ke semua

---

### 9. **Get Chat Statistics** (READ - Master Only)

**Endpoint:** `GET /api/chats/stats`  
**Auth:** Required (MASTER only)

**Response (200):**

```json
{
  "success": true,
  "message": "Chat statistics retrieved successfully",
  "data": {
    "totalChats": 150,
    "activeUsersThisWeek": 25,
    "recentChats": [...]
  }
}
```

**Use Case:**

- Dashboard statistics untuk MASTER
- Monitoring aktivitas chat

---

## 🔐 Authorization Matrix

| Role   | Send Message | View Own Chats | View All Chats | Delete Own | Delete All | Stats |
| ------ | ------------ | -------------- | -------------- | ---------- | ---------- | ----- |
| STAFF  | ✅           | ✅             | ❌             | ✅         | ❌         | ❌    |
| ADMIN  | ✅           | ✅             | ✅             | ✅         | ❌         | ❌    |
| MASTER | ✅           | ✅             | ✅             | ✅         | ✅         | ✅    |

## 🎯 Optimal Usage Patterns

### Pattern 1: Sending a Message

```javascript
// Frontend example
const sendMessage = async (recipientId, message) => {
  const response = await fetch('/api/chats/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: message,
      recipientId: recipientId,
    }),
  });
  return response.json();
};
```

### Pattern 2: Real-time Chat Loading

```javascript
// Load conversations on mount
useEffect(() => {
  loadMyConversations();

  // Poll for new messages every 3 seconds
  const interval = setInterval(() => {
    loadUnreadCount();
  }, 3000);

  return () => clearInterval(interval);
}, []);

// Load specific conversation
const loadConversation = async (userId) => {
  const response = await fetch(`/api/chats/user/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
};
```

### Pattern 3: Mark Messages as Read

```javascript
// When user opens a conversation
const openConversation = async (chatId) => {
  // Load messages
  await loadConversation(recipientId);

  // Mark unread messages as read
  const unreadMessages = messages.filter(
    (m) => !m.isRead && !m.isFromCurrentUser
  );
  for (const msg of unreadMessages) {
    await fetch(`/api/chats/${msg.id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
};
```

## 🔄 Migration Notes

### Perubahan dari Sistem Lama:

1. **Table `chat_responses` dihapus** - Tidak lagi diperlukan
2. **Endpoint `/api/chats/response` dihapus** - Gunakan `/api/chats/send` untuk semua pesan
3. **Field `adminId` tidak ada lagi** - Semua user mengirim dengan cara yang sama
4. **Konsep "response" dihilangkan** - Semua adalah pesan biasa dari user ke user

### Migration SQL (Already Applied):

```sql
-- Drop table chat_responses
DROP TABLE IF EXISTS "chat_responses";

-- Chat table already has recipientId and isRead columns
-- No additional changes needed
```

## 📝 Best Practices

1. **Always validate recipientId** - Pastikan recipient exists sebelum send
2. **Use rate limiting** - Prevent spam (10 messages/minute)
3. **Implement real-time** - Gunakan WebSocket atau polling untuk real-time updates
4. **Soft delete only** - Jangan hard delete untuk audit trail
5. **Index optimization** - Add indexes pada `userId`, `recipientId`, `isRead` untuk performa

## ⚠️ Important Notes

- Pesan dengan `recipientId = null` adalah broadcast/general chat
- `isRead` hanya bisa diubah oleh recipient
- Soft delete menggunakan `deletedAt` field
- All timestamps dalam UTC (ISO 8601 format)
- Rate limiting: 10 pesan per menit per user

## 🛠️ Testing Endpoints

```bash
# Send message
curl -X POST http://localhost:3000/api/chats/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "recipientId": "clxxxxx"}'

# Get my conversations
curl -X GET http://localhost:3000/api/chats/my-conversations \
  -H "Authorization: Bearer YOUR_TOKEN"

# Mark as read
curl -X PUT http://localhost:3000/api/chats/clxxxxx/read \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get unread count
curl -X GET http://localhost:3000/api/chats/unread/count \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

**Last Updated:** October 22, 2025  
**Version:** 2.0 (WhatsApp-Style Chat System)
