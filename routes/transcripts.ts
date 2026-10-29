import { Router, Request, Response } from "express";
import { CandidateService } from "../services/CandidateService";
import { PRIVATE_FILE_HEADERS } from "../utils/gridfsDownload";
import { asyncHandler, errorHandler } from "./middleware/errorHandler";
import { CandidateAccessMiddleware } from "./middleware/candidateAccess";
import { validation } from "./middleware/validation";
import { AuthMiddleware, AuthenticatedRequest } from "./middleware/auth";
import { AuditLogger } from "../utils/AuditLogger";
import { AuditEventType } from "../types/AuditEventTypes";
import {
  createMemoryUpload,
  UPLOAD_LIMITS,
  verifyFileSignature,
} from "./middleware/uploadSecurity";
import { analyzeTranscriptWithGemini } from "../services/GeminiTranscriptService";
import { connectDB } from "../mongo_db";
import { GridFSBucket, ObjectId } from "mongodb";
import { extractPdfText } from '../utils/pdfText';

import { OK, CREATED, BAD_REQUEST, UNAUTHORIZED, NOT_FOUND } from "../constants/HttpStatusCodes";
const router = Router({ mergeParams: true });

// Every route requires an authenticated user; candidate routes also check assignment
router.use(AuthMiddleware.authenticate);
const upload = createMemoryUpload(UPLOAD_LIMITS.TRANSCRIPT);
const candidateService = new CandidateService();

// ====================
// TRANSCRIPT FILE ENDPOINTS
// ====================

router.post(
  "/",
  CandidateAccessMiddleware.checkCandidateAccess,
  upload.single("transcript"),
  validation.validateTranscriptFile,
  verifyFileSignature,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const transcriptFile = req.file!;
    const user = req.user;
    const metadata = {
      interviewRound: req.body.interviewRound,
      duration: req.body.duration ? parseFloat(req.body.duration) : undefined,
    };
    const transcriptMetadata = await candidateService.addTranscriptFile(
      candidateId,
      transcriptFile,
      metadata
    );
    var text = "no text";
    if (transcriptFile.mimetype == "text/plain") {
      // If the file is a text file, convert it to a string
      text = transcriptFile.buffer.toString("utf-8");
    }else if (transcriptFile.mimetype == "application/pdf") {
      // If the file is a PDF, convert it to a string
      text = await extractPdfText(transcriptFile.buffer);
    }
    var currentPersonality = await candidateService.getCandidatePersonality(candidateId);
    const candidate = await candidateService.getCandidate(candidateId);
    const personality = await analyzeTranscriptWithGemini(
      text,
      candidateId,
      candidate?.name,
      user?.userId,
      user?.email
    );
    await candidateService.updateCandidatePersonality(candidateId, personality);
    
    // Log transcript generation
    await AuditLogger.logAIOperation({
      eventType: AuditEventType.TRANSCRIPT_GENERATED,
      candidateId,
      userId: user?.userId,
      userEmail: user?.email,
      action: `Transcript uploaded and processed for ${candidate?.name || candidateId}`,
      success: true,
      metadata: {
        candidateName: candidate?.name,
        transcriptLength: text.length,
        interviewRound: metadata.interviewRound,
        duration: metadata.duration,
        mimeType: transcriptFile.mimetype
      }
    });
    
    res.status(CREATED).json({
      success: true,
      message: "Transcript file uploaded successfully",
      data: transcriptMetadata,
    });
  })
);

router.get(
  "/",
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const transcripts = await candidateService.getAllTranscripts(candidateId);
    res.json({
      success: true,
      data: transcripts,
      count: transcripts.length,
    });
  })
);

router.get(
  "/:transcriptId",
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, transcriptId } = req.params;
    const { stream, metadata } = await candidateService.getTranscriptFile(
      candidateId,
      transcriptId
    );
    // res.attachment() safely encodes the user-supplied filename
    res.attachment(metadata.filename);
    res.set({
      ...PRIVATE_FILE_HEADERS,
      "Content-Type": metadata.contentType,
      "Content-Length": metadata.size.toString(),
    });
    stream.pipe(res);
  })
);

router.put(
  "/:transcriptId",
  CandidateAccessMiddleware.checkCandidateAccess,
  upload.single("transcript"),
  validation.validateTranscriptFile,
  verifyFileSignature,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, transcriptId } = req.params;
    const transcriptFile = req.file!;
    const metadata = {
      interviewRound: req.body.interviewRound,
      duration: req.body.duration ? parseFloat(req.body.duration) : undefined,
    };
    const updatedMetadata = await candidateService.updateTranscriptFile(
      candidateId,
      transcriptId,
      transcriptFile,
      metadata
    );
    res.json({
      success: true,
      message: "Transcript file updated successfully",
      data: updatedMetadata,
    });
  })
);

router.delete(
  "/:transcriptId",
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, transcriptId } = req.params;
    await candidateService.deleteTranscriptFile(candidateId, transcriptId);
    res.json({
      success: true,
      message: "Transcript file deleted successfully",
    });
  })
);

router.get(
  "/:transcriptId/metadata",
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, transcriptId } = req.params;
    const metadata = await candidateService.getTranscriptMetadata(
      candidateId,
      transcriptId
    );
    if (!metadata) {
      return res.status(NOT_FOUND).json({
        success: false,
        message: "Transcript not found",
      });
    }
    res.json({
      success: true,
      data: metadata,
    });
  })
);

router.post(
  "/:transcriptId/transcribe",
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, transcriptId } = req.params;
    const user = req.user;
    const buffer = await candidateService.getTranscriptBuffer(
      candidateId,
      transcriptId
    );

    const transcriptText = buffer.toString("utf-8");
    const candidate = await candidateService.getCandidate(candidateId);
    const personality = await analyzeTranscriptWithGemini(
      transcriptText,
      candidateId,
      candidate?.name,
      user?.userId,
      user?.email
    );

    res.json({
      success: true,
      message: "Transcript analyzed successfully",
      data: personality,
    });
  })
);

router.use(errorHandler);
export default router;
