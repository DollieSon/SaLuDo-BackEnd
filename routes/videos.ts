import express, { Request, Response } from "express";
import {
  cleanupTempUpload,
  createDiskUpload,
  getVideoAnalysisMaxBytes,
  readStreamWithLimit,
  UPLOAD_LIMITS,
  verifyFileSignature,
} from "./middleware/uploadSecurity";
import { CandidateService } from "../services";
import { CandidateAccessMiddleware } from "./middleware/candidateAccess";
import { validation } from "./middleware/validation";
import { PRIVATE_FILE_HEADERS } from "../utils/gridfsDownload";
import { asyncHandler } from "./middleware/errorHandler";
import { AuthMiddleware, AuthenticatedRequest } from "./middleware/auth";
import {
  analyzeInterviewVideoWithGemini,
  analyzeIntroductionVideoWithGemini,
} from "../services/GeminiVideoService";

import {
  OK,
  CREATED,
  BAD_REQUEST,
  UNAUTHORIZED,
  NOT_FOUND,
  PAYLOAD_TOO_LARGE,
} from "../constants/HttpStatusCodes";
const router = express.Router({ mergeParams: true });

/**
 * Load a stored video for AI analysis, or send 413 and return null when it is
 * larger than the analysis limit (checked before reading, and while reading).
 */
const readVideoForAnalysis = async (
  res: Response,
  stream: AsyncIterable<Buffer> & { destroy?: () => void },
  declaredSize: number | undefined
): Promise<Buffer | null> => {
  const maxBytes = getVideoAnalysisMaxBytes();
  const buffer =
    typeof declaredSize === "number" && declaredSize > maxBytes
      ? null
      : await readStreamWithLimit(stream, maxBytes);

  if (!buffer) {
    stream.destroy?.();
    res.status(PAYLOAD_TOO_LARGE).json({
      success: false,
      message: `Video is too large for AI analysis (limit ${Math.round(
        maxBytes / (1024 * 1024)
      )} MB). Upload a shorter or compressed version to analyze it.`,
    });
  }
  return buffer;
};

// Every route requires an authenticated user; candidate routes also check assignment
router.use(AuthMiddleware.authenticate);
const candidateService = new CandidateService();

// Configure multer for video file uploads: streamed to a temp file on disk,
// never buffered in memory, and removed when the response finishes
const upload = createDiskUpload(UPLOAD_LIMITS.VIDEO, (req, file, cb) => {
  const allowedTypes = [
    "video/mp4",
    "video/webm",
    "video/avi",
    "video/mov",
    "video/wmv",
    "video/flv",
    "video/mkv",
    "video/m4v",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error("Invalid file type. Only video files are allowed."), { status: 400 }));
  }
});

// ============================
// INTERVIEW VIDEO ROUTES
// ============================

// POST /api/candidates/:candidateId/videos/interview/upload
router.post(
  "/interview/upload",
  CandidateAccessMiddleware.checkCandidateAccess,
  cleanupTempUpload,
  upload.single("video"),
  validation.validateVideoFile,
  verifyFileSignature,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const videoFile = req.file!;
    const user = req.user;
    const metadata = {
      interviewRound: req.body.interviewRound,
      duration: req.body.duration ? parseFloat(req.body.duration) : undefined,
      resolution: req.body.resolution,
      frameRate: req.body.frameRate
        ? parseFloat(req.body.frameRate)
        : undefined,
      bitrate: req.body.bitrate ? parseInt(req.body.bitrate) : undefined,
    };

    const videoMetadata = await candidateService.addVideoFile(
      candidateId,
      videoFile,
      "interview",
      metadata,
      user?.userId,
      user?.email
    );

    res.status(CREATED).json({
      success: true,
      message: "Interview video uploaded successfully",
      data: videoMetadata,
    });
  })
);

// GET /api/candidates/:candidateId/videos/interview
router.get(
  "/interview",
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const videos = await candidateService.getAllVideos(
      candidateId,
      "interview"
    );

    res.json({
      success: true,
      message: "Interview videos retrieved successfully",
      data: videos,
    });
  })
);

// GET /api/candidates/:candidateId/videos/interview/:videoId
router.get(
  "/interview/:videoId",
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, videoId } = req.params;
    const { stream, metadata } = await candidateService.getVideoFile(
      candidateId,
      videoId,
      "interview"
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

// GET /api/candidates/:candidateId/videos/interview/:videoId/download
router.get(
  "/interview/:videoId/download",
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, videoId } = req.params;
    const { stream, metadata } = await candidateService.getVideoFile(
      candidateId,
      videoId,
      "interview"
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

// GET /api/candidates/:candidateId/videos/interview/:videoId/metadata
router.get(
  "/interview/:videoId/metadata",
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, videoId } = req.params;
    const metadata = await candidateService.getVideoMetadata(
      candidateId,
      videoId,
      "interview"
    );

    if (!metadata) {
      return res.status(NOT_FOUND).json({
        success: false,
        message: "Interview video not found",
      });
    }

    res.json({
      success: true,
      message: "Interview video metadata retrieved successfully",
      data: metadata,
    });
  })
);

// PUT /api/candidates/:candidateId/videos/interview/:videoId
router.put(
  "/interview/:videoId",
  CandidateAccessMiddleware.checkCandidateAccess,
  cleanupTempUpload,
  upload.single("video"),
  validation.validateVideoFile,
  verifyFileSignature,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, videoId } = req.params;
    const videoFile = req.file!;
    const metadata = {
      interviewRound: req.body.interviewRound,
      duration: req.body.duration ? parseFloat(req.body.duration) : undefined,
      resolution: req.body.resolution,
      frameRate: req.body.frameRate
        ? parseFloat(req.body.frameRate)
        : undefined,
      bitrate: req.body.bitrate ? parseInt(req.body.bitrate) : undefined,
    };

    const updatedMetadata = await candidateService.updateVideoFile(
      candidateId,
      videoId,
      videoFile,
      "interview",
      metadata
    );

    res.json({
      success: true,
      message: "Interview video updated successfully",
      data: updatedMetadata,
    });
  })
);

// DELETE /api/candidates/:candidateId/videos/interview/:videoId
router.delete(
  "/interview/:videoId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, videoId } = req.params;

    await candidateService.deleteVideoFile(candidateId, videoId, "interview");

    res.json({
      success: true,
      message: "Interview video deleted successfully",
    });
  })
);

// ============================
// INTRODUCTION VIDEO ROUTES
// ============================

// POST /api/candidates/:candidateId/videos/introduction/upload
router.post(
  "/introduction/upload",
  CandidateAccessMiddleware.checkCandidateAccess,
  cleanupTempUpload,
  upload.single("video"),
  validation.validateVideoFile,
  verifyFileSignature,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId } = req.params;
    const videoFile = req.file!;
    const user = req.user;
    const metadata = {
      duration: req.body.duration ? parseFloat(req.body.duration) : undefined,
      resolution: req.body.resolution,
      frameRate: req.body.frameRate
        ? parseFloat(req.body.frameRate)
        : undefined,
      bitrate: req.body.bitrate ? parseInt(req.body.bitrate) : undefined,
    };

    const videoMetadata = await candidateService.addVideoFile(
      candidateId,
      videoFile,
      "introduction",
      metadata,
      user?.userId,
      user?.email
    );

    res.status(CREATED).json({
      success: true,
      message: "Introduction video uploaded successfully",
      data: videoMetadata,
    });
  })
);

// GET /api/candidates/:candidateId/videos/introduction
router.get(
  "/introduction",
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const videos = await candidateService.getAllVideos(
      candidateId,
      "introduction"
    );

    res.json({
      success: true,
      message: "Introduction videos retrieved successfully",
      data: videos,
    });
  })
);

// GET /api/candidates/:candidateId/videos/introduction/:videoId
router.get(
  "/introduction/:videoId",
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, videoId } = req.params;
    const { stream, metadata } = await candidateService.getVideoFile(
      candidateId,
      videoId,
      "introduction"
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

// GET /api/candidates/:candidateId/videos/introduction/:videoId/download
router.get(
  "/introduction/:videoId/download",
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, videoId } = req.params;
    const { stream, metadata } = await candidateService.getVideoFile(
      candidateId,
      videoId,
      "introduction"
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

// GET /api/candidates/:candidateId/videos/introduction/:videoId/metadata
router.get(
  "/introduction/:videoId/metadata",
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, videoId } = req.params;
    const metadata = await candidateService.getVideoMetadata(
      candidateId,
      videoId,
      "introduction"
    );

    if (!metadata) {
      return res.status(NOT_FOUND).json({
        success: false,
        message: "Introduction video not found",
      });
    }

    res.json({
      success: true,
      message: "Introduction video metadata retrieved successfully",
      data: metadata,
    });
  })
);

// PUT /api/candidates/:candidateId/videos/introduction/:videoId
router.put(
  "/introduction/:videoId",
  CandidateAccessMiddleware.checkCandidateAccess,
  cleanupTempUpload,
  upload.single("video"),
  validation.validateVideoFile,
  verifyFileSignature,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, videoId } = req.params;
    const videoFile = req.file!;
    const metadata = {
      duration: req.body.duration ? parseFloat(req.body.duration) : undefined,
      resolution: req.body.resolution,
      frameRate: req.body.frameRate
        ? parseFloat(req.body.frameRate)
        : undefined,
      bitrate: req.body.bitrate ? parseInt(req.body.bitrate) : undefined,
    };

    const updatedMetadata = await candidateService.updateVideoFile(
      candidateId,
      videoId,
      videoFile,
      "introduction",
      metadata
    );

    res.json({
      success: true,
      message: "Introduction video updated successfully",
      data: updatedMetadata,
    });
  })
);

// DELETE /api/candidates/:candidateId/videos/introduction/:videoId
router.delete(
  "/introduction/:videoId",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, videoId } = req.params;

    await candidateService.deleteVideoFile(
      candidateId,
      videoId,
      "introduction"
    );

    res.json({
      success: true,
      message: "Introduction video deleted successfully",
    });
  })
);

// ============================
// GENERAL VIDEO ROUTES
// ============================

// GET /api/candidates/:candidateId/videos/all
router.get(
  "/all",
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const videos = await candidateService.getAllVideos(candidateId);

    res.json({
      success: true,
      message: "All videos retrieved successfully",
      data: {
        interviewVideos: videos.filter((v) => v.videoType === "interview"),
        introductionVideos: videos.filter(
          (v) => v.videoType === "introduction"
        ),
        totalCount: videos.length,
      },
    });
  })
);

// ============================
// VIDEO PROCESSING ROUTES
// ============================

// POST /api/candidates/:candidateId/videos/interview/:videoId/process
router.post(
  "/interview/:videoId/process",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, videoId } = req.params;
    const user = req.user;

    // Get video file
    const { stream, metadata } = await candidateService.getVideoFile(
      candidateId,
      videoId,
      "interview"
    );

    // AI analysis holds the whole video in memory, so large files are refused
    const videoBuffer = await readVideoForAnalysis(res, stream, metadata.size);
    if (!videoBuffer) {
      return;
    }

    // Analyze video with Gemini
    const candidate = await candidateService.getCandidate(candidateId);
    const analysis = await analyzeInterviewVideoWithGemini(
      videoBuffer,
      metadata.contentType,
      candidateId,
      candidate?.name,
      metadata.interviewRound,
      user?.userId,
      user?.email
    );

    // Update video metadata with analysis
    await candidateService.updateVideoAnalysis(
      candidateId,
      videoId,
      "interview",
      analysis
    );

    res.json({
      success: true,
      message: "Interview video processed successfully",
      data: analysis,
    });
  })
);

// POST /api/candidates/:candidateId/videos/introduction/:videoId/process
router.post(
  "/introduction/:videoId/process",
  AuthMiddleware.authenticate,
  CandidateAccessMiddleware.checkCandidateAccess,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, videoId } = req.params;
    const user = req.user;

    // Get video file
    const { stream, metadata } = await candidateService.getVideoFile(
      candidateId,
      videoId,
      "introduction"
    );

    // AI analysis holds the whole video in memory, so large files are refused
    const videoBuffer = await readVideoForAnalysis(res, stream, metadata.size);
    if (!videoBuffer) {
      return;
    }

    // Analyze video with Gemini
    const candidate = await candidateService.getCandidate(candidateId);
    const analysis = await analyzeIntroductionVideoWithGemini(
      videoBuffer,
      metadata.contentType,
      candidateId,
      candidate?.name,
      user?.userId,
      user?.email
    );

    // Update video metadata with analysis
    await candidateService.updateVideoAnalysis(
      candidateId,
      videoId,
      "introduction",
      analysis
    );

    res.json({
      success: true,
      message: "Introduction video processed successfully",
      data: analysis,
    });
  })
);

export default router;
