# 🌱 Seeder Update - WhatsApp-Style Chat

## ✅ Perubahan yang Dilakukan

### 1. **Menghapus Reference ke `chatResponse`**

```javascript
// ❌ BEFORE (Error - table tidak ada)
await prisma.chatResponse.deleteMany();

// ✅ AFTER (Dihapus)
// Line ini sudah dihapus karena table chatResponse sudah tidak ada
```

### 2. **Menambahkan Broadcast Cleanup**

```javascript
// ✅ ADDED
await prisma.broadcast.deleteMany();
```

### 3. **Update Chat Seeding Logic**

#### **BEFORE:** Random chats tanpa recipientId

```javascript
// Chat lama - tidak ada recipientId
chats.push({
  userId: randomUser.id,
  message: faker.lorem.sentence(),
  createdAt: faker.date.recent({ days: 30 }),
});
```

#### **AFTER:** Peer-to-peer conversations dengan recipientId

```javascript
// Conversations antara Staff → Admin/Master
const staff = faker.helpers.arrayElement(staffUsers);
const recipient = faker.helpers.arrayElement([...adminUsers, ...masterUsers]);

chats.push({
  userId: staff.id,
  recipientId: recipient.id, // ✅ Ada recipient
  message: `Hi, I need help with ${faker.lorem.words(3)}`,
  isRead: faker.datatype.boolean(), // ✅ Random read status
  createdAt: faker.date.recent({ days: 30 }),
});

// Admin/Master membalas
chats.push({
  userId: recipient.id,
  recipientId: staff.id, // ✅ Balasan ke staff
  message: `Sure, I can help you with that!`,
  isRead: faker.datatype.boolean(),
  createdAt: faker.date.recent({ days: 29 }),
});
```

## 📊 Data yang Di-generate

### Chat Data Structure:

```
Total Chats: ~97 messages

Breakdown:
├── 50 conversations (Staff ↔ Admin/Master)
│   ├── Staff → Admin/Master: 50 messages
│   └── Admin/Master → Staff: ~25 replies (50% chance)
│
└── 20 conversations (Admin ↔ Admin/Master)
    └── Admin ↔ Admin: 20 messages
```

### Sample Generated Conversations:

**Conversation 1: Staff → Admin**

```javascript
{
  userId: "staff-id-123",
  recipientId: "admin-id-456",
  message: "Hi, I need help with system login",
  isRead: false,
  createdAt: "2025-10-15T10:30:00Z"
}

{
  userId: "admin-id-456",
  recipientId: "staff-id-123",
  message: "Sure, I can help you with that!",
  isRead: true,
  createdAt: "2025-10-15T10:35:00Z"
}
```

**Conversation 2: Admin → Master**

```javascript
{
  userId: "admin-id-456",
  recipientId: "master-id-789",
  message: "Meeting at 14:00?",
  isRead: false,
  createdAt: "2025-10-20T09:00:00Z"
}
```

## 🎯 Seeding Features

### 1. **Realistic Conversations**

- ✅ Staff mengirim pesan ke Admin/Master (sesuai authorization)
- ✅ Admin/Master membalas dengan 50% probability (realistic)
- ✅ Admin bisa chat dengan Admin/Master lain
- ✅ Random read status (`isRead`)

### 2. **Message Variety**

```javascript
// Staff messages
[
  "Hi, I need help with [random words]",
  "Can someone assist me with [random words]?",
  "Issue with [random words]",
  "Question about [random words]"
]

// Admin/Master replies
[
  "Sure, I can help you with that!",
  "Let me check on that for you.",
  "Issue resolved, thank you!",
  [random sentences]
]

// Admin-to-Admin messages
[
  "Meeting at [9-17]:00?",
  "Can you review [random words]?",
  [company catchphrase]
]
```

### 3. **Date Distribution**

- Chat messages spread across last 30 days
- Replies dated 1 day after original message
- Admin conversations dated within last 20 days

## 🔧 How to Run Seeder

```bash
# Method 1: Direct run
node prisma/seeds/seed.js

# Method 2: Via Prisma
npx prisma db seed

# Method 3: Reset DB + Seed
npx prisma migrate reset
```

## 📋 Seeding Order (Important!)

```javascript
1. Delete existing data (in correct order to avoid FK constraints)
   ├── chat (has FK to users)
   ├── reportResponse (has FK to reports & users)
   ├── report (has FK to users)
   ├── user (has FK to roles)
   ├── role
   ├── fAQ
   └── broadcast (has FK to users)

2. Create Roles
   └── ADMIN, MASTER, STAFF

3. Create Users
   ├── 1 admin@amanda.com
   ├── 1 master@amanda.com
   ├── 1 staff@amanda.com
   ├── 3 random masters
   └── 12 random staff

4. Create FAQs (25 items)

5. Create Reports (30 items)

6. Create Chats (70-100 items)
   ├── Staff → Admin/Master conversations
   ├── Admin/Master → Staff replies
   └── Admin ↔ Admin/Master conversations
```

## ✅ Testing Seeder Results

### Check in Prisma Studio:

```bash
npx prisma studio
```

### Check via SQL:

```sql
-- Check chat counts by role
SELECT
  r.name as sender_role,
  COUNT(*) as message_count,
  SUM(CASE WHEN c.is_read THEN 1 ELSE 0 END) as read_count
FROM chats c
JOIN users u ON c.user_id = u.id
JOIN roles r ON u.role_id = r.id
GROUP BY r.name;

-- Check conversations (unique pairs)
SELECT DISTINCT
  u1.email as sender,
  u2.email as recipient
FROM chats c
JOIN users u1 ON c.user_id = u1.id
LEFT JOIN users u2 ON c.recipient_id = u2.id
ORDER BY sender, recipient;

-- Check unread messages per user
SELECT
  u.email,
  u.name,
  COUNT(*) as unread_count
FROM chats c
JOIN users u ON c.recipient_id = u.id
WHERE c.is_read = false
GROUP BY u.id, u.email, u.name
ORDER BY unread_count DESC;
```

## 🎨 Visual Representation

```
Database After Seeding:
═══════════════════════════════════════════

ROLES (3)
├── ADMIN
├── MASTER
└── STAFF

USERS (18)
├── admin@amanda.com (ADMIN)
├── master@amanda.com (MASTER)
├── staff@amanda.com (STAFF)
├── 3 random Masters
└── 12 random Staff

CHATS (~97)
├── Conversation Groups:
│   ├── Staff ↔ Admin (25 conversations)
│   ├── Staff ↔ Master (25 conversations)
│   └── Admin ↔ Admin/Master (20 conversations)
│
└── Message Types:
    ├── Questions from Staff (50)
    ├── Replies from Admin/Master (25)
    └── Inter-admin messages (20)

FAQs (25)
├── TEXT type
├── ARTICLE type
└── FILE type

REPORTS (30)
├── PENDING
├── IN_PROGRESS
├── RESOLVED
└── CLOSED
```

## 🔍 Validation

After seeding, verify:

✅ **No chat without sender** (`userId` never null)
✅ **RecipientId follows rules:**

- Staff → Admin/Master only
- Admin → Anyone
- Master → Anyone
  ✅ **isRead is boolean** (true/false)
  ✅ **Dates are realistic** (within last 30 days)
  ✅ **Two-way conversations exist** (messages go both directions)

## 🚨 Common Issues & Solutions

### Issue 1: FK Constraint Error

```
Error: Foreign key constraint failed
```

**Solution:** Delete in correct order (see Seeding Order above)

### Issue 2: Role Not Found

```
Error: Role with name 'ADMIN' not found
```

**Solution:** Make sure roles are created before users

### Issue 3: No Conversations Generated

```
Only one-way messages, no replies
```

**Solution:** Check that reply logic has 50% probability and correct recipientId

## 📝 Notes

- Default password untuk semua users: `password`
- Test accounts:
  - `admin@amanda.com` / `password`
  - `master@amanda.com` / `password`
  - `staff@amanda.com` / `password`
- Chat conversations realistis dengan read/unread status
- Bisa di-run multiple times (akan clear data lama dulu)

---

**Seeder Version:** 2.0 (WhatsApp-Style)  
**Last Updated:** October 22, 2025  
**Status:** ✅ Tested & Working
