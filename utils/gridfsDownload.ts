// =======================
// GRIDFS DOWNLOAD HELPER
// =======================
// Purpose: Stream a candidate-owned GridFS file to an authenticated user after
//          checking they can access the owning candidate.
// Related: routes/files.ts, routes/candidates.ts, CandidateAccessMiddleware
// =======================

import { Response } from "express";
import { GridFSBucket, ObjectId } from "mongodb";
import { connectDB } from "../mongo_db";
import { AuthenticatedRequest } from "../routes/middleware/auth";
import { CandidateAccessMiddleware } from "../routes/middleware/candidateAccess";
import { UserRole } from "../Models/User";
import { AuditLogger } from "./AuditLogger";
import { AuditEventType } from "../types/AuditEventTypes";

// Headers that stop browsers, proxies and CDNs from caching sensitive files
export const PRIVATE_FILE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

interface GridFSDownloadOptions {
  bucketName: string;
  fileType: string;
  notFoundMessage?: string;
}

export const streamCandidateFile = async (
  req: AuthenticatedRequest,
  res: Response,
  { bucketName, fileType, notFoundMessage = "File not found" }: GridFSDownloadOptions
) => {
  const { fileId } = req.params;
  const user = req.user!;

  if (!ObjectId.isValid(fileId)) {
    return res.status(404).json({ success: false, message: notFoundMessage });
  }

  const db = await connectDB();
  const bucket = new GridFSBucket(db, { bucketName });
  const objectId = new ObjectId(fileId);
  const files = await bucket.find({ _id: objectId }).toArray();

  if (!files || files.length === 0) {
    return res.status(404).json({ success: false, message: notFoundMessage });
  }

  const file = files[0];
  const candidateId: string | undefined = file.metadata?.candidateId || undefined;

  // Files must belong to a candidate the user can access. Orphaned files are
  // only visible to roles that can see every candidate anyway.
  if (candidateId) {
    const access = await CandidateAccessMiddleware.getCandidateAccess(user, candidateId);
    if (access !== "allowed") {
      // Same response for "missing" and "forbidden" so IDs can't be probed
      return res.status(404).json({ success: false, message: notFoundMessage });
    }
  } else if (user.role !== UserRole.ADMIN && user.role !== UserRole.HR_MANAGER) {
    return res.status(404).json({ success: false, message: notFoundMessage });
  }

  await AuditLogger.logFileOperation({
    eventType: AuditEventType.FILE_DOWNLOADED,
    fileId,
    fileName: file.filename,
    fileType,
    candidateId,
    userId: user.userId,
    userEmail: user.email,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    action: "download",
    metadata: {
      contentType: file.metadata?.contentType || file.contentType,
      size: file.length,
    },
  });

  // res.attachment() encodes the user-supplied filename safely (RFC 6266/5987).
  // Called first because it also guesses Content-Type, which we then override.
  res.attachment(file.filename);
  res.set({
    ...PRIVATE_FILE_HEADERS,
    "Content-Type":
      file.metadata?.contentType || file.contentType || "application/octet-stream",
    "Content-Length": file.length.toString(),
  });

  const downloadStream = bucket.openDownloadStream(objectId);
  downloadStream.on("error", (error) => {
    console.error(`${fileType} file stream error:`, error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Error streaming file" });
    } else {
      res.destroy(error);
    }
  });
  downloadStream.pipe(res);
};
