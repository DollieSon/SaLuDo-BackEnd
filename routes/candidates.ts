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
import { parseResumeWithGemini } from "../services/GeminiResumeService";
import { AddedBy } from "../Models/Skill";
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

// Get all candidates
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const candidates = await candidateService.getAllCandidates();
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
      return res
        .status(400)
        .json({
          success: false,
          message: "Resume must be a PDF or Word document",
        });
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      return res
        .status(400)
        .json({
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
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const candidate = await candidateService.getCandidate(candidateId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    res.json({
      success: true,
      data: candidate,
    });
  })
);

// Update candidate basic info
router.put(
  "/:candidateId",
  upload.single("resume"),
  asyncHandler(async (req: Request, res: Response) => {
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

router.use(errorHandler);
export default router;
