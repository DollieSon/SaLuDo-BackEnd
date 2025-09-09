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
import dotenv from "dotenv";
import { connectDB } from "./mongo_db";

dotenv.config();

// Environment and MongoDB URI logging
const nodeEnv = process.env.NODE_ENV || 'development';
const mongoUri = process.env.MONGO_URI;
const isLocal = mongoUri?.includes('localhost') || mongoUri?.includes('127.0.0.1');

console.log('Application Starting...');
console.log('Environment:', nodeEnv);
console.log('Database Type:', isLocal ? 'LOCAL MongoDB' : 'REMOTE MongoDB');
console.log('MongoDB URI:', mongoUri ? mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') : 'NOT SET');
console.log('─'.repeat(60));

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

// Function to start the server with database connection
async function startServer() {
  try {
    // Test database connection during startup
    console.log(' Testing database connection...');
    await connectDB();
    console.log(' Database connection successful!');
    
    // Start the server
    app.listen(PORT, () => {
      console.log(' Server Status:');
      console.log(`    Server running on port ${PORT}`);
      console.log(`    Environment: ${nodeEnv}`);
      console.log(`    Database: ${isLocal ? 'LOCAL' : 'REMOTE'} MongoDB`);
      console.log('─'.repeat(60));
    });
  } catch (error) {
    console.error('   Failed to start server due to database connection error:');
    console.error('   Error:', error);
    console.error('   Please check your MongoDB connection and try again.');
    process.exit(1);
  }
}

// Start the server
startServer();
