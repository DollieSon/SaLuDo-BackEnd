import { connectDB } from "../../mongo_db";
import {
  PersonalInfoRepository,
  ResumeRepository,
  InterviewRepository,
} from "../../repositories/CandidateRepository";
import {
  ResumeMetadata,
  TranscriptMetadata,
  VideoMetadata,
} from "../../Models/Candidate";
import { Personality } from "../../Models/Personality";
import { GridFSBucket, ObjectId } from "mongodb";
import { AuditLogger } from "../../utils/AuditLogger";
import { AuditEventType } from "../../types/AuditEventTypes";
import { NotificationService } from "../NotificationService";
import { NotificationType } from "../../Models/enums/NotificationTypes";
import { getAssignedHRUsers } from "../../utils/NotificationHelpers";
import {
  ERROR_MESSAGES,
  BUCKET_NAMES,
  DEFAULT_VALUES,
  FILE_TYPES,
  PROCESSING_STATUS,
  ALLOWED_FILE_TYPES,
  FILE_SIZE_LIMITS,
  LOG_MESSAGES,
  NOTIFICATION_ERROR_MESSAGES,
  ACTIONS,
} from "../../constants/CandidateServiceConstants";

export class CandidateFileService {
  constructor(
    private personalInfoRepo: PersonalInfoRepository,
    private resumeRepo: ResumeRepository,
    private interviewRepo: InterviewRepository,
    private notificationService: NotificationService | null = null
  ) {}

  // ============================
  // RESUME FILE OPERATIONS
  // ============================

  async getResumeFile(
    candidateId: string
  ): Promise<{ stream: any; metadata: any } | null> {
    try {
      const resumeData = await this.resumeRepo.findById(candidateId);
      if (!resumeData?.resume) {
        return null;
      }
      const db = await connectDB();
      const bucket = new GridFSBucket(db, { bucketName: "resumes" });
      const fileId = new ObjectId(resumeData.resume.fileId);
      const fileInfo = await db
        .collection("resumes.files")
        .findOne({ _id: fileId });
      if (!fileInfo) {
        return null;
      }
      const downloadStream = bucket.openDownloadStream(fileId);
      return {
        stream: downloadStream,
        metadata: {
          filename: resumeData.resume.filename,
          contentType: resumeData.resume.contentType,
          size: resumeData.resume.size,
        },
      };
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_RESUME_FILE, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_RETRIEVE_RESUME_FILE);
    }
  }

  async updateResumeFile(
    candidateId: string,
    resumeFile: Express.Multer.File,
    userId?: string,
    userEmail?: string
  ): Promise<void> {
    try {
      const personalInfo = await this.personalInfoRepo.findById(candidateId);
      if (!personalInfo) {
        throw new Error("Candidate not found");
      }

      const resumeData = await this.resumeRepo.findById(candidateId);
      if (!resumeData) {
        throw new Error("Candidate not found");
      }
      const db = await connectDB();
      const bucket = new GridFSBucket(db, { bucketName: BUCKET_NAMES.RESUMES });

      // Delete old file if exists
      if (resumeData.resume?.fileId) {
        try {
          await bucket.delete(new ObjectId(resumeData.resume.fileId));
        } catch (error) {
          console.log(LOG_MESSAGES.OLD_RESUME_FILE_NOT_FOUND);
        }
      }

      // Upload new file
      const uploadStream = bucket.openUploadStream(resumeFile.originalname, {
        metadata: {
          contentType: resumeFile.mimetype,
          uploadedBy: DEFAULT_VALUES.UPLOADED_BY,
          candidateId: candidateId,
        },
      });
      const fileId = uploadStream.id;
      uploadStream.end(resumeFile.buffer);

      // Wait for upload to complete
      await new Promise((resolve, reject) => {
        uploadStream.on("finish", resolve);
        uploadStream.on("error", reject);
      });

      // Update resume metadata
      const newResumeMetadata: ResumeMetadata = {
        fileId: fileId.toString(),
        filename: resumeFile.originalname,
        contentType: resumeFile.mimetype,
        size: resumeFile.size,
        uploadedAt: new Date(),
        parseStatus: PROCESSING_STATUS.PENDING,
      };
      await this.resumeRepo.update(candidateId, {
        resume: newResumeMetadata,
      });

      // Log document upload
      await AuditLogger.logFileOperation({
        eventType: AuditEventType.CANDIDATE_DOCUMENT_UPLOADED,
        fileId: fileId.toString(),
        fileName: resumeFile.originalname,
        fileType: FILE_TYPES.RESUME,
        candidateId: candidateId,
        userId,
        userEmail,
        action: ACTIONS.UPLOAD,
        metadata: {
          candidateName: personalInfo.name,
          contentType: resumeFile.mimetype,
          size: resumeFile.size,
        },
      });

      // Notify assigned HR users about document upload
      if (this.notificationService) {
        try {
          const assignedUsers = await getAssignedHRUsers(candidateId);
          for (const hrUser of assignedUsers) {
            await this.notificationService.notifyCandidateEvent(
              NotificationType.CANDIDATE_DOCUMENT_UPLOADED,
              hrUser.userId,
              candidateId,
              personalInfo.name,
              {
                documentType: "resume",
                fileName: resumeFile.originalname,
                fileSize: resumeFile.size,
              }
            );
          }
        } catch (notifError) {
          console.error(
            NOTIFICATION_ERROR_MESSAGES.CANDIDATE_DOCUMENT_UPLOADED,
            notifError
          );
        }
      }
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_UPDATING_RESUME_FILE, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_UPDATE_RESUME_FILE);
    }
  }

  async deleteResumeFile(
    candidateId: string,
    candidateName: string,
    userId?: string,
    userEmail?: string
  ): Promise<void> {
    try {
      const resumeData = await this.resumeRepo.findById(candidateId);
      if (!resumeData?.resume) {
        return; // No resume to delete
      }
      const db = await connectDB();
      const bucket = new GridFSBucket(db, { bucketName: "resumes" });

      // Delete file from GridFS
      await bucket.delete(new ObjectId(resumeData.resume.fileId));

      // Update resume data to remove metadata
      await this.resumeRepo.update(candidateId, {
        resume: undefined,
      });

      // Log audit event
      await AuditLogger.logFileOperation({
        eventType: AuditEventType.CANDIDATE_DOCUMENT_DELETED,
        fileId: resumeData.resume.fileId,
        candidateId,
        fileName: resumeData.resume.filename,
        fileType: FILE_TYPES.RESUME,
        userId,
        userEmail,
        action: `${ACTIONS.DELETED_RESUME_FILE}: ${resumeData.resume.filename}`,
        metadata: { candidateName },
      });
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_DELETING_RESUME_FILE, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_DELETE_RESUME_FILE);
    }
  }

  async hasResume(candidateId: string): Promise<boolean> {
    try {
      const resumeData = await this.resumeRepo.findById(candidateId);
      return !!resumeData?.resume?.fileId;
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_CHECKING_RESUME_EXISTENCE, error);
      return false;
    }
  }

  async getResumeMetadata(candidateId: string): Promise<ResumeMetadata | null> {
    try {
      const resumeData = await this.resumeRepo.findById(candidateId);
      return resumeData?.resume || null;
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_RESUME_METADATA, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_RETRIEVE_RESUME_METADATA);
    }
  }

  // ============================
  // TRANSCRIPT FILE OPERATIONS
  // ============================

  async addTranscriptFile(
    candidateId: string,
    transcriptFile: Express.Multer.File,
    metadata?: Partial<TranscriptMetadata>
  ): Promise<TranscriptMetadata> {
    try {
      // Validate file
      this.validateTranscriptFile(transcriptFile);
      const db = await connectDB();
      const bucket = new GridFSBucket(db, { bucketName: BUCKET_NAMES.TRANSCRIPTS });

      // Upload file to GridFS
      const uploadStream = bucket.openUploadStream(
        transcriptFile.originalname,
        {
          metadata: {
            contentType: transcriptFile.mimetype,
            uploadedBy: DEFAULT_VALUES.UPLOADED_BY,
            candidateId: candidateId,
            interviewRound: metadata?.interviewRound || DEFAULT_VALUES.INTERVIEW_ROUND,
            duration: metadata?.duration,
          },
        }
      );
      const fileId = uploadStream.id;
      uploadStream.end(transcriptFile.buffer);

      // Wait for upload to complete
      await new Promise((resolve, reject) => {
        uploadStream.on("finish", resolve);
        uploadStream.on("error", reject);
      });

      const transcriptMetadata: TranscriptMetadata = {
        fileId: fileId.toString(),
        filename: transcriptFile.originalname,
        contentType: transcriptFile.mimetype,
        size: transcriptFile.size,
        uploadedAt: new Date(),
        transcriptionStatus: "not_started",
        interviewRound: metadata?.interviewRound || "general",
        duration: metadata?.duration,
        ...metadata,
      };

      // Get current interview data
      const interviewData = await this.interviewRepo.findById(candidateId);
      const currentTranscripts: TranscriptMetadata[] = Array.isArray(
        interviewData?.transcripts
      )
        ? interviewData.transcripts.filter(
            (t): t is TranscriptMetadata => typeof t === "object"
          )
        : [];

      // Add new transcript metadata
      const updatedTranscripts = [...currentTranscripts, transcriptMetadata];

      // Update interview data
      await this.interviewRepo.update(candidateId, {
        transcripts: updatedTranscripts,
        dateUpdated: new Date(),
      });

      return transcriptMetadata;
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_ADDING_TRANSCRIPT_FILE, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_ADD_TRANSCRIPT_FILE);
    }
  }

  async getTranscriptFile(
    candidateId: string,
    transcriptId: string
  ): Promise<{ stream: any; metadata: TranscriptMetadata }> {
    try {
      const db = await connectDB();
      const bucket = new GridFSBucket(db, { bucketName: BUCKET_NAMES.TRANSCRIPTS });

      // Get transcript metadata first
      const interviewData = await this.interviewRepo.findById(candidateId);
      const transcript = interviewData?.transcripts?.find(
        (t) => t.fileId === transcriptId
      );
      if (!transcript) {
        throw new Error(ERROR_MESSAGES.TRANSCRIPT_NOT_FOUND);
      }

      // Create download stream
      const downloadStream = bucket.openDownloadStream(
        new ObjectId(transcriptId)
      );

      return {
        stream: downloadStream,
        metadata: transcript,
      };
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_TRANSCRIPT_FILE, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_RETRIEVE_TRANSCRIPT_FILE);
    }
  }

  async updateTranscriptFile(
    candidateId: string,
    transcriptId: string,
    transcriptFile: Express.Multer.File,
    metadata?: Partial<TranscriptMetadata>
  ): Promise<TranscriptMetadata> {
    try {
      // Validate file
      this.validateTranscriptFile(transcriptFile);

      const db = await connectDB();
      const bucket = new GridFSBucket(db, { bucketName: BUCKET_NAMES.TRANSCRIPTS });

      // Delete old file
      await bucket.delete(new ObjectId(transcriptId));

      // Upload new file
      const uploadStream = bucket.openUploadStream(
        transcriptFile.originalname,
        {
          metadata: {
            contentType: transcriptFile.mimetype,
            uploadedBy: DEFAULT_VALUES.UPLOADED_BY,
            candidateId: candidateId,
            interviewRound: metadata?.interviewRound || DEFAULT_VALUES.INTERVIEW_ROUND,
            duration: metadata?.duration,
          },
        }
      );
      const fileId = uploadStream.id;
      uploadStream.end(transcriptFile.buffer);

      await new Promise((resolve, reject) => {
        uploadStream.on("finish", resolve);
        uploadStream.on("error", reject);
      });

      const updatedTranscriptMetadata: TranscriptMetadata = {
        fileId: fileId.toString(),
        filename: transcriptFile.originalname,
        contentType: transcriptFile.mimetype,
        size: transcriptFile.size,
        uploadedAt: new Date(),
        transcriptionStatus: PROCESSING_STATUS.NOT_STARTED,
        interviewRound: metadata?.interviewRound || DEFAULT_VALUES.INTERVIEW_ROUND,
        duration: metadata?.duration,
        ...metadata,
      };

      // Update interview data
      const interviewData = await this.interviewRepo.findById(candidateId);
      const currentTranscripts = interviewData?.transcripts || [];
      const updatedTranscripts = currentTranscripts.map((t) =>
        t.fileId === transcriptId ? updatedTranscriptMetadata : t
      );

      await this.interviewRepo.update(candidateId, {
        transcripts: updatedTranscripts,
        dateUpdated: new Date(),
      });

      return updatedTranscriptMetadata;
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_UPDATING_TRANSCRIPT_FILE, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_UPDATE_TRANSCRIPT_FILE);
    }
  }

  async deleteTranscriptFile(
    candidateId: string,
    transcriptId: string
  ): Promise<void> {
    try {
      const db = await connectDB();
      const bucket = new GridFSBucket(db, { bucketName: BUCKET_NAMES.TRANSCRIPTS });

      // Delete file from GridFS
      await bucket.delete(new ObjectId(transcriptId));

      // Update interview data
      const interviewData = await this.interviewRepo.findById(candidateId);
      const currentTranscripts = interviewData?.transcripts || [];
      const updatedTranscripts = currentTranscripts.filter(
        (t) => t.fileId !== transcriptId
      );

      await this.interviewRepo.update(candidateId, {
        transcripts: updatedTranscripts,
        dateUpdated: new Date(),
      });
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_DELETING_TRANSCRIPT_FILE, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_DELETE_TRANSCRIPT_FILE);
    }
  }

  async getAllTranscripts(candidateId: string): Promise<TranscriptMetadata[]> {
    try {
      const interviewData = await this.interviewRepo.findById(candidateId);
      return interviewData?.transcripts || [];
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_ALL_TRANSCRIPTS, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_RETRIEVE_TRANSCRIPTS);
    }
  }

  async getTranscriptMetadata(
    candidateId: string,
    transcriptId: string
  ): Promise<TranscriptMetadata | null> {
    try {
      const interviewData = await this.interviewRepo.findById(candidateId);
      const transcript = interviewData?.transcripts?.find(
        (t) => t.fileId === transcriptId
      );
      return transcript || null;
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_TRANSCRIPT_METADATA, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_RETRIEVE_TRANSCRIPT_METADATA);
    }
  }

  async getTranscriptBuffer(
    candidateId: string,
    transcriptId: string
  ): Promise<Buffer> {
    try {
      const db = await connectDB();
      const bucket = new GridFSBucket(db, { bucketName: BUCKET_NAMES.TRANSCRIPTS });

      const chunks: Buffer[] = [];
      const downloadStream = bucket.openDownloadStream(
        new ObjectId(transcriptId)
      );

      return new Promise((resolve, reject) => {
        downloadStream.on("data", (chunk) => {
          chunks.push(chunk);
        });

        downloadStream.on("end", () => {
          resolve(Buffer.concat(chunks));
        });

        downloadStream.on("error", (error) => {
          reject(error);
        });
      });
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_TRANSCRIPT_BUFFER, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_RETRIEVE_TRANSCRIPT_BUFFER);
    }
  }

  private validateTranscriptFile(file: Express.Multer.File): void {
    if (!(ALLOWED_FILE_TYPES.TRANSCRIPT as readonly string[]).includes(file.mimetype)) {
      throw new Error(ERROR_MESSAGES.INVALID_FILE_TYPE_TRANSCRIPT);
    }
    if (file.size > FILE_SIZE_LIMITS.TRANSCRIPT) {
      throw new Error(ERROR_MESSAGES.FILE_SIZE_TOO_LARGE_TRANSCRIPT);
    }
  }

  // ============================
  // VIDEO FILE OPERATIONS
  // ============================

  async addVideoFile(
    candidateId: string,
    videoFile: Express.Multer.File,
    videoType: "interview" | "introduction",
    metadata?: Partial<VideoMetadata>,
    userId?: string,
    userEmail?: string
  ): Promise<VideoMetadata> {
    try {
      const personalInfo = await this.personalInfoRepo.findById(candidateId);
      if (!personalInfo) {
        throw new Error(ERROR_MESSAGES.CANDIDATE_NOT_FOUND);
      }

      this.validateVideoFile(videoFile);
      const db = await connectDB();
      const bucketName =
        videoType === "interview" ? BUCKET_NAMES.INTERVIEW_VIDEOS : BUCKET_NAMES.INTRODUCTION_VIDEOS;
      const bucket = new GridFSBucket(db, { bucketName });

      const uploadStream = bucket.openUploadStream(videoFile.originalname, {
        metadata: {
          contentType: videoFile.mimetype,
          uploadedBy: DEFAULT_VALUES.UPLOADED_BY,
          candidateId: candidateId,
          videoType: videoType,
          interviewRound: metadata?.interviewRound,
          duration: metadata?.duration,
          resolution: metadata?.resolution,
          frameRate: metadata?.frameRate,
          bitrate: metadata?.bitrate,
        },
      });

      const fileId = uploadStream.id;
      uploadStream.end(videoFile.buffer);

      await new Promise((resolve, reject) => {
        uploadStream.on("finish", resolve);
        uploadStream.on("error", reject);
      });

      const videoMetadata: VideoMetadata = {
        fileId: fileId.toString(),
        filename: videoFile.originalname,
        contentType: videoFile.mimetype,
        size: videoFile.size,
        uploadedAt: new Date(),
        processingStatus: PROCESSING_STATUS.NOT_STARTED,
        videoType: videoType,
        interviewRound: metadata?.interviewRound,
        duration: metadata?.duration,
        resolution: metadata?.resolution,
        frameRate: metadata?.frameRate,
        bitrate: metadata?.bitrate,
        ...metadata,
      };

      const interviewData = await this.interviewRepo.findById(candidateId);
      const currentInterviewVideos: VideoMetadata[] = Array.isArray(
        interviewData?.interviewVideos
      )
        ? interviewData.interviewVideos
        : [];
      const currentIntroVideos: VideoMetadata[] = Array.isArray(
        interviewData?.introductionVideos
      )
        ? interviewData.introductionVideos
        : [];

      if (videoType === "interview") {
        currentInterviewVideos.push(videoMetadata);
      } else {
        currentIntroVideos.push(videoMetadata);
      }

      const updatedInterviewData = {
        candidateId: candidateId,
        interviewVideos: currentInterviewVideos,
        introductionVideos: currentIntroVideos,
        dateUpdated: new Date(),
      };

      const existingData = await this.interviewRepo.findById(candidateId);
      if (existingData) {
        await this.interviewRepo.update(candidateId, updatedInterviewData);
      } else {
        await this.interviewRepo.create({
          ...updatedInterviewData,
          transcripts: [],
          personality: new Personality().toObject(),
        });
      }

      // Log video upload
      await AuditLogger.logFileOperation({
        eventType: AuditEventType.CANDIDATE_VIDEO_UPLOADED,
        fileId: fileId.toString(),
        fileName: videoFile.originalname,
        fileType: videoType === "interview" ? FILE_TYPES.INTERVIEW_VIDEO : FILE_TYPES.INTRODUCTION_VIDEO,
        candidateId: candidateId,
        userId,
        userEmail,
        action: ACTIONS.UPLOAD,
        metadata: {
          candidateName: personalInfo.name,
          videoType,
          contentType: videoFile.mimetype,
          size: videoFile.size,
        },
      });

      return videoMetadata;
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_ADDING_VIDEO_FILE, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_ADD_VIDEO_FILE);
    }
  }

  async getVideoFile(
    candidateId: string,
    videoId: string,
    videoType: "interview" | "introduction"
  ): Promise<{ stream: any; metadata: VideoMetadata }> {
    try {
      const db = await connectDB();
      const bucketName =
        videoType === "interview" ? BUCKET_NAMES.INTERVIEW_VIDEOS : BUCKET_NAMES.INTRODUCTION_VIDEOS;
      const bucket = new GridFSBucket(db, { bucketName });

      const interviewData = await this.interviewRepo.findById(candidateId);
      const videos =
        videoType === "interview"
          ? interviewData?.interviewVideos
          : interviewData?.introductionVideos;
      const video = videos?.find((v) => v.fileId === videoId);

      if (!video) {
        throw new Error(ERROR_MESSAGES.VIDEO_NOT_FOUND);
      }

      const downloadStream = bucket.openDownloadStream(new ObjectId(videoId));

      return {
        stream: downloadStream,
        metadata: video,
      };
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_VIDEO_FILE, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_RETRIEVE_VIDEO_FILE);
    }
  }

  async updateVideoFile(
    candidateId: string,
    videoId: string,
    videoFile: Express.Multer.File,
    videoType: "interview" | "introduction",
    metadata?: Partial<VideoMetadata>
  ): Promise<VideoMetadata> {
    try {
      this.validateVideoFile(videoFile);

      const db = await connectDB();
      const bucketName =
        videoType === "interview" ? BUCKET_NAMES.INTERVIEW_VIDEOS : BUCKET_NAMES.INTRODUCTION_VIDEOS;
      const bucket = new GridFSBucket(db, { bucketName });

      await bucket.delete(new ObjectId(videoId));

      const uploadStream = bucket.openUploadStream(videoFile.originalname, {
        metadata: {
          contentType: videoFile.mimetype,
          uploadedBy: DEFAULT_VALUES.UPLOADED_BY,
          candidateId: candidateId,
          videoType: videoType,
          interviewRound: metadata?.interviewRound,
          duration: metadata?.duration,
          resolution: metadata?.resolution,
          frameRate: metadata?.frameRate,
          bitrate: metadata?.bitrate,
        },
      });

      const fileId = uploadStream.id;
      uploadStream.end(videoFile.buffer);

      await new Promise((resolve, reject) => {
        uploadStream.on("finish", resolve);
        uploadStream.on("error", reject);
      });

      const updatedVideoMetadata: VideoMetadata = {
        fileId: fileId.toString(),
        filename: videoFile.originalname,
        contentType: videoFile.mimetype,
        size: videoFile.size,
        uploadedAt: new Date(),
        processingStatus: PROCESSING_STATUS.NOT_STARTED,
        videoType: videoType,
        interviewRound: metadata?.interviewRound,
        duration: metadata?.duration,
        resolution: metadata?.resolution,
        frameRate: metadata?.frameRate,
        bitrate: metadata?.bitrate,
        ...metadata,
      };

      const interviewData = await this.interviewRepo.findById(candidateId);
      if (videoType === "interview") {
        const updatedVideos =
          interviewData?.interviewVideos?.map((v) =>
            v.fileId === videoId ? updatedVideoMetadata : v
          ) || [];
        await this.interviewRepo.update(candidateId, {
          interviewVideos: updatedVideos,
          dateUpdated: new Date(),
        });
      } else {
        const updatedVideos =
          interviewData?.introductionVideos?.map((v) =>
            v.fileId === videoId ? updatedVideoMetadata : v
          ) || [];
        await this.interviewRepo.update(candidateId, {
          introductionVideos: updatedVideos,
          dateUpdated: new Date(),
        });
      }

      return updatedVideoMetadata;
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_UPDATING_VIDEO_FILE, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_UPDATE_VIDEO_FILE);
    }
  }

  async deleteVideoFile(
    candidateId: string,
    videoId: string,
    videoType: "interview" | "introduction"
  ): Promise<void> {
    try {
      const db = await connectDB();
      const bucketName =
        videoType === "interview" ? BUCKET_NAMES.INTERVIEW_VIDEOS : BUCKET_NAMES.INTRODUCTION_VIDEOS;
      const bucket = new GridFSBucket(db, { bucketName });

      await bucket.delete(new ObjectId(videoId));

      const interviewData = await this.interviewRepo.findById(candidateId);
      if (videoType === "interview") {
        const updatedVideos =
          interviewData?.interviewVideos?.filter((v) => v.fileId !== videoId) ||
          [];
        await this.interviewRepo.update(candidateId, {
          interviewVideos: updatedVideos,
          dateUpdated: new Date(),
        });
      } else {
        const updatedVideos =
          interviewData?.introductionVideos?.filter(
            (v) => v.fileId !== videoId
          ) || [];
        await this.interviewRepo.update(candidateId, {
          introductionVideos: updatedVideos,
          dateUpdated: new Date(),
        });
      }
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_DELETING_VIDEO_FILE, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_DELETE_VIDEO_FILE);
    }
  }

  async getAllVideos(
    candidateId: string,
    videoType?: "interview" | "introduction"
  ): Promise<VideoMetadata[]> {
    try {
      const interviewData = await this.interviewRepo.findById(candidateId);
      if (!videoType) {
        return [
          ...(interviewData?.interviewVideos || []),
          ...(interviewData?.introductionVideos || []),
        ];
      }
      return videoType === "interview"
        ? interviewData?.interviewVideos || []
        : interviewData?.introductionVideos || [];
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_ALL_VIDEOS, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_RETRIEVE_VIDEOS);
    }
  }

  async getVideoMetadata(
    candidateId: string,
    videoId: string,
    videoType: "interview" | "introduction"
  ): Promise<VideoMetadata | null> {
    try {
      const interviewData = await this.interviewRepo.findById(candidateId);
      const videos =
        videoType === "interview"
          ? interviewData?.interviewVideos
          : interviewData?.introductionVideos;
      return videos?.find((v) => v.fileId === videoId) || null;
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_VIDEO_METADATA, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_RETRIEVE_VIDEO_METADATA);
    }
  }

  async getVideoBuffer(
    candidateId: string,
    videoId: string,
    videoType: "interview" | "introduction"
  ): Promise<Buffer> {
    try {
      const db = await connectDB();
      const bucketName =
        videoType === "interview" ? BUCKET_NAMES.INTERVIEW_VIDEOS : BUCKET_NAMES.INTRODUCTION_VIDEOS;
      const bucket = new GridFSBucket(db, { bucketName });

      const chunks: Buffer[] = [];
      const downloadStream = bucket.openDownloadStream(new ObjectId(videoId));

      return new Promise((resolve, reject) => {
        downloadStream.on("data", (chunk) => {
          chunks.push(chunk);
        });

        downloadStream.on("end", () => {
          resolve(Buffer.concat(chunks));
        });

        downloadStream.on("error", (error) => {
          reject(error);
        });
      });
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_VIDEO_BUFFER, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_RETRIEVE_VIDEO_BUFFER);
    }
  }

  private validateVideoFile(file: Express.Multer.File): void {
    if (!(ALLOWED_FILE_TYPES.VIDEO as readonly string[]).includes(file.mimetype)) {
      throw new Error(ERROR_MESSAGES.INVALID_FILE_TYPE_VIDEO);
    }

    if (file.size > FILE_SIZE_LIMITS.VIDEO) {
      throw new Error(ERROR_MESSAGES.FILE_SIZE_TOO_LARGE_VIDEO);
    }
  }
}
