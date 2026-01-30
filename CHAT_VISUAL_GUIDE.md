# Chat System Architecture - Visual Guide

## 📊 Database Structure

```
┌─────────────────────────────────────────────────┐
│                  CHATS TABLE                     │
├────────────┬──────────────┬─────────────────────┤
│ id         │ userId       │ recipientId         │
│ (cuid)     │ (sender)     │ (receiver)          │
├────────────┼──────────────┼─────────────────────┤
│ message    │ isRead       │ createdAt           │
│ (text)     │ (boolean)    │ (timestamp)         │
└────────────┴──────────────┴─────────────────────┘
         │              │
         │              │
         ▼              ▼
    ┌─────────┐    ┌─────────┐
    │  User   │    │  User   │
    │ (sender)│    │(recipient)│
    └─────────┘    └─────────┘
```

## 🔄 Message Flow

### Scenario: Staff mengirim pesan ke Admin

```
┌──────────┐                              ┌──────────┐
│  STAFF   │                              │  ADMIN   │
│ (User A) │                              │ (User B) │
└────┬─────┘                              └─────┬────┘
     │                                          │
     │ 1. POST /api/chats/send                 │
     │    { message: "Help",                   │
     │      recipientId: "B" }                 │
     │                                          │
     ├─────────────────────────────────────────▶│
     │                                          │
     │    Chat Record Created:                 │
     │    - userId: A                          │
     │    - recipientId: B                     │
     │    - isRead: false                      │
     │                                          │
     │                                          │ 2. GET /api/chats/my-conversations
     │                                          │    (sees unreadCount: 1)
     │                                          │
     │                                          │ 3. GET /api/chats/user/A
     │                                          │    (loads conversation)
     │                                          │
     │                                          │ 4. PUT /api/chats/{id}/read
     │                                          │    (mark as read)
     │                                          │
     │ 5. Admin replies:                       │
     │    POST /api/chats/send                 │
     │    { message: "How can I help?",        │
     │      recipientId: "A" }                 │
     │                                          │
     │◀─────────────────────────────────────────┤
     │                                          │
     │    New Chat Record:                     │
     │    - userId: B                          │
     │    - recipientId: A                     │
     │    - isRead: false                      │
     │                                          │
     │ 6. GET /api/chats/unread/count          │
     │    → { unreadCount: 1 }                 │
     │                                          │
```

## 🗂️ Conversation Grouping

### My Conversations Structure:

```
GET /api/chats/my-conversations

┌─────────────────────────────────────────────────┐
│            Conversation with Admin              │
├─────────────────────────────────────────────────┤
│  📅 Today                                       │
│  ┌──────────────────────────────────────────┐  │
│  │ 09:00 - Staff: "Help needed"          ✓ │  │
│  │ 09:05 - Admin: "How can I help?"      ✓ │  │
│  │ 09:10 - Staff: "Issue with login"     ✓ │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  📅 Yesterday                                   │
│  ┌──────────────────────────────────────────┐  │
│  │ 14:20 - Admin: "All fixed now"        ✓ │  │
│  │ 14:25 - Staff: "Thanks!"              ✓ │  │
│  └──────────────────────────────────────────┘  │
├─────────────────────────────────────────────────┤
│  Total: 5 messages | Unread: 0                 │
│  Last: Yesterday 14:25                          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│           Conversation with Master              │
├─────────────────────────────────────────────────┤
│  📅 Monday, Oct 21, 2025                        │
│  ┌──────────────────────────────────────────┐  │
│  │ 10:00 - Master: "Check this out"        │  │ ← Unread
│  └──────────────────────────────────────────┘  │
├─────────────────────────────────────────────────┤
│  Total: 1 message | Unread: 1 🔴               │
│  Last: Monday, Oct 21                           │
└─────────────────────────────────────────────────┘
```

## 🔐 Authorization Matrix

```
┌──────────┬──────────┬──────────┬──────────┐
│   Role   │  STAFF   │  ADMIN   │  MASTER  │
├──────────┼──────────┼──────────┼──────────┤
│  STAFF   │    ❌    │    ✅    │    ✅    │
│  can     │  Cannot  │  Can     │  Can     │
│ message: │  message │  message │  message │
│          │  other   │  staff   │  staff   │
│          │  staff   │          │          │
├──────────┼──────────┼──────────┼──────────┤
│  ADMIN   │    ✅    │    ✅    │    ✅    │
│  can     │  Can     │  Can     │  Can     │
│ message: │  message │  message │  message │
│          │  staff   │  other   │  master  │
│          │          │  admin   │          │
├──────────┼──────────┼──────────┼──────────┤
│  MASTER  │    ✅    │    ✅    │    ✅    │
│  can     │  Full    │  Full    │  Full    │
│ message: │  access  │  access  │  access  │
└──────────┴──────────┴──────────┴──────────┘
```

## 📱 Frontend Integration Example

### React Component Structure:

```jsx
<ChatApp>
  ├── <ConversationList>
  │   ├── <ConversationItem user="Admin" unread={2} />
  │   ├── <ConversationItem user="Master" unread={0} />
  │   └── <ConversationItem user="Staff 2" unread={1} />
  │
  └── <ChatWindow>
      ├── <ChatHeader user="Admin" />
      ├── <MessageList>
      │   ├── <DateSeparator date="Today" />
      │   ├── <MessageBubble from="me" text="Hello" />
      │   ├── <MessageBubble from="them" text="Hi!" />
      │   └── <DateSeparator date="Yesterday" />
      └── <MessageInput onSend={sendMessage} />
</ChatApp>
```

### State Management:

```javascript
// Global State
{
  conversations: [
    {
      id: "conv1",
      recipient: { id, name, email, role },
      lastMessage: "How can I help?",
      lastMessageAt: "2025-10-22T09:05:00Z",
      unreadCount: 2,
      messagesByDate: [
        {
          date: "2025-10-22",
          dateLabel: "Today",
          messages: [...]
        }
      ]
    }
  ],

  currentConversation: "conv1",
  unreadCount: 5,
  availableUsers: [...]
}
```

## 🔄 Real-time Updates (Recommended)

### Polling Approach:

```
Every 3 seconds:
  │
  ├─▶ GET /api/chats/unread/count
  │   └─▶ Update badge count
  │
  └─▶ If conversation is open:
      └─▶ GET /api/chats/user/:userId
          └─▶ Check for new messages
```

### WebSocket Approach (Future):

```
Client connects to WS server
  │
  ├─▶ On new message from server:
  │   ├─▶ Update conversation list
  │   ├─▶ Increment unread count
  │   └─▶ Show notification
  │
  ├─▶ On message read:
  │   └─▶ Update read status ✓✓
  │
  └─▶ On user typing:
      └─▶ Show typing indicator...
```

## 📊 API Call Sequence

### Opening Chat Application:

```
1. Initial Load
   ├─▶ GET /api/chats/my-conversations
   │   └─▶ Load all conversations with unread counts
   │
   └─▶ GET /api/chats/available-users
       └─▶ Load users to start new chat

2. Opening a Conversation
   ├─▶ GET /api/chats/user/:userId
   │   └─▶ Load all messages with that user
   │
   └─▶ PUT /api/chats/:id/read (for each unread)
       └─▶ Mark messages as read

3. Sending Message
   └─▶ POST /api/chats/send
       ├─▶ Success: Update UI with new message
       └─▶ Error: Show error notification

4. Background Polling (Every 3s)
   └─▶ GET /api/chats/unread/count
       └─▶ Update notification badge
```

## 🎨 UI States

```
┌─────────────────────────────────────────┐
│  Chat List                         [+]  │ ← New Chat Button
├─────────────────────────────────────────┤
│  🟢 Admin User              ⏰ 09:05   │
│  "How can I help?"              [2] 🔴 │ ← Unread badge
├─────────────────────────────────────────┤
│  🔴 Master User             ⏰ 14:30   │
│  "Check this document"          [1] 🔴 │
├─────────────────────────────────────────┤
│  ⚪ Staff 2                 ⏰ Yesterday│
│  "Thanks for the help!"         ✓✓     │ ← Read status
└─────────────────────────────────────────┘

Legend:
🟢 = Online
🔴 = Offline
⚪ = Inactive
[2] = Unread count
✓ = Sent
✓✓ = Read
```

## 🔒 Security Flow

```
Request → Rate Limiter → JWT Auth → Role Check → Handler
  │            │            │           │           │
  ▼            ▼            ▼           ▼           ▼
Block if    Block if    Block if    Block if    Process
> 10/min    no token    invalid     no access   request
```

## 💾 Database Queries

### Most Common Queries:

```sql
-- Get my conversations
SELECT * FROM chats
WHERE (user_id = $1 OR recipient_id = $1)
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- Get unread count
SELECT COUNT(*) FROM chats
WHERE recipient_id = $1
  AND is_read = false
  AND deleted_at IS NULL;

-- Get conversation with user
SELECT * FROM chats
WHERE ((user_id = $1 AND recipient_id = $2)
   OR (user_id = $2 AND recipient_id = $1))
  AND deleted_at IS NULL
ORDER BY created_at ASC;
```

### Recommended Indexes:

```sql
CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_recipient_id ON chats(recipient_id);
CREATE INDEX idx_chats_is_read ON chats(is_read);
CREATE INDEX idx_chats_created_at ON chats(created_at DESC);
CREATE INDEX idx_chats_deleted_at ON chats(deleted_at);

-- Composite index for unread messages
CREATE INDEX idx_chats_recipient_unread
ON chats(recipient_id, is_read, deleted_at);
```

---

**Visual Guide Version:** 1.0  
**Last Updated:** October 22, 2025
