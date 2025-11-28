import { Router, Request, Response } from "express";
import { asyncHandler, errorHandler } from "./middleware/errorHandler";
import { connectDB } from "../mongo_db";
import { GridFSBucket, ObjectId } from "mongodb";
import { AuditLogger } from "../utils/AuditLogger";
import { AuditEventType } from "../types/AuditEventTypes";

const router = Router();

// Serve files from GridFS
router.get(
  "/:fileId",
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
        fileType: 'resume',
        candidateId: file.metadata?.candidateId,
        userId: (req as any).user?.userId || 'anonymous',
        userEmail: (req as any).user?.email || 'anonymous',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        action: 'download',
        metadata: {
          contentType: file.contentType,
          size: file.length
        }
      });

      // Set appropriate headers for download
      res.set({
        'Content-Type': file.contentType || 'application/octet-stream',
        'Content-Length': file.length.toString(),
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      });

      // Stream the file
      const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));
      
      downloadStream.on('error', (error) => {
        console.error('File stream error:', error);
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

// Serve transcript files
router.get(
  "/transcripts/:fileId",
  asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;

    try {
      const db = await connectDB();
      const bucket = new GridFSBucket(db, { bucketName: "transcripts" });

      // Check if file exists
      const files = await bucket.find({ _id: new ObjectId(fileId) }).toArray();
      
      if (!files || files.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Transcript file not found",
        });
      }

      const file = files[0];

      // Log transcript file download
      await AuditLogger.logFileOperation({
        eventType: AuditEventType.FILE_DOWNLOADED,
        fileId: fileId,
        fileName: file.filename,
        fileType: 'transcript',
        candidateId: file.metadata?.candidateId,
        userId: (req as any).user?.userId || 'anonymous',
        userEmail: (req as any).user?.email || 'anonymous',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        action: 'download',
        metadata: {
          contentType: file.contentType,
          size: file.length
        }
      });

      // Set appropriate headers for download
      res.set({
        'Content-Type': file.contentType || 'application/octet-stream',
        'Content-Length': file.length.toString(),
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Cache-Control': 'public, max-age=31536000',
      });

      // Stream the file
      const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));
      
      downloadStream.on('error', (error) => {
        console.error('Transcript file stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: "Error streaming transcript file",
          });
        }
      });

      downloadStream.pipe(res);

    } catch (error) {
      console.error("Error serving transcript file:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  })
);

router.use(errorHandler);
export default router;
