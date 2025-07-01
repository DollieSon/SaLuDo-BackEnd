import { Router, Request, Response } from "express";
import { CandidateService } from "../services/CandidateService";
import { asyncHandler, errorHandler } from "./middleware/errorHandler";
import multer from "multer";

const router = Router({ mergeParams: true });
const upload = multer();
const candidateService = new CandidateService();

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
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, birthdate, roleApplied } = req.body;
    const resumeFile = req.file;

    // Parse email array if it's a string
    let emailArray: string[];
    if (typeof email === 'string') {
      try {
        emailArray = JSON.parse(email);
      } catch {
        emailArray = [email];
      }
    } else {
      emailArray = email || [];
    }

    const candidate = await candidateService.addCandidate(
      name,
      emailArray,
      new Date(birthdate),
      roleApplied,
      resumeFile
    );

    res.status(201).json({
      success: true,
      message: "Candidate created successfully",
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
    if (typeof email === 'string') {
      try {
        emailArray = JSON.parse(email);
      } catch {
        emailArray = [email];
      }
    } else {
      emailArray = email || [];
    }

    // Update candidate basic info
    await candidateService.updateCandidate(
      candidateId,
      {
        name,
        email: emailArray,
        birthdate: new Date(birthdate),
        roleApplied,
      }
    );

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
    const personality = await candidateService.getCandidatePersonality(candidateId);

    res.json({
      success: true,
      data: personality,
    });
  })
);

router.use(errorHandler);
export default router;
