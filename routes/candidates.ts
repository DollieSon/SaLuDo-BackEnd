import { Router, Request, Response } from "express";
import { CandidateService } from "../services/CandidateService";
import { CandidateComparisonService } from "../services/CandidateComparisonService";
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
import multer from "multer";

const router = Router({ mergeParams: true });
const upload = multer();
const candidateService = new CandidateService();
const candidateComparisonService = new CandidateComparisonService();
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
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, birthdate, roleApplied } = req.body;

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Resume file is required" });
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Resume must be a PDF or Word document",
      });
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: "Resume file size must not exceed 10MB",
      });
    }

    const emailArray = Array.isArray(email) ? email : [email];

    // Parse roleApplied (can be null, undefined, or a job ID)
    const jobId = roleApplied || null;

    const candidate = await candidateService.addCandidate(
      name,
      emailArray,
      new Date(birthdate),
      jobId,
      req.file
    );

    // Use Gemini to parse resume
    const parsedData = await parseResumeWithGemini(req.file.buffer);

    // Save parsed data
    if (parsedData.skills.length) {
      await skillService.addSkillsBulk(
        candidate.candidateId,
        parsedData.skills.map((skill) => ({
          ...skill,
          addedBy: AddedBy.AI,
        }))
      );
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

    res.status(201).json({
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

    const candidate = await candidateService.getCandidate(candidateId);

    res.json({
      success: true,
      data: candidate,
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
    const { name, email, birthdate, roleApplied } = req.body;
    const resumeFile = req.file;

    // Parse email array if it's a string
    let emailArray: string[];
    if (typeof email === "string") {
      try {
        emailArray = JSON.parse(email);
      } catch {
        emailArray = [email];
      }
    } else {
      emailArray = email || [];
    }

    // Update candidate basic info
    await candidateService.updateCandidate(candidateId, {
      name,
      email: emailArray,
      birthdate: new Date(birthdate),
      roleApplied,
    });

    // Update resume if provided
    if (resumeFile) {
      await candidateService.updateResumeFile(candidateId, resumeFile);
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
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    await candidateService.deleteCandidate(candidateId);

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
      return res.status(400).json({
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
      return res.status(400).json({
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

    res.json({
      success: true,
      message: `HR users assigned to candidate successfully`,
    });
  })
);

router.use(errorHandler);
export default router;
