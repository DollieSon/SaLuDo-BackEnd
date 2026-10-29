// =======================
// EXPRESS APP
// =======================
// Purpose: Build the Express app (security middleware, routers, error handler)
//          without starting anything, so index.ts can serve it and the test
//          suite can call it directly.
// Related: index.ts (server startup), tests/
// =======================

import express, { Express, Request, Response } from "express";
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
import { errorHandler } from "./routes/middleware/errorHandler";
import { getAllowedOrigins } from "./utils/securityConfig";

export const createApp = (): Express => {
  const app = express();
  const nodeEnv = process.env.NODE_ENV || "development";

  // Trust proxy headers only in production (Render uses 1 proxy hop)
  // In development, no proxy is used, so we don't need to trust proxy headers
  if (nodeEnv === "production") {
    app.set("trust proxy", 1);
    console.log("✓ Trust proxy enabled (1 hop) for production");
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

  return app;
};
