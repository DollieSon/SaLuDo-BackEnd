import express, { Request, Response } from "express";
import cors from "cors";
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
import dotenv from "dotenv";
import { connectDB } from "./mongo_db";
import { TokenBlacklistRepository } from "./repositories/TokenBlacklistRepository";

dotenv.config();

// Environment and MongoDB URI logging
const nodeEnv = process.env.NODE_ENV || "development";

// Environment Variables Validation
console.log("Checking environment variables...");
const missingVars = [];
const warnings = [];

// Critical variables that must be set
if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET === "your-jwt-secret-change-in-production"
) {
  missingVars.push("JWT_SECRET");
  console.error("CRITICAL: JWT_SECRET not set or using default value");
  console.error(
    "   Generate: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
  );
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
    process.exit(1);
  } else {
    console.warn("Continuing in development mode - some features may not work");
  }
} else {
  console.log("All critical environment variables are set.");
}
const mongoUri = process.env.MONGO_URI;
const isLocal =
  mongoUri?.includes("localhost") || mongoUri?.includes("127.0.0.1");

console.log("Application Starting...");
console.log("Environment:", nodeEnv);
console.log("Database Type:", isLocal ? "LOCAL MongoDB" : "REMOTE MongoDB");
console.log(
  "MongoDB URI:",
  mongoUri ? mongoUri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@") : "NOT SET"
);
console.log("─".repeat(60));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from Render!");
});

app.get("/api/data", (req: Request, res: Response) => {
  console.log("something heheh");
  res.json({ message: "Here is your data." });
});

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

// Function to start the server with database connection
async function startServer() {
  try {
    // Test database connection during startup
    console.log(" Testing database connection...");
    const db = await connectDB();
    console.log(" Database connection successful!");

    // Initialize comprehensive token cleanup service
    console.log(" Setting up comprehensive token cleanup service...");
    const { TokenCleanupService } = await import(
      "./services/TokenCleanupService"
    );

    // Start the automated cleanup service (runs every 24 hours)
    TokenCleanupService.startCleanupService();

    console.log(" Token cleanup service started successfully");

    // Start the server
    app.listen(PORT, () => {
      console.log(" Server Status:");
      console.log(`    Server running on port ${PORT}`);
      console.log(`    Environment: ${nodeEnv}`);
      console.log(`    Database: ${isLocal ? "LOCAL" : "REMOTE"} MongoDB`);
      console.log("─".repeat(60));
    });
  } catch (error) {
    console.error(
      "   Failed to start server due to database connection error:"
    );
    console.error("   Error:", error);
    console.error("   Please check your MongoDB connection and try again.");
    process.exit(1);
  }
}

// Start the server
startServer();
