# 🎯 Chat System - WhatsApp Style

## Quick Start

Sistem chat sudah diubah dari model **live support** menjadi **peer-to-peer messaging** seperti WhatsApp.

### ✅ Perubahan Utama:

1. **Table `chat_responses` dihapus** - Tidak lagi diperlukan
2. **Semua pesan di table `chats`** dengan struktur:
   - `userId` = pengirim
   - `recipientId` = penerima
   - `isRead` = status baca

### 🚀 Cara Pakai:

#### 1. Kirim Pesan

```bash
POST /api/chats/send
{
  "message": "Halo, butuh bantuan",
  "recipientId": "user-id-tujuan"
}
```

#### 2. Lihat Percakapan Saya

```bash
GET /api/chats/my-conversations
```

#### 3. Mark Sebagai Dibaca

```bash
PUT /api/chats/{chatId}/read
```

#### 4. Cek Unread Count

```bash
GET /api/chats/unread/count
```

### 📚 Dokumentasi Lengkap:

- [CHAT_API_DOCUMENTATION.md](./CHAT_API_DOCUMENTATION.md) - API reference lengkap
- [CHAT_CHANGES_SUMMARY.md](./CHAT_CHANGES_SUMMARY.md) - Detail semua perubahan

### 🔐 Authorization:

- **STAFF**: Bisa chat ke ADMIN & MASTER
- **ADMIN**: Bisa chat ke semua (STAFF, ADMIN, MASTER)
- **MASTER**: Full access ke semua

### ⚡ Features:

- ✅ Peer-to-peer messaging
- ✅ Read status tracking
- ✅ Unread count
- ✅ Grouped by date
- ✅ Rate limiting (10 msg/min)
- ✅ Soft delete
- ✅ Search conversations

---

**Version:** 2.0 | **Last Updated:** October 22, 2025
