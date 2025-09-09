import express, { Request, Response } from "express";
import cors from "cors";
import { connectDB } from "./mongo_db";
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

dotenv.config();

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

// Initialize database connection and start server
async function startServer() {
  try {
    // Test database connection at startup
    await connectDB();
    console.log('Database connection verified successfully');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API available at: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to database:', error);
    console.error('Please check your MONGO_URI environment variable');
    process.exit(1);
  }
}

// Start the server
startServer();
