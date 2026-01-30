# Notification API Documentation

API endpoints untuk mengelola notifikasi dalam sistem Amanda Helpdesk.

## Base URL

```
/api/notifications
```

## Authentication

Semua endpoint memerlukan authentication token di header:

```
Authorization: Bearer <token>
```

---

## Endpoints

### 1. Get My Notifications

Mendapatkan daftar notifikasi untuk user yang sedang login.

**Endpoint:** `GET /api/notifications`

**Authorization:** All authenticated users (STAFF, ADMIN, MASTER)

**Query Parameters:**

- `limit` (optional, default: 20) - Jumlah notifikasi per halaman
- `offset` (optional, default: 0) - Offset untuk pagination
- `unreadOnly` (optional, default: false) - Jika true, hanya tampilkan notifikasi yang belum dibaca

**Response Success (200):**

```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": {
    "notifications": [
      {
        "id": "cm2nvw3q80000qxje6jq7z8v9",
        "title": "Welcome to Amanda Helpdesk",
        "message": "Welcome! You can now submit reports and chat with admins for assistance.",
        "userId": "user-123",
        "isRead": false,
        "createdAt": "2025-10-20T10:30:00.000Z",
        "updatedAt": "2025-10-20T10:30:00.000Z",
        "deletedAt": null
      }
    ],
    "totalCount": 15,
    "unreadCount": 5,
    "currentPage": 1,
    "totalPages": 1
  }
}
```

---

### 2. Get Unread Count

Mendapatkan jumlah notifikasi yang belum dibaca.

**Endpoint:** `GET /api/notifications/unread/count`

**Authorization:** All authenticated users (STAFF, ADMIN, MASTER)

**Response Success (200):**

```json
{
  "success": true,
  "message": "Unread count retrieved successfully",
  "data": {
    "unreadCount": 5
  }
}
```

---

### 3. Mark Notification as Read

Menandai satu notifikasi sebagai sudah dibaca.

**Endpoint:** `PUT /api/notifications/:id/read`

**Authorization:** All authenticated users (STAFF, ADMIN, MASTER)

**URL Parameters:**

- `id` - ID notifikasi

**Response Success (200):**

```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "id": "cm2nvw3q80000qxje6jq7z8v9",
    "title": "Welcome to Amanda Helpdesk",
    "message": "Welcome! You can now submit reports and chat with admins for assistance.",
    "userId": "user-123",
    "isRead": true,
    "createdAt": "2025-10-20T10:30:00.000Z",
    "updatedAt": "2025-10-22T14:30:00.000Z",
    "deletedAt": null
  }
}
```

**Response Error (404):**

```json
{
  "success": false,
  "message": "Notification not found"
}
```

---

### 4. Mark All Notifications as Read

Menandai semua notifikasi user sebagai sudah dibaca.

**Endpoint:** `PUT /api/notifications/read-all`

**Authorization:** All authenticated users (STAFF, ADMIN, MASTER)

**Response Success (200):**

```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "updatedCount": 5
  }
}
```

---

### 5. Create Notification

Membuat notifikasi baru untuk user tertentu (Admin/Master only).

**Endpoint:** `POST /api/notifications`

**Authorization:** ADMIN, MASTER

**Request Body:**

```json
{
  "title": "Report Status Updated",
  "message": "Your report #123 has been updated to IN_PROGRESS status.",
  "userId": "user-123"
}
```

**Response Success (201):**

```json
{
  "success": true,
  "message": "Notification created successfully",
  "data": {
    "id": "cm2nvw3q80000qxje6jq7z8v9",
    "title": "Report Status Updated",
    "message": "Your report #123 has been updated to IN_PROGRESS status.",
    "userId": "user-123",
    "isRead": false,
    "createdAt": "2025-10-22T14:30:00.000Z",
    "updatedAt": "2025-10-22T14:30:00.000Z",
    "deletedAt": null
  }
}
```

**Response Error (400):**

```json
{
  "success": false,
  "message": "Title, message, and userId are required"
}
```

**Response Error (404):**

```json
{
  "success": false,
  "message": "Target user not found"
}
```

---

### 6. Create Broadcast Notification

Mengirim notifikasi ke semua user atau user dengan role tertentu (Master only).

**Endpoint:** `POST /api/notifications/broadcast`

**Authorization:** MASTER only

**Request Body:**

```json
{
  "title": "System Maintenance",
  "message": "System maintenance is scheduled for this weekend from 10 PM to 6 AM.",
  "roleFilter": ["STAFF", "ADMIN"] // Optional: jika tidak disertakan, broadcast ke semua user
}
```

**Response Success (201):**

```json
{
  "success": true,
  "message": "Broadcast notification sent successfully",
  "data": {
    "recipientCount": 15
  }
}
```

**Response Error (400):**

```json
{
  "success": false,
  "message": "Title and message are required"
}
```

---

### 7. Delete Notification

Menghapus notifikasi (soft delete).

**Endpoint:** `DELETE /api/notifications/:id`

**Authorization:** Owner or MASTER

**URL Parameters:**

- `id` - ID notifikasi

**Response Success (200):**

```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

**Response Error (404):**

```json
{
  "success": false,
  "message": "Notification not found"
}
```

**Response Error (403):**

```json
{
  "success": false,
  "message": "You can only delete your own notifications"
}
```

---

### 8. Get Notification Statistics

Mendapatkan statistik notifikasi (Master only).

**Endpoint:** `GET /api/notifications/stats`

**Authorization:** MASTER only

**Response Success (200):**

```json
{
  "success": true,
  "message": "Notification statistics retrieved successfully",
  "data": {
    "totalNotifications": 150,
    "unreadNotifications": 45,
    "notificationsToday": 12,
    "recentNotifications": [
      {
        "id": "cm2nvw3q80000qxje6jq7z8v9",
        "title": "New Report",
        "message": "A new report has been submitted.",
        "userId": "user-123",
        "isRead": false,
        "createdAt": "2025-10-22T14:30:00.000Z",
        "updatedAt": "2025-10-22T14:30:00.000Z",
        "deletedAt": null,
        "user": {
          "id": "user-123",
          "name": "John Doe",
          "email": "john@example.com",
          "role": {
            "name": "STAFF"
          }
        }
      }
    ]
  }
}
```

---

## Role-based Access Control

| Endpoint                        | STAFF | ADMIN      | MASTER |
| ------------------------------- | ----- | ---------- | ------ |
| GET /notifications              | ✅    | ✅         | ✅     |
| GET /notifications/unread/count | ✅    | ✅         | ✅     |
| PUT /notifications/:id/read     | ✅    | ✅         | ✅     |
| PUT /notifications/read-all     | ✅    | ✅         | ✅     |
| POST /notifications             | ❌    | ✅         | ✅     |
| POST /notifications/broadcast   | ❌    | ❌         | ✅     |
| DELETE /notifications/:id       | Owner | Owner + ✅ | ✅     |
| GET /notifications/stats        | ❌    | ❌         | ✅     |

---

## Rate Limiting

- Semua endpoint notifications memiliki rate limit: **30 requests per menit**
- Jika melebihi limit, akan mendapat response:

```json
{
  "success": false,
  "message": "Too many requests"
}
```

---

## Error Codes

| Status Code | Description                             |
| ----------- | --------------------------------------- |
| 200         | Success                                 |
| 201         | Created                                 |
| 400         | Bad Request - Invalid input             |
| 401         | Unauthorized - Authentication required  |
| 403         | Forbidden - Insufficient permissions    |
| 404         | Not Found - Resource not found          |
| 429         | Too Many Requests - Rate limit exceeded |
| 500         | Internal Server Error                   |

---

## Use Cases

### 1. Display Notification Badge

```javascript
// Get unread count untuk notification badge
GET / api / notifications / unread / count;

// Response: { unreadCount: 5 }
```

### 2. Display Notification List

```javascript
// Get notifikasi dengan pagination
GET /api/notifications?limit=10&offset=0

// Get hanya unread notifications
GET /api/notifications?unreadOnly=true
```

### 3. Mark Notification as Read

```javascript
// User mengklik notifikasi
PUT / api / notifications / { notificationId } / read;

// Mark all as read ketika user buka notification panel
PUT / api / notifications / read - all;
```

### 4. Admin Send Notification

```javascript
// Admin mengirim notifikasi ke user tertentu
POST /api/notifications
Body: {
  "title": "Report Updated",
  "message": "Your report has been resolved",
  "userId": "user-123"
}
```

### 5. Master Broadcast Notification

```javascript
// Master broadcast ke semua staff
POST /api/notifications/broadcast
Body: {
  "title": "System Update",
  "message": "System will be updated tonight",
  "roleFilter": ["STAFF"]
}
```

---

## Integration Examples

### React/Next.js Example

```javascript
// Get notifications
const getNotifications = async () => {
  const response = await fetch('/api/notifications?limit=10', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  return data;
};

// Mark as read
const markAsRead = async (notificationId) => {
  await fetch(`/api/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

// Get unread count (for badge)
const getUnreadCount = async () => {
  const response = await fetch('/api/notifications/unread/count', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  return data.data.unreadCount;
};
```

---

## Notes

- Semua timestamp menggunakan format ISO 8601
- Notifikasi menggunakan soft delete (deletedAt field)
- Notifikasi otomatis di-sort berdasarkan createdAt (newest first)
- Pagination menggunakan limit & offset pattern
