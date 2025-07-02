import { Router, Request, Response } from "express";
import { CandidateService } from "../services/CandidateService";
import { asyncHandler, errorHandler } from "./middleware/errorHandler";
import { candidateExists } from "./middleware/candidateExists";
import { validation } from "./middleware/validation";
import multer from "multer";
import { analyzeTranscriptWithGemini } from "../services/geminiTranscriptService";
import { connectDB } from "../mongo_db";
import { GridFSBucket, ObjectId } from "mongodb";
import pdfParse from 'pdf-parse';

const router = Router({ mergeParams: true });
const upload = multer();
const candidateService = new CandidateService();

// ====================
// TRANSCRIPT FILE ENDPOINTS
// ====================

router.post(
  "/",
  upload.single("transcript"),
  candidateExists,
  validation.validateTranscriptFile,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const transcriptFile = req.file!;
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
      const pdfBuffer = transcriptFile.buffer;
      const data = await pdfParse(pdfBuffer);
      text = data.text;
    }
    var currentPersonality = await candidateService.getCandidatePersonality(candidateId);
    console.log(`Current personality for candidate ${candidateId}:`, currentPersonality);
    console.log(`Transcript text for candidate ${candidateId}: ${text.substring(0, 200)}...`);

    console.log('=== DEBUG: Calling analyzeTranscriptWithGemini ===');
    const personality = await analyzeTranscriptWithGemini(text);
    console.log(`=== DEBUG: Gemini response type:`, typeof personality);
    console.log(`=== DEBUG: Gemini response keys:`, Object.keys(personality || {}));
    console.log(`=== DEBUG: Full Gemini response:`, JSON.stringify(personality, null, 2));
    
    console.log('=== DEBUG: Calling updateCandidatePersonality ===');
    await candidateService.updateCandidatePersonality(candidateId, personality);
    console.log(`=== DEBUG: Personality update completed successfully ===`);
    res.status(201).json({
      success: true,
      message: "Transcript file uploaded successfully",
      data: transcriptMetadata,
    });
  })
);

router.get(
  "/",
  candidateExists,
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
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, transcriptId } = req.params;
    const { stream, metadata } = await candidateService.getTranscriptFile(
      candidateId,
      transcriptId
    );
    res.set({
      "Content-Type": metadata.contentType,
      "Content-Disposition": `attachment; filename="${metadata.filename}"`,
      "Content-Length": metadata.size.toString(),
    });
    stream.pipe(res);
  })
);

router.put(
  "/:transcriptId",
  upload.single("transcript"),
  candidateExists,
  validation.validateTranscriptFile,
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
  candidateExists,
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
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, transcriptId } = req.params;
    const metadata = await candidateService.getTranscriptMetadata(
      candidateId,
      transcriptId
    );
    if (!metadata) {
      return res.status(404).json({
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
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, transcriptId } = req.params;
    const buffer = await candidateService.getTranscriptBuffer(
      candidateId,
      transcriptId
    );

    const transcriptText = buffer.toString("utf-8");
    const personality = await analyzeTranscriptWithGemini(transcriptText);

    res.json({
      success: true,
      message: "Transcript analyzed successfully",
      data: personality,
    });
  })
);

router.use(errorHandler);
export default router;
