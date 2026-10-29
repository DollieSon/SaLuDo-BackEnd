import express, { Request, Response } from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import usersRouter from "./routes/users";
import jobRouter from "./routes/job";
import candidatesRouter from "./routes/candidates";
import skillsRouter from "./routes/skills";
import experienceRouter from "./routes/experience";
import educationRouter from "./routes/education";
import certificationsRouter from "./routes/certifications";
import strengthsWeaknessesRouter from "./routes/strengths-weaknesses";
import transcriptsRouter from "./routes/transcripts";
import videosRouter from "./routes/videos";
import filesRouter from "./routes/files";
import auditLogsRouter from "./routes/audit-logs";
import notificationsRouter from "./routes/notifications";
import commentsRouter from "./routes/comments";
import webhooksRouter from "./routes/webhooks";
import dashboardRouter from "./routes/dashboard";
import settingsRouter from "./routes/settings";
import aiMetricsRouter from "./routes/ai-metrics";
import publicRouter from "./routes/public";
import dotenv from "dotenv";
import { connectDB } from "./mongo_db";
import { TokenBlacklistRepository } from "./repositories/TokenBlacklistRepository";
import { webSocketService } from "./services/WebSocketService";
import { errorHandler } from "./routes/middleware/errorHandler";
import { getAllowedOrigins, validateJwtConfig } from "./utils/securityConfig";

console.log('='.repeat(60));
console.log('APPLICATION STARTING...');
console.log('='.repeat(60));

dotenv.config();
console.log('✓ Environment variables loaded');

// Environment and MongoDB URI logging
const nodeEnv = process.env.NODE_ENV || "development";

// Environment Variables Validation
console.log("Checking environment variables...");
const missingVars = [];
const warnings = [];

// JWT secrets are required in EVERY environment: a missing or placeholder
// secret lets anyone forge tokens, including admin tokens.
const jwtProblems = validateJwtConfig();
if (jwtProblems.length > 0) {
  jwtProblems.forEach((problem) => console.error(`CRITICAL: ${problem}`));
  console.error(
    "   Generate: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
  );
  console.error("REFUSING TO START WITHOUT VALID JWT SECRETS");
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  missingVars.push("MONGO_URI");
  console.error("CRITICAL: MONGO_URI not set - database connection will fail");
  console.error(
    "   Example: mongodb://localhost:27017/saludo or MongoDB Atlas connection string"
  );
}

if (!process.env.GOOGLE_API_KEY) {
  missingVars.push("GOOGLE_API_KEY");
  console.error("CRITICAL: GOOGLE_API_KEY not set - AI services will fail");
  console.error(
    "   Get key from: https://console.cloud.google.com/apis/credentials"
  );
}

if (nodeEnv === "production" && getAllowedOrigins().length === 0) {
  missingVars.push("CORS_ORIGIN");
  console.error(
    "CRITICAL: CORS_ORIGIN not set - set it to the frontend origin(s), comma-separated"
  );
}

// Optional variables with defaults
if (!process.env.PORT) {
  warnings.push("PORT not set, using default: 3000");
}

if (!process.env.NODE_ENV) {
  warnings.push("NODE_ENV not set, using default: development");
}

// Display warnings
if (warnings.length > 0) {
  console.warn("Environment warnings:");
  warnings.forEach((warning) => console.warn("   " + warning));
}

// Handle critical missing variables
if (missingVars.length > 0) {
  console.error(
    `Missing critical environment variables: ${missingVars.join(", ")}`
  );
  console.error(
    "Set these in your .env file or environment variables before starting."
  );

  if (nodeEnv === "production") {
    console.error(
      "REFUSING TO START IN PRODUCTION WITH MISSING CRITICAL VARIABLES"
    );
    console.error('Exiting with code 1...');
    process.exit(1);
  } else {
    console.warn("Continuing in development mode - some features may not work");
  }
} else {
  console.log("✓ All critical environment variables are set.");
}
const mongoUri = process.env.MONGO_URI;
const isLocal =
  mongoUri?.includes("localhost") || mongoUri?.includes("127.0.0.1");

console.log('\n' + '='.repeat(60));
console.log("CONFIGURATION SUMMARY:");
console.log('='.repeat(60));
console.log("Environment:", nodeEnv);
console.log("Database Type:", isLocal ? "LOCAL MongoDB" : "REMOTE MongoDB");
console.log(
  "MongoDB URI:",
  mongoUri ? mongoUri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@") : "NOT SET"
);
console.log("Port:", process.env.PORT || '3000');
console.log("─".repeat(60));

const app = express();
const httpServer = createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);

// Trust proxy headers only in production (Render uses 1 proxy hop)
// In development, no proxy is used, so we don't need to trust proxy headers
if (nodeEnv === 'production') {
  app.set('trust proxy', 1);
  console.log('✓ Trust proxy enabled (1 hop) for production');
}

// Security headers. The API only serves JSON and files, so the CSP can be strict.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
  })
);

// Only the configured frontend origin(s) may call the API from a browser
const allowedOrigins = getAllowedOrigins();
app.use(
  cors({
    origin: (origin, callback) => {
      // Non-browser clients (curl, server-to-server) send no Origin header
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true, // needed for the HttpOnly refresh-token cookie
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from Render!");
});

app.get("/api/data", (req: Request, res: Response) => {
  res.json({ message: "Here is your data." });
});

// Deliberately unauthenticated: job application form only (rate-limited)
app.use("/api/public", publicRouter);
app.use("/api/users", usersRouter);
app.use("/api/jobs", jobRouter); // Changed from /api/job to /api/jobs
app.use("/api/candidates", candidatesRouter);
app.use("/api/candidates", skillsRouter); // Candidate-specific skill routes
app.use("/api/skills", skillsRouter); // Global skill routes (search, master data)
app.use("/api/candidates", experienceRouter);
app.use("/api/candidates", educationRouter);
app.use("/api/candidates", certificationsRouter);
app.use("/api/candidates", strengthsWeaknessesRouter);
app.use("/api/candidates/:candidateId/transcripts", transcriptsRouter); // Transcript routes
app.use("/api/candidates/:candidateId/videos", videosRouter); // Video routes
app.use("/api/files", filesRouter); // File serving routes
app.use("/api/audit-logs", auditLogsRouter); // Admin-only audit log access
app.use("/api/notifications", notificationsRouter); // Notification routes
app.use("/api/comments", commentsRouter); // Comment routes
app.use("/api/webhooks", webhooksRouter); // Webhook configuration routes
app.use("/api/dashboard", dashboardRouter); // Dashboard statistics routes (admin-only)
app.use("/api/settings", settingsRouter); // Scoring settings and preferences routes
app.use("/api/ai-metrics", aiMetricsRouter); // AI metrics and performance tracking routes (admin-only)

// Fallback error handler for routers without their own (keeps stack traces out of responses)
app.use(errorHandler);

// Function to start the server with database connection
async function startServer() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('STARTING SERVER INITIALIZATION...');
    console.log('='.repeat(60));
    
    // Test database connection during startup
    console.log("[1/7] Testing database connection...");
    const db = await connectDB();
    console.log("✓ [1/7]✓ [1/7] Database connection successful!");
    
    // Initialize WebSocket service
    console.log('[2/7] Initializing WebSocket service...');
    webSocketService.initialize(httpServer);
    console.log('✓ [2/7] WebSocket service initialized successfully');
    
    // Initialize comprehensive token cleanup service
    console.log("[3/7] Setting up token cleanup service...");
    const { TokenCleanupService } = await import(
      "./services/TokenCleanupService"
    );

    // Start the automated cleanup service (runs every 24 hours)
    TokenCleanupService.startCleanupService();
    
    console.log('✓ [3/7] Token cleanup service started successfully');
    
    // Initialize digest scheduler for email digests
    console.log('[4/7] Setting up digest scheduler...');
    const { DigestScheduler } = await import('./DigestScheduler');
    const digestScheduler = new DigestScheduler(db);
    digestScheduler.start();
    console.log('✓ [4/7] Digest scheduler started successfully');
    
    // Initialize AI Metrics service and indexes
    console.log('[5/7] Setting up AI Metrics service...');
    const { AIMetricsService } = await import('./services/AIMetricsService');
    const aiMetricsService = new AIMetricsService(db);
    await aiMetricsService.initializeIndexes();
    console.log('✓ [5/7] AI Metrics indexes created successfully');
    
    // Start AI Alert monitoring service
    console.log('[6/7] Starting AI Alert monitoring service...');
    const { AIAlertService } = await import('./services/AIAlertService');
    const aiAlertService = new AIAlertService(db);
    aiAlertService.startMonitoring();
    console.log('✓ [6/7] AI Alert monitoring service started successfully');
    
    // Start the server
    // Bind to 0.0.0.0 to accept connections from any network interface (required for Render)
    console.log(`[7/7] Starting HTTP server on port ${PORT}...`);
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log('\n' + '='.repeat(60));
      console.log('✓ SERVER READY!');
      console.log('='.repeat(60));
      console.log(`Port: ${PORT}`);
      console.log(`Environment: ${nodeEnv}`);
      console.log(`Database: ${isLocal ? 'LOCAL' : 'REMOTE'} MongoDB`);
      console.log(`WebSocket: Enabled`);
      console.log(`Digest Scheduler: Running`);
      console.log(`AI Services: Active`);
      console.log('='.repeat(60));
    });
    
    console.log('✓ [7/7] Server listen started, waiting for port to open...');
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('✗ SERVER STARTUP FAILED');
    console.error('='.repeat(60));
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
    console.error('='.repeat(60));
    console.error('Exiting with code 1...');
    process.exit(1);
  }
}

// Start the server
console.log('\nCalling startServer()...\n');
startServer().catch((error) => {
  console.error('\n' + '='.repeat(60));
  console.error('✗ UNHANDLED ERROR IN startServer()');
  console.error('='.repeat(60));
  console.error(error);
  console.error('='.repeat(60));
  process.exit(1);
});
