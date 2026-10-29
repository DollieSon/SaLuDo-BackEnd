# SaLuDo Backend API

A Node.js/TypeScript backend API for the SaLuDo application with MongoDB database support for both local development and remote deployment.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 24 (the version used by the Dockerfile and Render)
- **npm** or **yarn**
- **Docker** (for local MongoDB)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/DollieSon/SaLuDo-BackEnd.git
   cd SaLuDo-BackEnd
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env.local`** with at least a JWT secret (the server refuses to start without one):
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   See [Environment Configuration](#-environment-configuration) for the full list.

4. **Choose your database setup** (see options below)

## 🗄️ Database Setup Options

### Option 1: Local Development with Docker (Recommended)

**Step 1: Start Local MongoDB**
```bash
# Start MongoDB (and Redis) containers
docker-compose up -d

# Verify it's running
docker-compose logs -f mongodb
```

**Step 2: Run with Local Database**
```bash
npm run dev:local
```

**Expected Output:**
```
Connected to LOCAL MongoDB database at: localhost:27017
Database connection verified successfully
Server running on port 3000
API available at: http://localhost:3000
```

**Step 3: Stop Database (when done)**
```bash
docker-compose down
```

### Option 2: Remote Database (MongoDB Atlas)

**Step 1: Get your MongoDB connection string**
- Go to [MongoDB Atlas](https://cloud.mongodb.com/)
- Create a cluster (or use existing)
- Click "Connect" → "Connect your application"
- Copy the connection string

**Step 2: Configure Remote Connection**
Edit `.env.production` file:
```env
MONGO_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/SaLuDoTesting?retryWrites=true&w=majority
```

**Step 3: Run with Remote Database**
```bash
npm run dev:remote
```

**Expected Output:**
```
🌐 Connected to REMOTE MongoDB database
✅ Database connection verified successfully
🚀 Server running on port 3000
📡 API available at: http://localhost:3000
```

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run with current .env settings |
| `npm run dev:local` | Run API + email worker with `.env.local` (local Docker MongoDB) |
| `npm run dev:remote` | Run with `.env.production` (remote MongoDB) |
| `npm run worker:local` | Run the email worker alone (needs Redis) |
| `npm run build` | Build TypeScript to JavaScript |
| `npm run start` | Build and run production server |
| `npm test` | Run the test suite (Vitest, in-memory MongoDB) |
| `npm run test:watch` | Run tests in watch mode |
| `npx tsc --noEmit` | Type-check without building |

MongoDB/Redis containers are managed with `docker-compose` directly (see [Docker Setup](#-docker-setup)).

## 🔧 Environment Configuration

The project uses multiple environment files:

### `.env` (Active Configuration)
Currently active environment settings. Gets overwritten by dev scripts.

### `.env.local` (Local Development)
```env
MONGO_URI=mongodb://admin:password@localhost:27017/SaLuDoTesting?authSource=admin
PORT=3000
JWT_SECRET=<random 64-byte hex - required>
JWT_REFRESH_SECRET=<a different random value - recommended>
GOOGLE_API_KEY=<Gemini API key>
```

### `.env.production` (Remote Database)
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/SaLuDoTesting?retryWrites=true&w=majority
PORT=3000
NODE_ENV=production
JWT_SECRET=<required>
JWT_REFRESH_SECRET=<recommended>
GOOGLE_API_KEY=<required>
CORS_ORIGIN=https://your-frontend.example
```

### All Variables
| Variable | Required | Notes |
|----------|----------|-------|
| `JWT_SECRET` | Always | Server exits if missing or a placeholder |
| `JWT_REFRESH_SECRET` | Recommended | Must differ from `JWT_SECRET`; derived from it if unset |
| `MONGO_URI` | Yes | |
| `GOOGLE_API_KEY` | Yes | Gemini API key |
| `CORS_ORIGIN` | Production | Frontend origin(s), comma-separated; dev defaults to `http://localhost:5173` |
| `PORT`, `NODE_ENV` | No | Defaults 3000 / development |
| `REFRESH_COOKIE_SAMESITE` | No | `strict` / `lax` / `none`; detected automatically |
| `VIDEO_ANALYSIS_MAX_MB` | No | AI video analysis size cap (default 100) |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | For email | BullMQ email queue |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | For email | Note: the code reads `SMTP_PASSWORD` |
| `APP_URL`, `APP_NAME`, `DAILY_DIGEST_TIME`, `WEEKLY_DIGEST_TIME` | No | Email links and digest schedule |
| `ALLOW_SEED_USERS` | No | Set `true` only to run `seed-users.ts` in production |

## 🐳 Docker Setup

### MongoDB with Docker Compose

The project includes a `docker-compose.yml` for local MongoDB:

```yaml
services:
  mongodb:
    image: mongo:8.0
    container_name: saludo-mongodb
    ports:
      - "127.0.0.1:27017:27017"   # only reachable from this machine
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USERNAME:-admin}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD:-password}
      MONGO_INITDB_DATABASE: SaLuDoTesting
  # redis: redis:7.4-alpine on 127.0.0.1:6379 (requires REDIS_PASSWORD if you set one)
```

If your existing local volume was created by a newer MongoDB version, raise the image tag accordingly.

### Docker Commands

```bash
# Start MongoDB
docker-compose up -d mongodb

# Stop MongoDB
docker-compose down

# View logs
docker-compose logs -f mongodb

# Remove containers and volumes
docker-compose down -v
```

## 🧪 Tests

```bash
npm test
```

The suite (Vitest + Supertest) starts its own in-memory MongoDB, so no Docker, Redis or Gemini key is needed. The first run downloads a `mongod` binary, which is cached afterwards. It covers authentication and sessions, login throttling, candidate/comment access control, the public applicant endpoints, HTTP hardening, the video analysis cap and the security utilities. Tests live in `tests/`; the Express app they use is built by `app.ts`.

## 🔒 Security Notes

- Every API route requires `Authorization: Bearer <token>` except `/api/public/*` (applicant form) and `/api/users/auth/login|refresh`.
- Access tokens last 15 minutes. The refresh token is an HttpOnly cookie (`saludo_refresh`), never part of a response body; the frontend calls `POST /api/users/auth/refresh` with `credentials: "include"`.
- Non-manager roles only see candidates assigned to them (including files and comments).
- Failed logins are throttled per email + IP; all failures return the same message.
- Security headers (helmet, strict CSP) and a CORS allow-list are applied in `app.ts`.

## 🔍 Database Connection Verification

The application automatically tests the database connection at startup:

✅ **Success:** Server starts and shows connection type
❌ **Failure:** Server exits with error message

### Connection Indicators

- 🔧 **Local:** `Connected to LOCAL MongoDB database at: localhost:27017`
- 🌐 **Remote:** `Connected to REMOTE MongoDB database`

## 🛠️ Troubleshooting

### Common Issues

**1. Docker not running**
```
Error: Cannot connect to the Docker daemon
```
**Solution:** Start Docker Desktop

**2. Port 27017 already in use**
```
Error: Port 27017 is already allocated
```
**Solution:** 
```bash
# Stop conflicting MongoDB instance
docker-compose down
# Or kill process using port 27017
```

**3. MongoDB connection timeout**
```
❌ Failed to connect to database: MongoTimeoutError
```
**Solutions:**
- **Local:** Check if Docker container is running
- **Remote:** Verify connection string and network access

**4. Authentication failed**
```
❌ Failed to connect to database: MongoAuthenticationError
```
**Solutions:**
- **Local:** Use the default credentials (admin/password)
- **Remote:** Check username/password in connection string

### Database Management Tools

**MongoDB Compass (GUI)**
- **Local:** `mongodb://admin:password@localhost:27017`
- **Remote:** Use your Atlas connection string

**Command Line**
```bash
# Connect to local MongoDB
docker exec -it saludo-mongodb mongosh -u admin -p password

# View databases
show dbs

# Use SaLuDo database
use SaLuDoTesting

# View collections
show collections
```

## 📁 Project Structure

```
SaLuDo-BackEnd/
├── index.ts             # Env checks + server startup
├── app.ts               # Express app (middleware + routers)
├── Models/              # Types, classes and constants
├── routes/              # API route handlers + middleware/
├── services/            # Business logic
├── repositories/        # Database access layer
├── utils/               # Shared helpers (security config, SSRF guard, ...)
├── tests/               # Vitest suite
├── docker-compose.yml   # Local MongoDB + Redis setup
├── .env.local          # Local development config
├── .env.production     # Remote database config
└── README.md           # This file
```

## 🚀 Deployment

### Environment Variables for Production

Set these in your deployment platform:

```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/SaLuDoTesting?retryWrites=true&w=majority
PORT=3000
NODE_ENV=production
JWT_SECRET=<required>
JWT_REFRESH_SECRET=<recommended>
GOOGLE_API_KEY=<required>
CORS_ORIGIN=https://your-frontend.example
```

On Render, `render.yaml` builds with `npm ci && npm run build` and starts `node dist/index.js` on Node 24; set the secrets above in the dashboard. The Docker image (`Dockerfile`) uses `node:24-slim` and runs as a non-root user.

### Build for Production

```bash
npm run build
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Use local development setup
4. Make your changes
5. Run `npx tsc --noEmit` and `npm test`
6. Submit a pull request

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify your environment configuration
3. Check the server logs for detailed error messages
4. Ensure Docker is running (for local development)

---

**Happy Coding! 🎉**

**DISCLAIMER: Generated by AI :<**
