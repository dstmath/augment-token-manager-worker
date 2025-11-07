# Augment Token Manager Server

Express.js backend for Augment Token Manager with MySQL database.

## 🚀 Features

- **Express.js** - Fast, unopinionated web framework
- **Prisma ORM** - Type-safe database access
- **MySQL** - Reliable relational database
- **TypeScript** - Type safety and better DX
- **PM2** - Production process manager
- **Session-based Auth** - Secure authentication
- **Rate Limiting** - API protection
- **CORS** - Cross-origin resource sharing

## 📋 Prerequisites

- Node.js >= 18.0.0
- MySQL >= 8.0
- PM2 (for production deployment)

## 🛠️ Installation

### 1. Install Dependencies

```bash
cd manager-server
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
DATABASE_URL="mysql://username:password@localhost:3306/augment_info"
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-secret-key-change-this
USER_CREDENTIALS="admin:admin123"
CORS_ORIGIN=http://localhost:5173
```

### 3. Setup Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view database
npm run prisma:studio
```

## 📦 Data Migration from Cloudflare KV

If you have existing data in Cloudflare KV, you can migrate it to MySQL:

### 1. Configure Cloudflare Credentials

Add these to your `.env` file:

```env
CF_ACCOUNT_ID=your-cloudflare-account-id
CF_TOKENS_KV_NAMESPACE_ID=your-tokens-kv-namespace-id
CF_SESSIONS_KV_NAMESPACE_ID=your-sessions-kv-namespace-id
CF_API_TOKEN=your-cloudflare-api-token
```

### 2. Run Migration Script

```bash
npm run db:migrate-from-kv
```

This will:
- Fetch all tokens from Cloudflare KV
- Fetch all sessions from Cloudflare KV
- Import them into MySQL database
- Skip expired sessions
- Create users as needed

## 🏃 Running the Server

### Development Mode

```bash
npm run dev
```

Server will run on `http://localhost:3000` with hot reload.

### Production Mode

```bash
# Build TypeScript
npm run build

# Start with Node.js
npm start

# Or start with PM2 (recommended)
pm2 start ecosystem.config.cjs
```

## 📡 API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/validate` - Validate session

### Token Management

- `GET /api/tokens` - List tokens (with pagination)
- `GET /api/tokens/stats` - Get token statistics
- `GET /api/tokens/:id` - Get specific token
- `POST /api/tokens` - Create new token
- `POST /api/tokens/batch-import` - Batch import tokens
- `PUT /api/tokens/:id` - Update token
- `DELETE /api/tokens/:id` - Delete token

### Health Check

- `GET /health` - Server health check

## 🔧 PM2 Commands

```bash
# Start application
pm2 start ecosystem.config.cjs

# Stop application
pm2 stop augtoken-manager-server

# Restart application
pm2 restart augtoken-manager-server

# View logs
pm2 logs augtoken-manager-server

# Monitor
pm2 monit

# View status
pm2 status

# Save PM2 process list (auto-restart on reboot)
pm2 save
pm2 startup
```

## 🗄️ Database Schema

### Users Table
- `id` - UUID primary key
- `username` - Unique username
- `email` - Optional email
- `password` - Hashed password
- `role` - ADMIN or USER
- `isActive` - Account status
- `createdAt`, `updatedAt` - Timestamps

### Sessions Table
- `id` - UUID primary key
- `sessionId` - Unique session identifier
- `userId` - Foreign key to users
- `expiresAt` - Session expiration
- `ipAddress`, `userAgent` - Request metadata
- `createdAt` - Timestamp

### Tokens Table
- `id` - UUID primary key
- `tenantUrl`, `accessToken`, `portalUrl` - Token data
- `emailNote` - Associated email
- `banStatus`, `portalInfo`, `shareInfo` - JSON metadata
- `isShared` - Sharing status
- `authSession` - Auth session cookie
- `createdBy` - Foreign key to users
- `createdAt`, `updatedAt` - Timestamps

## 🔒 Security

- Session-based authentication
- Rate limiting on API endpoints
- CORS protection
- Input validation
- SQL injection protection (via Prisma)
- Password hashing (bcrypt)

## 📊 Monitoring

### View Logs

```bash
# PM2 logs
pm2 logs augtoken-manager-server

# Log files
tail -f logs/out.log
tail -f logs/error.log
```

### Database Monitoring

```bash
# Open Prisma Studio
npm run prisma:studio
```

## 🚢 Deployment

### 1. Build Application

```bash
npm run build
```

### 2. Setup Production Database

```bash
npm run prisma:migrate:prod
```

### 3. Start with PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

### 4. Configure Nginx (Optional)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 🧪 Development

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL connection string | Required |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `SESSION_SECRET` | Session encryption key | Required |
| `SESSION_EXPIRY_HOURS` | Session duration | 24 |
| `USER_CREDENTIALS` | User credentials | admin:admin123 |
| `CORS_ORIGIN` | Allowed CORS origin | http://localhost:5173 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 900000 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT

