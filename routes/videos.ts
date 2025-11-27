import express, { Request, Response } from "express";
import multer from "multer";
import { CandidateService } from "../services";
import { candidateExists } from "./middleware/candidateExists";
import { validation } from "./middleware/validation";
import { asyncHandler } from "./middleware/errorHandler";
import { AuthMiddleware, AuthenticatedRequest } from "./middleware/auth";

import { OK, CREATED, BAD_REQUEST, UNAUTHORIZED, NOT_FOUND } from "../constants/HttpStatusCodes";
const router = express.Router({ mergeParams: true });
const candidateService = new CandidateService();

// Configure multer for video file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for video files
  },
  fileFilter: (req, file, cb) => {
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
      cb(new Error("Invalid file type. Only video files are allowed."));
    }
  },
});

// ============================
// INTERVIEW VIDEO ROUTES
// ============================

// POST /api/candidates/:candidateId/videos/interview/upload
router.post(
  "/interview/upload",
  upload.single("video"),
  candidateExists,
  validation.validateVideoFile,
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
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const videos = await candidateService.getAllVideos(
      candidateId,
      "interview"
    );

    res.json({
      success: true,
      message: "Interview videos retrieved successfully",
      data: videos.interviewVideos,
    });
  })
);

// GET /api/candidates/:candidateId/videos/interview/:videoId
router.get(
  "/interview/:videoId",
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, videoId } = req.params;
    const { stream, metadata } = await candidateService.getVideoFile(
      candidateId,
      videoId,
      "interview"
    );

    res.set({
      "Content-Type": metadata.contentType,
      "Content-Disposition": `attachment; filename="${metadata.filename}"`,
      "Content-Length": metadata.size.toString(),
    });

    stream.pipe(res);
  })
);

// GET /api/candidates/:candidateId/videos/interview/:videoId/download
router.get(
  "/interview/:videoId/download",
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, videoId } = req.params;
    const { stream, metadata } = await candidateService.getVideoFile(
      candidateId,
      videoId,
      "interview"
    );

    res.set({
      "Content-Type": metadata.contentType,
      "Content-Disposition": `attachment; filename="${metadata.filename}"`,
      "Content-Length": metadata.size.toString(),
    });

    stream.pipe(res);
  })
);

// GET /api/candidates/:candidateId/videos/interview/:videoId/metadata
router.get(
  "/interview/:videoId/metadata",
  candidateExists,
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
  upload.single("video"),
  candidateExists,
  validation.validateVideoFile,
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
  candidateExists,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, videoId } = req.params;
    const user = req.user;
    
    await candidateService.deleteVideoFile(
      candidateId, 
      videoId, 
      "interview",
      user?.userId,
      user?.email
    );

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
  upload.single("video"),
  candidateExists,
  validation.validateVideoFile,
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
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const videos = await candidateService.getAllVideos(
      candidateId,
      "introduction"
    );

    res.json({
      success: true,
      message: "Introduction videos retrieved successfully",
      data: videos.introductionVideos,
    });
  })
);

// GET /api/candidates/:candidateId/videos/introduction/:videoId
router.get(
  "/introduction/:videoId",
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, videoId } = req.params;
    const { stream, metadata } = await candidateService.getVideoFile(
      candidateId,
      videoId,
      "introduction"
    );

    res.set({
      "Content-Type": metadata.contentType,
      "Content-Disposition": `attachment; filename="${metadata.filename}"`,
      "Content-Length": metadata.size.toString(),
    });

    stream.pipe(res);
  })
);

// GET /api/candidates/:candidateId/videos/introduction/:videoId/download
router.get(
  "/introduction/:videoId/download",
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, videoId } = req.params;
    const { stream, metadata } = await candidateService.getVideoFile(
      candidateId,
      videoId,
      "introduction"
    );

    res.set({
      "Content-Type": metadata.contentType,
      "Content-Disposition": `attachment; filename="${metadata.filename}"`,
      "Content-Length": metadata.size.toString(),
    });

    stream.pipe(res);
  })
);

// GET /api/candidates/:candidateId/videos/introduction/:videoId/metadata
router.get(
  "/introduction/:videoId/metadata",
  candidateExists,
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
  upload.single("video"),
  candidateExists,
  validation.validateVideoFile,
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
  candidateExists,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { candidateId, videoId } = req.params;
    const user = req.user;
    
    await candidateService.deleteVideoFile(
      candidateId,
      videoId,
      "introduction",
      user?.userId,
      user?.email
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
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const videos = await candidateService.getAllVideos(candidateId);

    res.json({
      success: true,
      message: "All videos retrieved successfully",
      data: {
        interviewVideos: videos.interviewVideos,
        introductionVideos: videos.introductionVideos,
        totalCount:
          videos.interviewVideos.length + videos.introductionVideos.length,
      },
    });
  })
);

export default router;
