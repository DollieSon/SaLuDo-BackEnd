// =======================
// PUBLIC (UNAUTHENTICATED) ROUTES
// =======================
// Purpose: The only endpoints anonymous users may call: the job application
//          form (/candidate-form?jobId=...). Everything here is deliberately
//          narrow: public job fields only, strict rate limits, validated
//          uploads, and a short-lived token that allows exactly one
//          introduction video upload for the application just submitted.
// Related: services/CandidateIntakeService.ts, frontend CandidateForm
// =======================

import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { asyncHandler, errorHandler } from "./middleware/errorHandler";
import { validation } from "./middleware/validation";
import {
  cleanupTempUpload,
  createDiskUpload,
  createMemoryUpload,
  UPLOAD_LIMITS,
  verifyFileSignature,
} from "./middleware/uploadSecurity";
import { JobService } from "../services/JobService";
import { CandidateService } from "../services/CandidateService";
import { createCandidateWithResume } from "../services/CandidateIntakeService";
import { sanitizeSocialLinks } from "../utils/urlSafety";
import {
  getJwtSecret,
  JWT_SIGN_OPTIONS,
  JWT_VERIFY_OPTIONS,
} from "../utils/securityConfig";
import { BAD_REQUEST, CREATED, NOT_FOUND, UNAUTHORIZED } from "../constants/HttpStatusCodes";

const router = Router();
const jobService = new JobService();
const candidateService = new CandidateService();

const RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/avi",
  "video/mov",
  "video/wmv",
  "video/flv",
  "video/mkv",
  "video/m4v",
];
const APPLICATION_UPLOAD_TOKEN_TTL = "30m";
const MAX_NAME_LENGTH = 200;
const MAX_EMAILS = 3;

// Each application triggers paid AI resume parsing, so keep this tight per IP
const applicationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 50 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many applications from this network. Please try again later.",
  },
});

const publicReadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});

const resumeUpload = createMemoryUpload(UPLOAD_LIMITS.RESUME);
const videoUpload = createDiskUpload(UPLOAD_LIMITS.VIDEO, (req, file, cb) => {
  if (VIDEO_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error("Invalid file type. Only video files are allowed."), { status: 400 }));
  }
});

const createApplicationUploadToken = (candidateId: string) =>
  jwt.sign({ type: "application-upload", candidateId }, getJwtSecret(), {
    ...JWT_SIGN_OPTIONS,
    expiresIn: APPLICATION_UPLOAD_TOKEN_TTL,
  });

// Only the applicant who just submitted may attach their introduction video
const requireApplicationUploadToken = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.header("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  try {
    const decoded = jwt.verify(token, getJwtSecret(), JWT_VERIFY_OPTIONS) as {
      type?: string;
      candidateId?: string;
    };
    if (decoded.type !== "application-upload" || decoded.candidateId !== req.params.candidateId) {
      throw new Error("wrong token");
    }
    next();
  } catch {
    res.status(UNAUTHORIZED).json({ success: false, message: "Upload link expired or invalid." });
  }
};

// GET /api/public/jobs/:jobId - public job details for the application form
router.get(
  "/jobs/:jobId",
  publicReadRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    const job = await jobService.getJob(req.params.jobId).catch(() => null);
    if (!job) {
      return res.status(NOT_FOUND).json({ success: false, message: "Job not found" });
    }

    // Only fields an applicant should see
    res.json({
      success: true,
      data: {
        _id: (job as any)._id ?? req.params.jobId,
        jobName: job.jobName,
        jobDescription: job.jobDescription,
      },
    });
  })
);

// POST /api/public/applications - submit an application with a resume
router.post(
  "/applications",
  applicationRateLimit,
  resumeUpload.single("resume"),
  verifyFileSignature,
  validation.requireFields(["name", "email", "birthdate"]),
  validation.validateEmailMiddleware,
  validation.validateDatesMiddleware(["birthdate"]),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, birthdate, roleApplied, socialLinks } = req.body;

    if (!req.file || !RESUME_TYPES.includes(req.file.mimetype)) {
      return res.status(BAD_REQUEST).json({
        success: false,
        message: "A PDF or Word resume is required",
      });
    }

    if (typeof name !== "string" || !name.trim() || name.length > MAX_NAME_LENGTH) {
      return res.status(BAD_REQUEST).json({ success: false, message: "A valid name is required" });
    }

    const emailArray = (Array.isArray(email) ? email : [email]).filter(
      (e): e is string => typeof e === "string"
    );
    if (emailArray.length === 0 || emailArray.length > MAX_EMAILS) {
      return res.status(BAD_REQUEST).json({ success: false, message: "A valid email is required" });
    }

    // Applications may only target an existing job
    let jobId: string | null = null;
    if (typeof roleApplied === "string" && roleApplied.trim()) {
      const job = await jobService.getJob(roleApplied.trim()).catch(() => null);
      if (!job) {
        return res.status(BAD_REQUEST).json({ success: false, message: "Job not found" });
      }
      jobId = roleApplied.trim();
    }

    let parsedSocialLinks: unknown = [];
    if (typeof socialLinks === "string" && socialLinks) {
      try {
        parsedSocialLinks = JSON.parse(socialLinks);
      } catch {
        parsedSocialLinks = [];
      }
    }

    const candidate = await createCandidateWithResume({
      name: name.trim(),
      emailArray,
      birthdate,
      jobId,
      file: req.file,
      socialLinks: sanitizeSocialLinks(parsedSocialLinks),
      userEmail: "public-application",
      continueOnAnalysisError: true,
    });

    // Applicants get their candidate ID and a 30-minute token for the optional
    // introduction video, and nothing else about the stored record
    res.status(CREATED).json({
      success: true,
      message: "Application submitted successfully",
      data: {
        candidateId: candidate.candidateId,
        uploadToken: createApplicationUploadToken(candidate.candidateId),
      },
    });
  })
);

// POST /api/public/applications/:candidateId/introduction-video
router.post(
  "/applications/:candidateId/introduction-video",
  applicationRateLimit,
  requireApplicationUploadToken,
  cleanupTempUpload,
  videoUpload.single("video"),
  validation.validateVideoFile,
  verifyFileSignature,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId } = req.params;

    // One introduction video per application: the token can't be replayed
    const existing = await candidateService.getAllVideos(candidateId, "introduction");
    if (existing.length > 0) {
      return res.status(BAD_REQUEST).json({
        success: false,
        message: "An introduction video was already uploaded",
      });
    }

    await candidateService.addVideoFile(candidateId, req.file!, "introduction", {}, undefined, "public-application");

    res.status(CREATED).json({
      success: true,
      message: "Introduction video uploaded successfully",
    });
  })
);

router.use(errorHandler);
export default router;
