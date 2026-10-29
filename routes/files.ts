import { Router, Response } from "express";
import { asyncHandler, errorHandler } from "./middleware/errorHandler";
import { AuthMiddleware, AuthenticatedRequest } from "./middleware/auth";
import { streamCandidateFile } from "../utils/gridfsDownload";

const router = Router();

// Every file route requires an authenticated user with access to the owning candidate
router.use(AuthMiddleware.authenticate);

// Serve resume files from GridFS
router.get(
  "/:fileId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await streamCandidateFile(req, res, {
      bucketName: "resumes",
      fileType: "resume",
    });
  })
);

// Serve transcript files
router.get(
  "/transcripts/:fileId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await streamCandidateFile(req, res, {
      bucketName: "transcripts",
      fileType: "transcript",
      notFoundMessage: "Transcript file not found",
    });
  })
);

router.use(errorHandler);
export default router;
