import { Router, Request, Response } from "express";
import { CandidateService } from "../services/CandidateService";
import { CandidateComparisonService } from "../services/CandidateComparisonService";
import { PredictiveScoreService } from "../services/PredictiveScoreService";
import { SkillService } from "../services/SkillService";
import { EducationService } from "../services/EducationService";
import { ExperienceService } from "../services/ExperienceService";
import { CertificationService } from "../services/CertificationService";
import { StrengthWeaknessService } from "../services/StrengthWeaknessService";
import { asyncHandler, errorHandler } from "./middleware/errorHandler";
import { validation } from "./middleware/validation";
import { AuthMiddleware, AuthenticatedRequest } from "./middleware/auth";
import { CandidateAccessMiddleware } from "./middleware/candidateAccess";
import { parseResumeWithGemini } from "../services/GeminiResumeService";
import { AddedBy } from "../Models/Skill";
import { UserRole } from "../Models/User";
import { AuditLogger } from "../utils/AuditLogger";
import { AuditEventType } from "../types/AuditEventTypes";
import { connectDB } from "../mongo_db";
import { GridFSBucket, ObjectId } from "mongodb";
import multer from "multer";
import { CREATED, BAD_REQUEST } from "../constants/HttpStatusCodes";
import { cacheService, CacheKeys } from "../services/CacheService";

const router = Router({ mergeParams: true });
const upload = multer();
const candidateService = new CandidateService();
const candidateComparisonService = new CandidateComparisonService();
const predictiveScoreService = new PredictiveScoreService();
const skillService = new SkillService();
const educationService = new EducationService();
const experienceService = new ExperienceService();
const certificationService = new CertificationService();
const strengthWeaknessService = new StrengthWeaknessService();

// ====================
// CANDIDATE CORE ENDPOINTS
// ====================

// Get all candidates (filtered by role and assignments)
router.get(
  "/",
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    let candidates: any[] = [];

    if (
      user.role === UserRole.HR_USER ||
      user.role === UserRole.RECRUITER ||
      user.role === UserRole.INTERVIEWER
    ) {
      // HR_USER, RECRUITER, and INTERVIEWER can only see candidates assigned to them
      candidates = await candidateService.getCandidatesAssignedToHRUser(
        user.userId
      );
    } else if (
      user.role === UserRole.HR_MANAGER ||
      user.role === UserRole.ADMIN
    ) {
      // HR_MANAGER and ADMIN can see all candidates
      candidates = await candidateService.getAllCandidates();
    } else {
      // Default: no access
      candidates = [];
    }

    res.json({
      success: true,
      data: candidates,
      count: candidates.length,
    });
  })
);

// Create a new candidate
router.post(
  "/",
  upload.single("resume"),
  validation.requireFields(["name", "email", "birthdate"]),
  validation.validateEmailMiddleware,
  validation.validateDatesMiddleware(["birthdate"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, email, birthdate, roleApplied, socialLinks } = req.body;
    const user = req.user;

    if (!req.file) {
      return res
        .status(BAD_REQUEST)
        .json({ success: false, message: "Resume file is required" });
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(BAD_REQUEST).json({
        success: false,
        message: "Resume must be a PDF or Word document",
      });
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      return res.status(BAD_REQUEST).json({
        success: false,
        message: "Resume file size must not exceed 10MB",
      });
    }

    const emailArray = Array.isArray(email) ? email : [email];

    // Parse roleApplied (can be null, undefined, or a job ID)
    const jobId = roleApplied || null;

    // Parse social links if provided
    let parsedSocialLinks: any[] = [];
    if (socialLinks) {
      try {
        parsedSocialLinks =
          typeof socialLinks === "string"
            ? JSON.parse(socialLinks)
            : socialLinks;
      } catch (e) {
        console.error("Failed to parse social links:", e);
      }
    }

    const candidate = await candidateService.addCandidate(
      name,
      emailArray,
      new Date(birthdate),
      jobId,
      req.file,
      user?.userId,
      user?.email,
      parsedSocialLinks
    );

    // Use Gemini to parse resume
    const parsedData = await parseResumeWithGemini(
      req.file.buffer,
      candidate.candidateId,
      name,
      user?.userId,
      user?.email
    );

    // Save parsed data
    if (parsedData.skills.length) {
      await skillService.addSkillsBulk(
        candidate.candidateId,
        parsedData.skills.map((skill) => ({
          ...skill,
          addedBy: AddedBy.AI,
        }))
      );

      // Log skill analysis completion
      await AuditLogger.logAIOperation({
        eventType: AuditEventType.SKILL_ANALYSIS_COMPLETED,
        candidateId: candidate.candidateId,
        userId: user?.userId,
        userEmail: user?.email,
        action: `AI completed skill analysis for ${name}`,
        success: true,
        metadata: {
          candidateName: name,
          skillCount: parsedData.skills.length,
          averageScore:
            parsedData.skills.reduce((sum, s) => sum + (s.score || 0), 0) /
            parsedData.skills.length,
        },
      });
    }
    for (const edu of parsedData.education)
      await educationService.addEducation(candidate.candidateId, edu);
    for (const exp of parsedData.experience)
      await experienceService.addExperience(candidate.candidateId, exp);
    for (const cert of parsedData.certifications)
      await certificationService.addCertification(candidate.candidateId, cert);
    for (const strength of parsedData.strengths)
      await strengthWeaknessService.addStrength(
        candidate.candidateId,
        strength
      );
    for (const weakness of parsedData.weaknesses)
      await strengthWeaknessService.addWeakness(
        candidate.candidateId,
        weakness
      );

    // Notify assigned HR users that AI analysis is complete
    try {
      const { NotificationService } = await import(
        "../services/NotificationService"
      );
      const { NotificationRepository } = await import(
        "../repositories/NotificationRepository"
      );
      const { NotificationPreferencesRepository } = await import(
        "../repositories/NotificationPreferencesRepository"
      );
      const { WebhookRepository } = await import(
        "../repositories/WebhookRepository"
      );
      const { getAssignedHRUsers } = await import(
        "../utils/NotificationHelpers"
      );
      const { NotificationType } = await import(
        "../Models/enums/NotificationTypes"
      );
      const db = await connectDB();

      const notificationRepo = new NotificationRepository(
        db.collection("notifications")
      );
      const preferencesRepo = new NotificationPreferencesRepository(
        db.collection("notificationPreferences")
      );
      const webhookRepo = new WebhookRepository(db.collection("webhooks"));
      const notificationService = new NotificationService(
        notificationRepo,
        preferencesRepo,
        webhookRepo
      );

      const assignedUsers = await getAssignedHRUsers(candidate.candidateId);
      for (const hrUser of assignedUsers) {
        await notificationService.notifyCandidateEvent(
          NotificationType.CANDIDATE_AI_ANALYSIS_COMPLETE,
          hrUser.userId,
          candidate.candidateId,
          name,
          {
            skillsFound: parsedData.skills.length,
            educationFound: parsedData.education.length,
            experienceFound: parsedData.experience.length,
            certificationsFound: parsedData.certifications.length,
          }
        );
      }
    } catch (notifError) {
      console.error(
        "Failed to send CANDIDATE_AI_ANALYSIS_COMPLETE notification:",
        notifError
      );
    }

    res.status(CREATED).json({
      success: true,
      message: "Candidate created and resume parsed successfully",
      data: candidate,
    });
  })
);

// Get a specific candidate
router.get(
  "/:candidateId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const user = req.user;

    const candidate = await candidateService.getCandidate(candidateId);

    // Log candidate view
    await AuditLogger.logCandidateOperation({
      eventType: AuditEventType.CANDIDATE_VIEWED,
      candidateId,
      candidateName: candidate?.name,
      userId: user?.userId,
      userEmail: user?.email,
      action: "viewed",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        status: candidate?.status,
        roleApplied: candidate?.roleApplied,
      },
    });

    // Log PII access (email, birthdate are considered sensitive personal data)
    await AuditLogger.logCandidateOperation({
      eventType: AuditEventType.PII_VIEWED,
      candidateId,
      candidateName: candidate?.name,
      userId: user?.userId,
      userEmail: user?.email,
      action: "accessed_pii",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        piiFields: ["email", "birthdate", "name"],
        emailCount: candidate?.email?.length || 0,
        status: candidate?.status,
      },
    });

    res.json({
      success: true,
      data: candidate?.toObject(),
    });
  })
);

// Update candidate basic info
router.put(
  "/:candidateId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  upload.single("resume"),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const { name, email, birthdate, roleApplied, status, statusChangeReason, statusChangeNotes, statusChangeSource, socialLinks } = req.body;
    const resumeFile = req.file;
    const user = req.user;

    // Parse email array if it's a string
    let emailArray: string[] | undefined;
    if (email !== undefined) {
      if (typeof email === "string") {
        try {
          emailArray = JSON.parse(email);
        } catch {
          emailArray = [email];
        }
      } else {
        emailArray = email;
      }
    }

    // Parse socialLinks array if it's a string
    let parsedSocialLinks: any[] | undefined;
    if (socialLinks !== undefined) {
      if (typeof socialLinks === "string") {
        try {
          parsedSocialLinks = JSON.parse(socialLinks);
        } catch {
          parsedSocialLinks = [];
        }
      } else {
        parsedSocialLinks = socialLinks;
      }
    }

    // Update candidate basic info
    const updatePayload: any = {
      statusChangeReason,
      statusChangeNotes,
      statusChangeSource,
    };
    
    if (name !== undefined) updatePayload.name = name;
    if (emailArray !== undefined) updatePayload.email = emailArray;
    if (birthdate !== undefined) updatePayload.birthdate = new Date(birthdate);
    if (roleApplied !== undefined) updatePayload.roleApplied = roleApplied;
    if (status !== undefined) updatePayload.status = status;
    if (parsedSocialLinks !== undefined) updatePayload.socialLinks = parsedSocialLinks;

    await candidateService.updateCandidate(
      candidateId,
      updatePayload,
      user?.userId,
      user?.email,
      user ? `${user.firstName} ${user.lastName}` : undefined
    );

    // Update resume if provided
    if (resumeFile) {
      await candidateService.updateResumeFile(
        candidateId,
        resumeFile,
        user?.userId,
        user?.email
      );
    }

    // Invalidate caches if status changed or any update occurred
    if (status) {
      // Invalidate candidate-specific caches
      await cacheService.deletePattern(CacheKeys.CANDIDATE_PREFIX(candidateId));
      // Invalidate system-wide analytics cache
      await cacheService.delete(CacheKeys.SYSTEM_ANALYTICS());
    }

    // Get updated candidate data
    const updatedCandidate = await candidateService.getCandidate(candidateId);

    res.json({
      success: true,
      message: "Candidate updated successfully",
      data: updatedCandidate,
    });
  })
);

// Delete a candidate
router.delete(
  "/:candidateId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const user = req.user;

    await candidateService.deleteCandidate(
      candidateId,
      user?.userId,
      user?.email
    );

    res.json({
      success: true,
      message: "Candidate deleted successfully",
    });
  })
);

// Get candidate personality
router.get(
  "/:candidateId/personality",
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const personality = await candidateService.getCandidatePersonality(
      candidateId
    );

    res.json({
      success: true,
      data: personality,
    });
  })
);

// Compare two candidates
router.get(
  "/:candidateId1/compare/:candidateId2",
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId1, candidateId2 } = req.params;

    if (candidateId1 === candidateId2) {
      return res.status(BAD_REQUEST).json({
        success: false,
        message: "Cannot compare a candidate with themselves",
      });
    }

    const comparisonData = await candidateComparisonService.compareCandidates(
      candidateId1,
      candidateId2
    );

    res.json({
      success: true,
      data: comparisonData,
      message: "Candidates compared successfully",
    });
  })
);

// ====================
// HR ASSIGNMENT ENDPOINTS
// ====================

// Assign HR user to candidate (HR_MANAGER and ADMIN only)
router.post(
  "/:candidateId/assign/:hrUserId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.requireAssignmentPermissions,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, hrUserId } = req.params;
    const user = req.user!;
    const assignedBy = user.userId;

    await candidateService.assignHRUserToCandidate(
      candidateId,
      hrUserId,
      assignedBy
    );

    res.json({
      success: true,
      message: "HR user assigned to candidate successfully",
    });
  })
);

// Unassign HR user from candidate (HR_MANAGER and ADMIN only)
router.delete(
  "/:candidateId/unassign/:hrUserId",
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.HR_MANAGER),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, hrUserId } = req.params;

    await candidateService.unassignHRUserFromCandidate(candidateId, hrUserId);

    res.json({
      success: true,
      message: "HR user unassigned from candidate successfully",
    });
  })
);

// Get candidate assignments
router.get(
  "/:candidateId/assignments",
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;

    const assignments = await candidateService.getCandidateAssignments(
      candidateId
    );

    res.json({
      success: true,
      data: assignments,
    });
  })
);

// Get candidates assigned to HR user
router.get(
  "/assigned-to/:hrUserId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.validateHRUserAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { hrUserId } = req.params;

    const candidates = await candidateService.getCandidatesAssignedToHRUser(
      hrUserId
    );

    res.json({
      success: true,
      data: candidates,
      count: candidates.length,
    });
  })
);

// Get unassigned candidates (HR_MANAGER and ADMIN only)
router.get(
  "/unassigned",
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.HR_MANAGER),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const candidates = await candidateService.getUnassignedCandidates();

    res.json({
      success: true,
      data: candidates,
      count: candidates.length,
    });
  })
);

// Assign multiple HR users to candidate (HR_MANAGER and ADMIN only)
router.post(
  "/:candidateId/assign-multiple",
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.HR_MANAGER),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const { hrUserIds } = req.body;
    const user = req.user!;
    const assignedBy = user.userId;

    if (!hrUserIds || !Array.isArray(hrUserIds) || hrUserIds.length === 0) {
      return res.status(BAD_REQUEST).json({
        success: false,
        message: "hrUserIds array is required",
      });
    }

    // Assign each HR user
    for (const hrUserId of hrUserIds) {
      try {
        await candidateService.assignHRUserToCandidate(
          candidateId,
          hrUserId,
          assignedBy
        );
      } catch (error) {
        // Continue with other assignments even if one fails
        console.warn(
          `Failed to assign HR user ${hrUserId} to candidate ${candidateId}:`,
          error
        );
      }
    }

    // Log bulk operation audit
    await AuditLogger.log({
      eventType: AuditEventType.BULK_OPERATION_PERFORMED,
      userId: user.userId,
      userEmail: user.email,
      resource: "candidate",
      resourceId: candidateId,
      action: "bulk_hr_assignment",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        operationType: "assign_multiple_hr_users",
        hrUserIds,
        assignedCount: hrUserIds.length,
        candidateId,
      },
    });

    res.json({
      success: true,
      message: `HR users assigned to candidate successfully`,
    });
  })
);

// ====================
// PREDICTIVE SCORE ENDPOINTS
// ====================

/**
 * GET /api/candidates/:candidateId/success-score
 * Calculate predictive success score for a candidate
 * Query param: ?jobId= for job-specific scoring
 */
router.get(
  "/:candidateId/success-score",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const { jobId } = req.query;
    const user = req.user!;

    const scoreResult = await predictiveScoreService.calculateScore(
      candidateId,
      jobId as string | undefined,
      user.userId
    );

    // Log score calculation
    await AuditLogger.log({
      eventType: AuditEventType.CANDIDATE_VIEWED,
      userId: user.userId,
      userEmail: user.email,
      resource: "candidate_score",
      resourceId: candidateId,
      action: "calculate_predictive_score",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        jobId: jobId || null,
        mode: scoreResult.mode,
        overallScore: scoreResult.overallScore,
        confidence: scoreResult.confidence,
      },
    });

    res.json({
      success: true,
      data: scoreResult,
    });
  })
);

/**
 * GET /api/candidates/:candidateId/success-score/history
 * Get score history for a candidate
 * Query param: ?limit= (default 50)
 */
router.get(
  "/:candidateId/success-score/history",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await predictiveScoreService.getScoreHistory(
      candidateId,
      limit
    );

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  })
);

/**
 * POST /api/candidates/:candidateId/success-score/insights
 * Generate AI insights for a candidate (on-demand)
 * Query param: ?jobId= for job-specific context
 */
router.post(
  "/:candidateId/success-score/insights",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const { jobId } = req.query;
    const user = req.user!;

    const insights = await predictiveScoreService.generateAIInsights(
      candidateId,
      jobId as string | undefined,
      user.userId
    );

    // Log AI insights generation
    await AuditLogger.log({
      eventType: AuditEventType.AI_ANALYSIS_COMPLETED,
      userId: user.userId,
      userEmail: user.email,
      resource: "candidate_insights",
      resourceId: candidateId,
      action: "generate_ai_insights",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        jobId: jobId || null,
        insightsGenerated: true,
      },
    });

    res.json({
      success: true,
      data: insights,
      message: "AI insights generated successfully",
    });
  })
);

/**
 * GET /api/candidates/:candidateId/success-score/insights
 * Get cached AI insights for a candidate
 */
router.get(
  "/:candidateId/success-score/insights",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;

    const insights = await predictiveScoreService.getCachedInsights(
      candidateId
    );

    if (!insights) {
      return res.status(404).json({
        success: false,
        message: "No cached insights found. Use POST to generate insights.",
      });
    }

    res.json({
      success: true,
      data: insights,
    });
  })
);

// ====================
// FILE DOWNLOAD ENDPOINT
// ====================

// GET /api/candidates/files/:fileId/download
router.get(
  "/files/:fileId/download",
  asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;

    try {
      const db = await connectDB();
      const bucket = new GridFSBucket(db, { bucketName: "resumes" });

      // Check if file exists
      const files = await bucket.find({ _id: new ObjectId(fileId) }).toArray();

      if (!files || files.length === 0) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      const file = files[0];

      // Log file download
      await AuditLogger.logFileOperation({
        eventType: AuditEventType.FILE_DOWNLOADED,
        fileId: fileId,
        fileName: file.filename,
        fileType: "resume",
        candidateId: file.metadata?.candidateId,
        userId: (req as any).user?.userId || "anonymous",
        userEmail: (req as any).user?.email || "anonymous",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        action: "download",
        metadata: {
          contentType: file.contentType,
          size: file.length,
        },
      });

      // Set appropriate headers for download
      res.set({
        "Content-Type": file.contentType || "application/octet-stream",
        "Content-Length": file.length.toString(),
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "public, max-age=31536000",
      });

      // Stream the file
      const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));

      downloadStream.on("error", (error) => {
        console.error("File stream error:", error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: "Error streaming file",
          });
        }
      });

      downloadStream.pipe(res);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  })
);

// ====================
// STATUS HISTORY & TIME ANALYTICS ENDPOINTS
// ====================

// Get status history for a candidate
router.get(
  "/:candidateId/status-history",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    
    // Try to get from cache
    const cacheKey = CacheKeys.STATUS_HISTORY(candidateId);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true
      });
    }

    const candidate = await candidateService.getCandidate(candidateId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    const result = {
      candidateId: candidate.candidateId,
      candidateName: candidate.name,
      currentStatus: candidate.status,
      statusHistory: candidate.statusHistory,
      totalChanges: candidate.getStatusChangeCount(),
    };

    // Cache the result
    await cacheService.set(cacheKey, result, CacheKeys.STATUS_HISTORY_TTL);

    res.json({
      success: true,
      data: result,
    });
  })
);

// Get time analytics for a candidate
router.get(
  "/:candidateId/time-analytics",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const { stuckThresholdDays } = req.query;
    
    // Try to get from cache (5 minute TTL)
    const cacheKey = CacheKeys.CANDIDATE_ANALYTICS(candidateId);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true
      });
    }
    
    const { TimeAnalyticsService } = await import("../services/TimeAnalyticsService");
    const timeAnalyticsService = new TimeAnalyticsService();
    
    const analytics = await timeAnalyticsService.getCandidateTimeAnalytics(
      candidateId,
      stuckThresholdDays ? parseInt(stuckThresholdDays as string) : undefined
    );

    if (!analytics) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    // Cache the result
    await cacheService.set(cacheKey, analytics, CacheKeys.CANDIDATE_ANALYTICS_TTL);

    res.json({
      success: true,
      data: analytics,
    });
  })
);

// Get system-wide time analytics (HR_MANAGER and ADMIN only)
router.get(
  "/analytics/system-wide",
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;

    // Only HR_MANAGER and ADMIN can view system-wide analytics
    if (user.role !== UserRole.HR_MANAGER && user.role !== UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only HR Managers and Admins can view system-wide analytics.",
      });
    }

    // Try to get from cache (15 minute TTL)
    const cacheKey = CacheKeys.SYSTEM_ANALYTICS();
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true
      });
    }

    const { stuckThresholdDays } = req.query;
    
    const { TimeAnalyticsService } = await import("../services/TimeAnalyticsService");
    const timeAnalyticsService = new TimeAnalyticsService();
    
    const analytics = await timeAnalyticsService.getSystemWideTimeAnalytics(
      stuckThresholdDays ? parseInt(stuckThresholdDays as string) : undefined
    );

    // Cache the result
    await cacheService.set(cacheKey, analytics, CacheKeys.SYSTEM_ANALYTICS_TTL);

    res.json({
      success: true,
      data: analytics,
    });
  })
);

// ====================
// RESUME SECTION CRUD ENDPOINTS
// ====================

// Skills CRUD
router.post(
  "/:candidateId/skills",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const { skillName, score, evidence, addedBy } = req.body;

    if (!skillName) {
      return res.status(BAD_REQUEST).json({
        success: false,
        message: "Skill name is required",
      });
    }

    const skill = await skillService.addSkillToCandidate(
      candidateId,
      skillName,
      score,
      evidence,
      addedBy || AddedBy.HUMAN
    );

    res.status(CREATED).json({
      success: true,
      message: "Skill added successfully",
      data: skill,
    });
  })
);

router.put(
  "/:candidateId/skills/:skillId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, skillId } = req.params;
    const { skillName, score, evidence } = req.body;

    await skillService.updateSkillForCandidate(
      candidateId,
      skillId,
      skillName,
      score,
      evidence
    );

    res.json({
      success: true,
      message: "Skill updated successfully",
    });
  })
);

router.delete(
  "/:candidateId/skills/:skillId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, skillId } = req.params;

    await skillService.removeSkillFromCandidate(candidateId, skillId);

    res.json({
      success: true,
      message: "Skill deleted successfully",
    });
  })
);

// Experience CRUD
router.post(
  "/:candidateId/experience",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const { description, title, role, startDate, endDate, addedBy } = req.body;

    await experienceService.addExperience(candidateId, {
      description,
      title,
      role,
      startDate,
      endDate,
      addedBy: addedBy || AddedBy.HUMAN,
    });

    res.status(CREATED).json({
      success: true,
      message: "Experience added successfully",
    });
  })
);

router.put(
  "/:candidateId/experience/:experienceId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, experienceId } = req.params;
    const { description, title, role, startDate, endDate } = req.body;

    await experienceService.updateExperience(candidateId, experienceId, {
      description,
      title,
      role,
      startDate,
      endDate,
    });

    res.json({
      success: true,
      message: "Experience updated successfully",
    });
  })
);

router.delete(
  "/:candidateId/experience/:experienceId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, experienceId } = req.params;

    await experienceService.deleteExperience(candidateId, experienceId);

    res.json({
      success: true,
      message: "Experience deleted successfully",
    });
  })
);

// Education CRUD
router.post(
  "/:candidateId/education",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const { description, institution, startDate, endDate, addedBy } = req.body;

    await educationService.addEducation(candidateId, {
      description,
      institution,
      startDate,
      endDate,
      addedBy: addedBy || AddedBy.HUMAN,
    });

    res.status(CREATED).json({
      success: true,
      message: "Education added successfully",
    });
  })
);

router.put(
  "/:candidateId/education/:educationId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, educationId } = req.params;
    const { description, institution, startDate, endDate } = req.body;

    await educationService.updateEducation(candidateId, educationId, {
      description,
      institution,
      startDate,
      endDate,
    });

    res.json({
      success: true,
      message: "Education updated successfully",
    });
  })
);

router.delete(
  "/:candidateId/education/:educationId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, educationId } = req.params;

    await educationService.deleteEducation(candidateId, educationId);

    res.json({
      success: true,
      message: "Education deleted successfully",
    });
  })
);

// Certifications CRUD
router.post(
  "/:candidateId/certifications",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const { description, certificationName, issuingOrganization, issueDate, addedBy } = req.body;

    await certificationService.addCertification(candidateId, {
      name: certificationName,
      description,
      issuingOrganization,
      issueDate,
      addedBy: addedBy || AddedBy.HUMAN,
    });

    res.status(CREATED).json({
      success: true,
      message: "Certification added successfully",
    });
  })
);

router.put(
  "/:candidateId/certifications/:certificationId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, certificationId } = req.params;
    const { description, certificationName, issuingOrganization, issueDate } = req.body;

    await certificationService.updateCertification(candidateId, certificationId, {
      name: certificationName,
      description,
      issuingOrganization,
      issueDate,
    });

    res.json({
      success: true,
      message: "Certification updated successfully",
    });
  })
);

router.delete(
  "/:candidateId/certifications/:certificationId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, certificationId } = req.params;

    await certificationService.deleteCertification(candidateId, certificationId);

    res.json({
      success: true,
      message: "Certification deleted successfully",
    });
  })
);

// Strengths & Weaknesses CRUD
router.post(
  "/:candidateId/strengths-weaknesses",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const { name, description, type, addedBy } = req.body;

    if (!type || !['strength', 'weakness'].includes(type)) {
      return res.status(BAD_REQUEST).json({
        success: false,
        message: "Type must be 'strength' or 'weakness'",
      });
    }

    if (type === 'strength') {
      await strengthWeaknessService.addStrength(candidateId, {
        name,
        description,
        addedBy: addedBy || AddedBy.HUMAN,
      });
    } else {
      await strengthWeaknessService.addWeakness(candidateId, {
        name,
        description,
        addedBy: addedBy || AddedBy.HUMAN,
      });
    }

    res.status(CREATED).json({
      success: true,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} added successfully`,
    });
  })
);

router.put(
  "/:candidateId/strengths-weaknesses/:itemId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, itemId } = req.params;
    const { name, description, type } = req.body;

    if (!type || !['strength', 'weakness'].includes(type.toLowerCase())) {
      return res.status(BAD_REQUEST).json({
        success: false,
        message: "Type must be 'strength' or 'weakness'",
      });
    }

    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    await strengthWeaknessService.updateStrengthWeakness(
      candidateId,
      itemId,
      { name, description },
      capitalizedType as 'Strength' | 'Weakness'
    );

    res.json({
      success: true,
      message: "Item updated successfully",
    });
  })
);

router.delete(
  "/:candidateId/strengths-weaknesses/:itemId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, itemId } = req.params;
    const { type } = req.body;

    if (!type || !['strength', 'weakness'].includes(type.toLowerCase())) {
      return res.status(BAD_REQUEST).json({
        success: false,
        message: "Type must be 'strength' or 'weakness'",
      });
    }

    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    await strengthWeaknessService.deleteStrengthWeakness(
      candidateId,
      itemId,
      capitalizedType as 'Strength' | 'Weakness'
    );

    res.json({
      success: true,
      message: "Item deleted successfully",
    });
  })
);

router.use(errorHandler);
export default router;
