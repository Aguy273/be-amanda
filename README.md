# Amanda Helpdesk Backend

Backend system untuk Amanda Helpdesk dengan fitur laporan, FAQ, dan chat system yang terintegrasi.
# ENV untuk Backend :
PORT = 4500
JWT_SECRET=your_super_secret_jwt_key_here_change_this_in_production_amanda_helpdesk_2025
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=development
DATABASE_URL="postgresql://postgres:12345@localhost:5432/amanda_helpdesk?schema=public"

- **User Management & Authentication** - Login/Register dengan role-based access (STAFF, ADMIN, MASTER)
- **FAQ Management** - CRUD operasi untuk FAQ dengan berbagai tipe konten
- **Report System** - Sistem laporan dengan upload gambar dan response dari admin
- **Chat System** - Public chat antara staff dan admin dengan monitoring master
- **File Upload** - Support upload gambar untuk laporan dan chat
- **Role-based Access Control** - Middleware untuk authorization berdasarkan role

## 🏗️ Architecture

### Database Models

- **User** - Manajemen user dengan role
- **Role** - STAFF, ADMIN, MASTER
- **FAQ** - Frequently Asked Questions dengan tipe TEXT/ARTICLE/FILE
- **Report** - Laporan dengan gambar dan response
- **ReportResponse** - Response admin untuk laporan
- **Chat** - Pesan dari staff
- **ChatResponse** - Response admin untuk chat

### API Structure

```
src/
├── api/
│   ├── auth/          # Authentication endpoints
│   ├── users/         # User management
│   ├── faq/           # FAQ CRUD operations
│   ├── reports/       # Report management
│   └── chats/         # Chat system
├── database/
│   └── db.js          # Prisma client
└── utils/
    ├── authMiddleware.js    # Role-based access control
    ├── fileUpload.js        # File upload utilities
    ├── validation.js        # Input validation
    └── hashPassword.js      # Password hashing
```

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **Bun** (package manager)
- **PostgreSQL** database
- **.env** file with database configuration

## 🛠️ Installation

1. **Clone repository**

```bash
git clone <repository-url>
cd amanda-helpdesk-be
```

2. **Install dependencies**

```bash
bun install
```

3. **Setup environment variables**

```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env file
DATABASE_URL="postgresql://username:password@localhost:5432/amanda_helpdesk"
```

4. **Setup database**

```bash
# Run migrations
npx prisma migrate dev --name "initial-migration"

# Generate Prisma client
npx prisma generate

# Seed database with sample data
node prisma/seeds/seed.js
```

5. **Start server**

```bash
# Development mode
bun run dev

# Production mode
bun run start
```

Server akan berjalan di `http://localhost:4500`

## 🔌 API Endpoints

### Authentication

- `POST /register` - Register new user
- `POST /login` - Login user

### FAQ Management

- `GET /faq` - Get all FAQs (with filtering & search)
- `GET /faq/:id` - Get FAQ by ID
- `POST /faq` - Create new FAQ
- `PUT /faq/:id` - Update FAQ
- `DELETE /faq/:id` - Delete FAQ

### Report Management

- `GET /reports` - Get all reports (with filtering)
- `GET /reports/:id` - Get report with responses
- `POST /reports` - Create new report
- `PUT /reports/:id` - Update report status
- `POST /reports/:id/responses` - Add admin response
- `DELETE /reports/:id` - Delete report

### Chat System

- `GET /chats` - Get all conversations (Master monitoring)
- `GET /chats/stats` - Get chat statistics
- `GET /chats/user/:userId` - Get user conversation
- `POST /chats/message` - Send message from staff
- `POST /chats/response` - Send admin response
- `DELETE /chats/:id` - Delete message

### User Management

- `GET /users` - Get all users
- `POST /users` - Create user
- `DELETE /users/:id` - Delete user

## 📱 Usage Examples

### Create Report with Images

```bash
curl -X POST http://localhost:4500/reports \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Bug di sistem login",
    "description": "Sistem tidak merespon saat login",
    "userId": "user-uuid-here",
    "images": ["path/to/screenshot1.jpg", "path/to/screenshot2.jpg"]
  }'
```

### Send Chat Message

```bash
curl -X POST http://localhost:4500/chats/message \\
  -H "Content-Type: application/json" \\
  -d '{
    "userId": "staff-uuid-here",
    "message": "Halo admin, saya butuh bantuan dengan payroll"
  }'
```

### Admin Response to Chat

```bash
curl -X POST http://localhost:4500/chats/response \\
  -H "Content-Type: application/json" \\
  -d '{
    "chatId": "chat-uuid-here",
    "adminId": "admin-uuid-here",
    "message": "Halo, bisa dijelaskan lebih detail masalahnya?"
  }'
```

## 👥 Role-based Access

### STAFF

- Dapat membuat laporan dan FAQ
- Dapat mengirim pesan chat ke admin
- Hanya bisa akses data milik sendiri

### ADMIN

- Dapat merespon laporan dan chat
- Dapat mengelola FAQ
- Dapat melihat semua data staff

### MASTER

- Full access ke semua fitur
- Dapat monitoring semua aktivitas
- Dapat mengelola user dan role

## 📁 File Upload

### Supported Features

- **Report Images**: Max 5 files, 5MB each
- **Chat Images**: Max 3 files, 5MB each
- **File Types**: JPG, PNG, GIF, WebP
- **Storage**: Local filesystem di `/uploads/`

### Upload Directories

```
uploads/
├── reports/     # Report images
└── chats/       # Chat images
```

## 🧪 Sample Data

Database seed menyediakan:

- **3 Roles**: STAFF, ADMIN, MASTER
- **16 Users**: 1 Admin, 3 Master, 12 Staff
- **25 FAQs**: Berbagai tipe konten
- **30 Reports**: Berbagai status
- **100 Chat Messages**: Simulasi percakapan

### Default Login Credentials

```
Admin: admin@amanda-helpdesk.com / admin123
Master: master@amanda-helpdesk.com / master123
Staff: staff@amanda-helpdesk.com / staff123
```

## 🔧 Development

### Project Structure

```
amanda-helpdesk-be/
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── migrations/         # Migration files
│   └── seeds/             # Seed data
├── src/
│   ├── api/               # API routes & controllers
│   ├── database/          # Database connection
│   ├── utils/             # Utility functions
│   ├── app.js             # Express app setup
│   └── index.js           # Server entry point
├── uploads/               # File storage
├── package.json
└── API_DOCUMENTATION.md   # Detailed API docs
```

### Database Management

```bash
# Create new migration
npx prisma migrate dev --name "migration-name"

# Reset database
npx prisma migrate reset

# View database
npx prisma studio

# Check migration status
npx prisma migrate status
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Error**

   - Check `DATABASE_URL` in `.env`
   - Ensure PostgreSQL is running
   - Verify database exists

2. **Migration Errors**

   - Run `npx prisma migrate reset` for fresh start
   - Check schema.prisma syntax

3. **File Upload Issues**

   - Ensure `uploads/` directory exists
   - Check file permissions
   - Verify disk space

4. **Permission Errors**
   - Add user authentication middleware
   - Check role-based access rules
   - Verify user roles in database

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the project
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📞 Support

Untuk support atau pertanyaan, silakan hubungi tim development atau buka issue di repository.
