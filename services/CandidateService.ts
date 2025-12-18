import { connectDB } from "../mongo_db";
import {
  PersonalInfoRepository,
  ResumeRepository,
  InterviewRepository,
} from "../repositories/CandidateRepository";
import { UserRepository } from "../repositories/UserRepository";
import {
  Candidate,
  CandidateData,
  CandidateStatus,
  ResumeMetadata,
  TranscriptMetadata,
  VideoMetadata,
  StatusHistoryEntry,
} from "../Models/Candidate";
import { Skill } from "../Models/Skill";
import { Experience } from "../Models/Experience";
import { Education } from "../Models/Education";
import { Certification } from "../Models/Certification";
import { StrengthWeakness } from "../Models/StrengthWeakness";
import { Personality, PersonalityData } from "../Models/Personality";
import { GridFSBucket, ObjectId } from "mongodb";
import { AuditLogger } from "../utils/AuditLogger";
import { AuditEventType } from "../types/AuditEventTypes";
import { NotificationService } from "./NotificationService";
import { NotificationType } from "../Models/enums/NotificationTypes";
import {
  getAllHRUsers,
  getAssignedHRUsers,
} from "../utils/NotificationHelpers";
import {
  ERROR_MESSAGES,
  ACTIONS,
  COLLECTION_NAMES,
  BUCKET_NAMES,
  DEFAULT_VALUES,
  FILE_TYPES,
  PROCESSING_STATUS,
  METADATA_FIELDS,
  NOTIFICATION_ERROR_MESSAGES,
  LOG_MESSAGES,
} from "../constants/CandidateServiceConstants";

// Import specialized services
import { CandidateFileService } from "./candidates/CandidateFileService";
import { CandidatePersonalityService } from "./candidates/CandidatePersonalityService";
import { CandidateAssignmentService } from "./candidates/CandidateAssignmentService";

export class CandidateService {
  private personalInfoRepo: PersonalInfoRepository;
  private resumeRepo: ResumeRepository;
  private interviewRepo: InterviewRepository;
  private userRepo: UserRepository;
  private notificationService: NotificationService | null = null;

  // Specialized services
  private fileService: CandidateFileService;
  private personalityService: CandidatePersonalityService;
  private assignmentService: CandidateAssignmentService;

  constructor() {
    this.personalInfoRepo = null as any;
    this.resumeRepo = null as any;
    this.interviewRepo = null as any;
    this.userRepo = null as any;
    this.fileService = null as any;
    this.personalityService = null as any;
    this.assignmentService = null as any;
  }

  async init(): Promise<void> {
    const db = await connectDB();
    this.personalInfoRepo = new PersonalInfoRepository(db);
    this.resumeRepo = new ResumeRepository(db);
    this.interviewRepo = new InterviewRepository(db);
    this.userRepo = new UserRepository(db);

    // Initialize NotificationService
    if (!this.notificationService) {
      const { NotificationRepository } = await import(
        "../repositories/NotificationRepository"
      );
      const { NotificationPreferencesRepository } = await import(
        "../repositories/NotificationPreferencesRepository"
      );
      const { WebhookRepository } = await import(
        "../repositories/WebhookRepository"
      );

      const notificationRepo = new NotificationRepository(
        db.collection(COLLECTION_NAMES.NOTIFICATIONS)
      );
      const preferencesRepo = new NotificationPreferencesRepository(
        db.collection(COLLECTION_NAMES.NOTIFICATION_PREFERENCES)
      );
      const webhookRepo = new WebhookRepository(
        db.collection(COLLECTION_NAMES.WEBHOOKS)
      );

      this.notificationService = new NotificationService(
        notificationRepo,
        preferencesRepo,
        webhookRepo
      );
    }

    // Initialize specialized services
    this.fileService = new CandidateFileService(
      this.personalInfoRepo,
      this.resumeRepo,
      this.interviewRepo,
      this.notificationService
    );

    this.personalityService = new CandidatePersonalityService(
      this.interviewRepo
    );

    this.assignmentService = new CandidateAssignmentService(
      this.personalInfoRepo,
      this.userRepo,
      this.notificationService,
      this.getCandidate.bind(this)
    );
  }

  // ============================
  // CORE CANDIDATE CRUD
  // ============================

  async addCandidate(
    name: string,
    email: string[],
    birthdate: Date,
    roleApplied: string | null = null,
    resumeFile?: Express.Multer.File,
    userId?: string,
    userEmail?: string,
    socialLinks?: any[]
  ): Promise<Candidate> {
    await this.init();
    try {
      let resumeMetadata: ResumeMetadata | undefined;
      let uploadedFileId: string | undefined;

      if (resumeFile) {
        const db = await connectDB();
        const bucket = new GridFSBucket(db, {
          bucketName: BUCKET_NAMES.RESUMES,
        });
        const uploadStream = bucket.openUploadStream(resumeFile.originalname, {
          metadata: {
            contentType: resumeFile.mimetype,
            uploadedBy: DEFAULT_VALUES.UPLOADED_BY,
            candidateId: "",
          },
        });
        const fileId = uploadStream.id;
        uploadStream.end(resumeFile.buffer);
        await new Promise((resolve, reject) => {
          uploadStream.on("finish", resolve);
          uploadStream.on("error", reject);
        });
        uploadedFileId = fileId.toString();
        resumeMetadata = {
          fileId: uploadedFileId,
          filename: resumeFile.originalname,
          contentType: resumeFile.mimetype,
          size: resumeFile.size,
          uploadedAt: new Date(),
          parseStatus: PROCESSING_STATUS.PENDING,
        };
      }

      const personalInfo = await this.personalInfoRepo.create({
        name,
        email,
        birthdate,
        roleApplied,
        status: CandidateStatus.APPLIED,
        isDeleted: false,
        assignedHRUserIds: [],
        lastAssignedAt: null,
        lastAssignedBy: null,
        socialLinks: socialLinks || [],
      });

      await this.resumeRepo.create({
        candidateId: personalInfo.candidateId,
        resume: resumeMetadata,
        skills: [],
        experience: [],
        education: [],
        certification: [],
        strengths: [],
        weaknesses: [],
      });

      if (resumeMetadata && uploadedFileId) {
        const db = await connectDB();
        await db
          .collection(COLLECTION_NAMES.RESUMES_FILES)
          .updateOne(
            { _id: new ObjectId(resumeMetadata.fileId) },
            { $set: { "metadata.candidateId": personalInfo.candidateId } }
          );

        await AuditLogger.logFileOperation({
          eventType: AuditEventType.CANDIDATE_DOCUMENT_UPLOADED,
          fileId: uploadedFileId,
          fileName: resumeMetadata.filename,
          fileType: FILE_TYPES.RESUME,
          candidateId: personalInfo.candidateId,
          userId,
          userEmail,
          action: ACTIONS.UPLOAD,
          metadata: {
            candidateName: name,
            contentType: resumeMetadata.contentType,
            size: resumeMetadata.size,
          },
        });
      }

      await this.interviewRepo.create({
        candidateId: personalInfo.candidateId,
        transcripts: [],
        interviewVideos: [],
        introductionVideos: [],
        personality: new Personality().toObject(),
      });

      const candidate = new Candidate(
        personalInfo.candidateId,
        name,
        email,
        birthdate,
        roleApplied,
        resumeMetadata,
        CandidateStatus.APPLIED,
        personalInfo.dateCreated,
        personalInfo.dateUpdated,
        [],
        null,
        null,
        socialLinks || []
      );

      await AuditLogger.logCandidateOperation({
        eventType: AuditEventType.CANDIDATE_CREATED,
        candidateId: personalInfo.candidateId,
        candidateName: name,
        action: ACTIONS.CREATED_NEW_CANDIDATE,
        newValue: { name, email, status: CandidateStatus.APPLIED, roleApplied },
        metadata: { hasResume: !!resumeFile },
      });

      if (this.notificationService) {
        try {
          const hrUsers = await getAllHRUsers();
          for (const hrUser of hrUsers) {
            await this.notificationService.notifyCandidateEvent(
              NotificationType.CANDIDATE_APPLIED,
              hrUser.userId,
              personalInfo.candidateId,
              name,
              {
                roleApplied: roleApplied || DEFAULT_VALUES.ROLE_APPLIED,
                hasResume: !!resumeMetadata,
                email: email[0],
              }
            );
          }
        } catch (notifError) {
          console.error(
            NOTIFICATION_ERROR_MESSAGES.CANDIDATE_APPLIED,
            notifError
          );
        }
      }

      return candidate;
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_ADDING_CANDIDATE, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_ADD_CANDIDATE);
    }
  }

  async getCandidate(candidateId: string): Promise<Candidate | null> {
    await this.init();
    try {
      const [personalInfo, resumeData, interviewData] = await Promise.all([
        this.personalInfoRepo.findById(candidateId),
        this.resumeRepo.findById(candidateId),
        this.interviewRepo.findById(candidateId),
      ]);

      if (!personalInfo) {
        return null;
      }

      const candidate = new Candidate(
        personalInfo.candidateId,
        personalInfo.name,
        personalInfo.email,
        personalInfo.birthdate,
        personalInfo.roleApplied,
        resumeData?.resume,
        personalInfo.status,
        personalInfo.dateCreated,
        personalInfo.dateUpdated,
        personalInfo.assignedHRUserIds,
        personalInfo.lastAssignedAt,
        personalInfo.lastAssignedBy,
        personalInfo.socialLinks
      );
      candidate.isDeleted = personalInfo.isDeleted;

      if (resumeData) {
        candidate.skills =
          resumeData.skills?.map((s: any) => Skill.fromObject(s)) || [];
        candidate.experience =
          resumeData.experience?.map((e: any) => Experience.fromObject(e)) ||
          [];
        candidate.education =
          resumeData.education?.map((e: any) => Education.fromObject(e)) || [];
        candidate.certification =
          resumeData.certification?.map((c: any) =>
            Certification.fromObject(c)
          ) || [];
        candidate.strengths =
          resumeData.strengths?.map((s: any) =>
            StrengthWeakness.fromObject(s)
          ) || [];
        candidate.weaknesses =
          resumeData.weaknesses?.map((w: any) =>
            StrengthWeakness.fromObject(w)
          ) || [];
        candidate.resumeAssessment = resumeData.resumeAssessment;
      }

      if (interviewData) {
        candidate.transcripts = interviewData.transcripts || [];
        candidate.interviewVideos = interviewData.interviewVideos || [];
        candidate.introductionVideos = interviewData.introductionVideos || [];
        candidate.personality = Personality.fromObject(
          interviewData.personality
        );
        candidate.interviewAssessment = interviewData.interviewAssessment;
      }

      return candidate;
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_CANDIDATE, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_RETRIEVE_CANDIDATE);
    }
  }

  async updateCandidate(
    candidateId: string,
    updatedData: Partial<CandidateData>,
    userId?: string,
    userEmail?: string
  ): Promise<void> {
    await this.init();
    try {
      const oldCandidate = await this.getCandidate(candidateId);
      
      // Validate candidate exists before proceeding
      if (!oldCandidate) {
        throw new Error('Candidate not found');
      }
      
      const changes: Record<string, any> = {};

      if (
        updatedData.name ||
        updatedData.email ||
        updatedData.birthdate ||
        updatedData.roleApplied ||
        updatedData.status
      ) {
        if (updatedData.status && oldCandidate.status !== updatedData.status) {
          // Ensure oldCandidate has a status
          if (!oldCandidate.status) {
            throw new Error('Cannot update status: candidate has no existing status');
          }

          changes.status = {
            old: oldCandidate.status,
            new: updatedData.status,
          };

          // Create status history entry
          const statusHistoryEntry: StatusHistoryEntry = {
            historyId: new ObjectId().toHexString(),
            candidateId,
            oldStatus: oldCandidate.status,
            newStatus: updatedData.status,
            changedAt: new Date(),
            changedBy: userId,
            changedByEmail: userEmail,
          };

          await AuditLogger.logCandidateOperation({
            eventType: AuditEventType.CANDIDATE_STATUS_CHANGED,
            candidateId,
            candidateName: oldCandidate?.name,
            userId,
            userEmail,
            action: `Changed candidate status from ${oldCandidate.status} to ${updatedData.status}`,
            oldValue: oldCandidate.status,
            newValue: updatedData.status,
          });

          if (this.notificationService) {
            try {
              const assignedUsers = await getAssignedHRUsers(candidateId);
              for (const hrUser of assignedUsers) {
                await this.notificationService.notifyCandidateEvent(
                  NotificationType.CANDIDATE_STATUS_CHANGED,
                  hrUser.userId,
                  candidateId,
                  oldCandidate?.name || DEFAULT_VALUES.UNKNOWN_CANDIDATE,
                  {
                    oldStatus: oldCandidate.status,
                    newStatus: updatedData.status,
                    roleApplied:
                      oldCandidate?.roleApplied || DEFAULT_VALUES.ROLE_APPLIED,
                  }
                );
              }
            } catch (notifError) {
              console.error(
                NOTIFICATION_ERROR_MESSAGES.CANDIDATE_STATUS_CHANGED,
                notifError
              );
            }
          }

          // Update status and add to status history using atomic operation
          const db = await connectDB();
          const result = await db.collection('personalInfo').updateOne(
            { 
              candidateId,
              status: oldCandidate.status  // Ensure status hasn't changed
            },
            {
              $push: {
                statusHistory: {
                  $each: [statusHistoryEntry],
                  $slice: -50  // Keep only last 50 entries
                }
              } as any,
              $set: {
                status: updatedData.status,
                dateUpdated: new Date()
              }
            }
          );

          // Check if update succeeded (document was found and matched)
          if (result.matchedCount === 0) {
            throw new Error(`Failed to update status: candidate ${candidateId} not found or status has changed concurrently`);
          }

          // Update other personal info fields separately if they exist
          if (updatedData.name || updatedData.email || updatedData.birthdate || updatedData.roleApplied) {
            await this.personalInfoRepo.update(candidateId, {
              name: updatedData.name,
              email: updatedData.email,
              birthdate: updatedData.birthdate,
              roleApplied: updatedData.roleApplied,
            });
          }
        } else {
          // No status change, just update other fields
          await this.personalInfoRepo.update(candidateId, {
            name: updatedData.name,
            email: updatedData.email,
            birthdate: updatedData.birthdate,
            roleApplied: updatedData.roleApplied,
            status: updatedData.status,
          });
        }

        if (updatedData.name) changes.name = updatedData.name;
        if (updatedData.email) changes.email = updatedData.email;
        if (updatedData.roleApplied)
          changes.roleApplied = updatedData.roleApplied;
      }

      if (
        updatedData.resume ||
        updatedData.skills ||
        updatedData.experience ||
        updatedData.education ||
        updatedData.certification ||
        updatedData.strengths ||
        updatedData.weaknesses ||
        updatedData.resumeAssessment
      ) {
        await this.resumeRepo.update(candidateId, {
          resume: updatedData.resume,
          skills: updatedData.skills,
          experience: updatedData.experience,
          education: updatedData.education,
          certification: updatedData.certification,
          strengths: updatedData.strengths,
          weaknesses: updatedData.weaknesses,
          resumeAssessment: updatedData.resumeAssessment,
          dateUpdated: new Date(),
        });
        if (updatedData.resumeAssessment) changes.resumeAssessment = "updated";
      }

      if (
        updatedData.transcripts ||
        updatedData.personality ||
        updatedData.interviewAssessment
      ) {
        await this.interviewRepo.update(candidateId, {
          transcripts: updatedData.transcripts,
          personality: updatedData.personality,
          interviewAssessment: updatedData.interviewAssessment,
          dateUpdated: new Date(),
        });
        if (updatedData.interviewAssessment)
          changes.interviewAssessment = "updated";
      }

      if (Object.keys(changes).length > 0) {
        await AuditLogger.logCandidateOperation({
          eventType: AuditEventType.CANDIDATE_UPDATED,
          candidateId,
          candidateName: oldCandidate?.name,
          userId,
          userEmail,
          action: ACTIONS.UPDATED_CANDIDATE_PROFILE,
          metadata: { changes },
        });
      }
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_UPDATING_CANDIDATE, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_UPDATE_CANDIDATE);
    }
  }

  async deleteCandidate(
    candidateId: string,
    userId?: string,
    userEmail?: string
  ): Promise<void> {
    await this.init();
    try {
      const candidate = await this.getCandidate(candidateId);
      
      // Clean up associated files from GridFS before soft delete
      const db = await connectDB();
      
      // Delete resume file
      if (candidate?.resumeMetadata?.fileId) {
        try {
          const resumeBucket = new GridFSBucket(db, { bucketName: 'resumes' });
          await resumeBucket.delete(new ObjectId(candidate.resumeMetadata.fileId));
        } catch (fileError) {
          console.warn(`Failed to delete resume file for candidate ${candidateId}:`, fileError);
          // Continue with soft delete even if file deletion fails
        }
      }
      
      // Delete transcript files
      if (candidate?.transcripts && candidate.transcripts.length > 0) {
        try {
          const transcriptBucket = new GridFSBucket(db, { bucketName: 'transcripts' });
          for (const transcript of candidate.transcripts) {
            if (transcript.fileId) {
              try {
                await transcriptBucket.delete(new ObjectId(transcript.fileId));
              } catch (err) {
                console.warn(`Failed to delete transcript ${transcript.fileId}:`, err);
              }
            }
          }
        } catch (fileError) {
          console.warn(`Failed to delete transcript files for candidate ${candidateId}:`, fileError);
        }
      }
      
      // Delete introduction videos
      if (candidate?.introductionVideos && candidate.introductionVideos.length > 0) {
        try {
          const introBucket = new GridFSBucket(db, { bucketName: 'introduction_videos' });
          for (const video of candidate.introductionVideos) {
            if (video.fileId) {
              try {
                await introBucket.delete(new ObjectId(video.fileId));
              } catch (err) {
                console.warn(`Failed to delete introduction video ${video.fileId}:`, err);
              }
            }
          }
        } catch (fileError) {
          console.warn(`Failed to delete introduction videos for candidate ${candidateId}:`, fileError);
        }
      }
      
      // Delete interview videos
      if (candidate?.interviewVideos && candidate.interviewVideos.length > 0) {
        try {
          const interviewBucket = new GridFSBucket(db, { bucketName: 'interview_videos' });
          for (const video of candidate.interviewVideos) {
            if (video.fileId) {
              try {
                await interviewBucket.delete(new ObjectId(video.fileId));
              } catch (err) {
                console.warn(`Failed to delete interview video ${video.fileId}:`, err);
              }
            }
          }
        } catch (fileError) {
          console.warn(`Failed to delete interview videos for candidate ${candidateId}:`, fileError);
        }
      }
      
      await this.personalInfoRepo.update(candidateId, {
        isDeleted: true,
        dateUpdated: new Date(),
      });

      await AuditLogger.logCandidateOperation({
        eventType: AuditEventType.CANDIDATE_DELETED,
        candidateId,
        candidateName: candidate?.name,
        userId,
        userEmail,
        action: `${ACTIONS.DELETED_CANDIDATE}: ${candidate?.name}`,
        metadata: { softDelete: true, filesDeleted: true },
      });
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_DELETING_CANDIDATE, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_DELETE_CANDIDATE);
    }
  }

  async getAllCandidates(): Promise<Candidate[]> {
    await this.init();
    try {
      const personalInfos = await this.personalInfoRepo.findAll();
      const candidates: Candidate[] = [];
      for (const personalInfo of personalInfos) {
        const candidate = await this.getCandidate(personalInfo.candidateId);
        if (candidate) {
          candidates.push(candidate);
        }
      }
      return candidates;
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_ALL_CANDIDATES, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_RETRIEVE_CANDIDATES);
    }
  }

  async getCandidatesByStatus(status: CandidateStatus): Promise<Candidate[]> {
    await this.init();
    try {
      const personalInfos = await this.personalInfoRepo.findByStatus(status);
      const candidates: Candidate[] = [];
      for (const personalInfo of personalInfos) {
        const candidate = await this.getCandidate(personalInfo.candidateId);
        if (candidate) {
          candidates.push(candidate);
        }
      }
      return candidates;
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_CANDIDATES_BY_STATUS, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_RETRIEVE_CANDIDATES_BY_STATUS);
    }
  }

  // ============================
  // FILE OPERATIONS (Delegate to FileService)
  // ============================

  async getResumeFile(
    candidateId: string
  ): Promise<{ stream: any; metadata: any } | null> {
    await this.init();
    return this.fileService.getResumeFile(candidateId);
  }

  async updateResumeFile(
    candidateId: string,
    resumeFile: Express.Multer.File,
    userId?: string,
    userEmail?: string
  ): Promise<void> {
    await this.init();
    return this.fileService.updateResumeFile(
      candidateId,
      resumeFile,
      userId,
      userEmail
    );
  }

  async deleteResumeFile(
    candidateId: string,
    userId?: string,
    userEmail?: string
  ): Promise<void> {
    await this.init();
    const candidate = await this.getCandidate(candidateId);
    return this.fileService.deleteResumeFile(
      candidateId,
      candidate?.name || DEFAULT_VALUES.UNKNOWN,
      userId,
      userEmail
    );
  }

  async hasResume(candidateId: string): Promise<boolean> {
    await this.init();
    return this.fileService.hasResume(candidateId);
  }

  async getResumeMetadata(candidateId: string): Promise<ResumeMetadata | null> {
    await this.init();
    return this.fileService.getResumeMetadata(candidateId);
  }

  async addTranscriptFile(
    candidateId: string,
    transcriptFile: Express.Multer.File,
    metadata?: Partial<TranscriptMetadata>
  ): Promise<TranscriptMetadata> {
    await this.init();
    return this.fileService.addTranscriptFile(
      candidateId,
      transcriptFile,
      metadata
    );
  }

  async getTranscriptFile(
    candidateId: string,
    transcriptId: string
  ): Promise<{ stream: any; metadata: TranscriptMetadata }> {
    await this.init();
    return this.fileService.getTranscriptFile(candidateId, transcriptId);
  }

  async updateTranscriptFile(
    candidateId: string,
    transcriptId: string,
    transcriptFile: Express.Multer.File,
    metadata?: Partial<TranscriptMetadata>
  ): Promise<TranscriptMetadata> {
    await this.init();
    return this.fileService.updateTranscriptFile(
      candidateId,
      transcriptId,
      transcriptFile,
      metadata
    );
  }

  async deleteTranscriptFile(
    candidateId: string,
    transcriptId: string
  ): Promise<void> {
    await this.init();
    return this.fileService.deleteTranscriptFile(candidateId, transcriptId);
  }

  async getAllTranscripts(candidateId: string): Promise<TranscriptMetadata[]> {
    await this.init();
    return this.fileService.getAllTranscripts(candidateId);
  }

  async getTranscriptMetadata(
    candidateId: string,
    transcriptId: string
  ): Promise<TranscriptMetadata | null> {
    await this.init();
    return this.fileService.getTranscriptMetadata(candidateId, transcriptId);
  }

  async getTranscriptBuffer(
    candidateId: string,
    transcriptId: string
  ): Promise<Buffer> {
    await this.init();
    return this.fileService.getTranscriptBuffer(candidateId, transcriptId);
  }

  async addVideoFile(
    candidateId: string,
    videoFile: Express.Multer.File,
    videoType: "interview" | "introduction",
    metadata?: Partial<VideoMetadata>,
    userId?: string,
    userEmail?: string
  ): Promise<VideoMetadata> {
    await this.init();
    return this.fileService.addVideoFile(
      candidateId,
      videoFile,
      videoType,
      metadata,
      userId,
      userEmail
    );
  }

  async getVideoFile(
    candidateId: string,
    videoId: string,
    videoType: "interview" | "introduction"
  ): Promise<{ stream: any; metadata: VideoMetadata }> {
    await this.init();
    return this.fileService.getVideoFile(candidateId, videoId, videoType);
  }

  async updateVideoFile(
    candidateId: string,
    videoId: string,
    videoFile: Express.Multer.File,
    videoType: "interview" | "introduction",
    metadata?: Partial<VideoMetadata>
  ): Promise<VideoMetadata> {
    await this.init();
    return this.fileService.updateVideoFile(
      candidateId,
      videoId,
      videoFile,
      videoType,
      metadata
    );
  }

  async deleteVideoFile(
    candidateId: string,
    videoId: string,
    videoType: "interview" | "introduction"
  ): Promise<void> {
    await this.init();
    return this.fileService.deleteVideoFile(candidateId, videoId, videoType);
  }

  async getAllVideos(
    candidateId: string,
    videoType?: "interview" | "introduction"
  ): Promise<VideoMetadata[]> {
    await this.init();
    return this.fileService.getAllVideos(candidateId, videoType);
  }

  async getVideoMetadata(
    candidateId: string,
    videoId: string,
    videoType: "interview" | "introduction"
  ): Promise<VideoMetadata | null> {
    await this.init();
    return this.fileService.getVideoMetadata(candidateId, videoId, videoType);
  }

  async updateVideoAnalysis(
    candidateId: string,
    videoId: string,
    videoType: "interview" | "introduction",
    analysis: any
  ): Promise<void> {
    await this.init();
    return this.fileService.updateVideoAnalysis(
      candidateId,
      videoId,
      videoType,
      analysis
    );
  }

  async getVideoBuffer(
    candidateId: string,
    videoId: string,
    videoType: "interview" | "introduction"
  ): Promise<Buffer> {
    await this.init();
    return this.fileService.getVideoBuffer(candidateId, videoId, videoType);
  }

  // ============================
  // PERSONALITY OPERATIONS (Delegate to PersonalityService)
  // ============================

  async getCandidatePersonality(
    candidateId: string
  ): Promise<Personality | null> {
    await this.init();
    return this.personalityService.getCandidatePersonality(candidateId);
  }

  async updateCandidatePersonalityTrait(
    candidateId: string,
    category: string,
    subcategory: string,
    traitData: { score: number; evidence: string }
  ): Promise<void> {
    await this.init();
    return this.personalityService.updateCandidatePersonalityTrait(
      candidateId,
      category,
      subcategory,
      traitData
    );
  }

  async updateCandidatePersonality(
    candidateId: string,
    personalityData: PersonalityData
  ): Promise<void> {
    await this.init();
    return this.personalityService.updateCandidatePersonality(
      candidateId,
      personalityData
    );
  }

  // ============================
  // ASSIGNMENT OPERATIONS (Delegate to AssignmentService)
  // ============================

  async assignHRUserToCandidate(
    candidateId: string,
    hrUserId: string,
    assignedBy: string
  ): Promise<void> {
    await this.init();
    return this.assignmentService.assignHRUserToCandidate(
      candidateId,
      hrUserId,
      assignedBy
    );
  }

  async unassignHRUserFromCandidate(
    candidateId: string,
    hrUserId: string
  ): Promise<void> {
    await this.init();
    return this.assignmentService.unassignHRUserFromCandidate(
      candidateId,
      hrUserId
    );
  }

  async getCandidateAssignments(candidateId: string): Promise<string[]> {
    await this.init();
    return this.assignmentService.getCandidateAssignments(candidateId);
  }

  async getCandidatesAssignedToHRUser(hrUserId: string): Promise<Candidate[]> {
    await this.init();
    return this.assignmentService.getCandidatesAssignedToHRUser(hrUserId);
  }

  async getUnassignedCandidates(): Promise<Candidate[]> {
    await this.init();
    return this.assignmentService.getUnassignedCandidates();
  }

  async isHRUserAssignedToCandidate(
    candidateId: string,
    hrUserId: string
  ): Promise<boolean> {
    await this.init();
    return this.assignmentService.isHRUserAssignedToCandidate(
      candidateId,
      hrUserId
    );
  }
}
