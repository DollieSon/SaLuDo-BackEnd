// =======================
// UPLOAD SECURITY MIDDLEWARE
// =======================
// Purpose: Bounded multer instances, disk-backed video uploads (so large files
//          never sit in RAM), magic-byte checks against the declared MIME type,
//          and temp-file cleanup.
// Related: routes/candidates.ts, routes/transcripts.ts, routes/videos.ts, routes/users.ts
// =======================

import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { Request, Response, NextFunction } from "express";

const MB = 1024 * 1024;

export const UPLOAD_LIMITS = {
  RESUME: 10 * MB,
  TRANSCRIPT: 50 * MB,
  VIDEO: 500 * MB,
  PHOTO: 5 * MB,
} as const;

// AI video analysis holds the whole file in memory while sending it to Gemini,
// so it is limited well below the upload limit (Render's free plan has 512 MB
// of RAM). Override with VIDEO_ANALYSIS_MAX_MB.
const DEFAULT_VIDEO_ANALYSIS_MAX_MB = 100;
export const getVideoAnalysisMaxBytes = (): number => {
  const configured = Number(process.env.VIDEO_ANALYSIS_MAX_MB);
  const megabytes =
    Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_VIDEO_ANALYSIS_MAX_MB;
  return Math.floor(megabytes * MB);
};

/**
 * Read a stream into memory, giving up (and returning null) as soon as it
 * exceeds maxBytes, so a mislabelled size can't exhaust memory.
 */
export const readStreamWithLimit = async (
  stream: AsyncIterable<Buffer | Uint8Array>,
  maxBytes: number
): Promise<Buffer | null> => {
  const chunks: Buffer[] = [];
  let total = 0;
  // Leaving the loop early destroys the underlying stream
  for await (const chunk of stream) {
    total += chunk.length;
    if (total > maxBytes) {
      return null;
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const UPLOAD_TMP_DIR = path.join(os.tmpdir(), "saludo-uploads");

// In-memory upload for small files (resumes, transcripts, photos)
export const createMemoryUpload = (maxFileSize: number) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize, files: 1, fields: 20, fieldSize: 64 * 1024 },
  });

// Disk-backed upload for large files: the body is streamed to a temp file
export const createDiskUpload = (
  maxFileSize: number,
  fileFilter?: multer.Options["fileFilter"]
) =>
  multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdir(UPLOAD_TMP_DIR, { recursive: true }, (err) => cb(err, UPLOAD_TMP_DIR));
      },
      // Never use the client-supplied name on disk
      filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
    }),
    limits: { fileSize: maxFileSize, files: 1, fields: 20, fieldSize: 64 * 1024 },
    fileFilter,
  });

// Remove a disk-backed upload once the response is done, whatever the outcome
export const cleanupTempUpload = (req: Request, res: Response, next: NextFunction): void => {
  const remove = () => {
    const filePath = req.file?.path;
    if (filePath) {
      fs.unlink(filePath, () => undefined);
    }
  };
  res.once("finish", remove);
  res.once("close", remove);
  next();
};

// =======================
// MAGIC BYTE CHECKS
// =======================

type Signature = (head: Buffer) => boolean;

const startsWith = (head: Buffer, bytes: number[], offset = 0) =>
  head.length >= offset + bytes.length &&
  bytes.every((byte, i) => head[offset + i] === byte);

const ascii = (head: Buffer, text: string, offset = 0) =>
  head.length >= offset + text.length &&
  head.toString("latin1", offset, offset + text.length) === text;

const isRiff = (head: Buffer, form: string) => ascii(head, "RIFF") && ascii(head, form, 8);

// ISO base media (MP4/MOV/M4V/M4A): box type at offset 4
const isIsoMedia: Signature = (head) =>
  ["ftyp", "moov", "mdat", "wide", "free", "skip"].some((box) => ascii(head, box, 4));
const isMatroska: Signature = (head) => startsWith(head, [0x1a, 0x45, 0xdf, 0xa3]);
const isAsf: Signature = (head) => startsWith(head, [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11]);
const isPdf: Signature = (head) => ascii(head, "%PDF-");
const isZip: Signature = (head) => startsWith(head, [0x50, 0x4b, 0x03, 0x04]);
const isOle: Signature = (head) => startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const isMp3: Signature = (head) =>
  ascii(head, "ID3") || (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0);
const isPlainText: Signature = (head) => head.length > 0 && !head.includes(0x00);

const SIGNATURES: Record<string, Signature> = {
  // documents
  "application/pdf": isPdf,
  "application/msword": isOle,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": isZip,
  "text/plain": isPlainText,
  // audio
  "audio/mpeg": isMp3,
  "audio/wav": (head) => isRiff(head, "WAVE"),
  "audio/mp4": isIsoMedia,
  "audio/ogg": (head) => ascii(head, "OggS"),
  // video
  "video/mp4": isIsoMedia,
  "video/m4v": isIsoMedia,
  "video/mov": isIsoMedia,
  "video/quicktime": isIsoMedia,
  "video/webm": isMatroska,
  "video/mkv": isMatroska,
  "video/x-matroska": isMatroska,
  "video/avi": (head) => isRiff(head, "AVI "),
  "video/x-msvideo": (head) => isRiff(head, "AVI "),
  "video/wmv": isAsf,
  "video/x-ms-wmv": isAsf,
  "video/flv": (head) => ascii(head, "FLV"),
  "video/x-flv": (head) => ascii(head, "FLV"),
  // images
  "image/jpeg": (head) => startsWith(head, [0xff, 0xd8, 0xff]),
  "image/png": (head) => startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/webp": (head) => isRiff(head, "WEBP"),
};

const HEAD_BYTES = 4096;

const readHead = async (file: Express.Multer.File): Promise<Buffer> => {
  if (file.buffer) {
    return file.buffer.subarray(0, HEAD_BYTES);
  }
  if (file.path) {
    const handle = await fs.promises.open(file.path, "r");
    try {
      const head = Buffer.alloc(HEAD_BYTES);
      const { bytesRead } = await handle.read(head, 0, HEAD_BYTES, 0);
      return head.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }
  return Buffer.alloc(0);
};

/**
 * Check that the uploaded file's content matches its declared MIME type.
 * Unknown MIME types are rejected; the per-route validators still decide
 * which types are allowed at all.
 */
export const fileContentMatchesType = async (file: Express.Multer.File): Promise<boolean> => {
  const signature = SIGNATURES[file.mimetype];
  if (!signature) return false;
  return signature(await readHead(file));
};

// Middleware form, for routes where a file is optional or required
export const verifyFileSignature = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.file && !(await fileContentMatchesType(req.file))) {
      res.status(400).json({
        success: false,
        message: "File content does not match its declared type.",
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};
