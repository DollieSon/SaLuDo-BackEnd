# SaLuDo Backend API

A Node.js/TypeScript backend API for the SaLuDo application with MongoDB database support for both local development and remote deployment.

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
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

3. **Choose your database setup** (see options below)

## 🗄️ Database Setup Options

### Option 1: Local Development with Docker (Recommended)

**Step 1: Start Local MongoDB**
```bash
# Start MongoDB container
npm run db:up

# Verify it's running
npm run db:logs
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
npm run db:down
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
| `npm run dev:local` | Run with local Docker MongoDB |
| `npm run dev:remote` | Run with remote MongoDB |
| `npm run build` | Build TypeScript to JavaScript |
| `npm run start` | Build and run production server |
| `npm run db:up` | Start local MongoDB container |
| `npm run db:down` | Stop local MongoDB container |
| `npm run db:logs` | View MongoDB container logs |

## 🔧 Environment Configuration

The project uses multiple environment files:

### `.env` (Active Configuration)
Currently active environment settings. Gets overwritten by dev scripts.

### `.env.local` (Local Development)
```env
MONGO_URI=mongodb://admin:password@localhost:27017/SaLuDoTesting?authSource=admin
PORT=3000
```

### `.env.production` (Remote Database)
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/SaLuDoTesting?retryWrites=true&w=majority
PORT=3000
NODE_ENV=production
```

## 🐳 Docker Setup

### MongoDB with Docker Compose

The project includes a `docker-compose.yml` for local MongoDB:

```yaml
services:
  mongodb:
    image: mongo:latest
    container_name: saludo-mongodb
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
      MONGO_INITDB_DATABASE: SaLuDoTesting
```

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
├── Models/              # Database models
├── routes/              # API route handlers
├── services/            # Business logic
├── repositories/        # Database access layer
├── tests/               # Test files
├── docker-compose.yml   # Local MongoDB setup
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
```

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
5. Test with both local and remote databases
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
