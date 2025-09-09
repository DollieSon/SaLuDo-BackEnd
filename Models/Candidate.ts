import { Skill, SkillData, CreateSkillData } from "./Skill";
import { Experience, ExperienceData, CreateExperienceData } from "./Experience";
import { Education, EducationData, CreateEducationData } from "./Education";
import {
  Certification,
  CertificationData,
  CreateCertificationData,
} from "./Certification";
import {
  StrengthWeakness,
  StrengthWeaknessData,
  CreateStrengthWeaknessData,
} from "./StrengthWeakness";
import { Personality } from "./Personality";
import { PersonalityData } from "./PersonalityTypes";
import { Job } from "./Job";
export interface ResumeMetadata {
  fileId: string; // GridFS file ID
  filename: string; // Original filename
  contentType: string; // MIME type (application/pdf, etc.)
  size: number; // File size in bytes
  uploadedAt: Date; // Upload timestamp
  parsedAt?: Date; // When AI parsing completed
  parseStatus?: "pending" | "completed" | "failed" | "not_started";
  textContent?: string; // Extracted text content for AI processing
}
export interface TranscriptMetadata {
  fileId: string; // GridFS file ID
  filename: string; // Original filename (e.g., "interview_round1.mp3")
  contentType: string; // MIME type (audio/mpeg, audio/wav, text/plain, etc.)
  size: number; // File size in bytes
  uploadedAt: Date; // Upload timestamp
  transcribedAt?: Date; // When AI transcription completed
  transcriptionStatus?: "pending" | "completed" | "failed" | "not_started";
  textContent?: string; // Transcribed text content
  interviewRound?: string; // Which interview round (e.g., "initial", "technical", "hr")
  duration?: number; // Audio duration in seconds (for audio files)
}

export interface VideoMetadata {
  fileId: string; // GridFS file ID
  filename: string; // Original filename (e.g., "introduction_video.mp4")
  contentType: string; // MIME type (video/mp4, video/webm, video/avi, etc.)
  size: number; // File size in bytes
  uploadedAt: Date; // Upload timestamp
  processedAt?: Date; // When AI processing completed
  processingStatus?: "pending" | "completed" | "failed" | "not_started";
  analysisText?: string; // AI-generated analysis of video content
  videoType: "interview" | "introduction"; // Type of video
  interviewRound?: string; // Which interview round (for interview videos)
  duration?: number; // Video duration in seconds
  resolution?: string; // Video resolution (e.g., "1920x1080")
  frameRate?: number; // Frame rate (e.g., 30)
  bitrate?: number; // Bitrate in kbps
}
export class Candidate {
  // Personal Information (PersonalInfo Database)
  public candidateId: string;
  public name: string;
  public email: string[];
  public birthdate: Date;
  public dateCreated: Date;
  public dateUpdated: Date;
  public roleApplied: string | null; // Optional Job reference (job ID or null)
  public status: CandidateStatus;
  public isDeleted: boolean;
  // Resume Information (Resume Database)
  public resumeMetadata?: ResumeMetadata; // File metadata for GridFS storage
  public skills: Skill[];
  public experience: Experience[];
  public education: Education[];
  public certification: Certification[];
  public strengths: StrengthWeakness[];
  public weaknesses: StrengthWeakness[];
  public resumeAssessment?: string;
  // Interview Information (Interview Database)
  public transcripts: TranscriptMetadata[]; // File metadata for GridFS storage
  public interviewVideos: VideoMetadata[]; // Interview video files metadata
  public introductionVideos: VideoMetadata[]; // Introduction video files metadata
  public personality: Personality; // Comprehensive personality assessment
  public interviewAssessment?: string;
  constructor(
    candidateId: string,
    name: string,
    email: string[],
    birthdate: Date,
    roleApplied: string | null = null,
    resumeMetadata?: ResumeMetadata,
    status: CandidateStatus = CandidateStatus.APPLIED,
    dateCreated?: Date,
    dateUpdated?: Date
  ) {
    this.candidateId = candidateId;
    this.name = name;
    this.email = email;
    this.birthdate = birthdate;
    this.roleApplied = roleApplied;
    this.resumeMetadata = resumeMetadata;
    this.status = status;
    this.isDeleted = false;
    this.dateCreated = dateCreated || new Date();
    this.dateUpdated = dateUpdated || new Date();
    // Initialize arrays
    this.skills = [];
    this.experience = [];
    this.education = [];
    this.certification = [];
    this.strengths = [];
    this.weaknesses = [];
    this.transcripts = [];
    this.interviewVideos = [];
    this.introductionVideos = [];
    this.personality = new Personality(); // Create empty personality for new candidate
  }
  // =======================
  // JOB REFERENCE METHODS
  // =======================

  hasAppliedForJob(): boolean {
    return this.roleApplied !== null;
  }

  getJobId(): string | null {
    return this.roleApplied;
  }

  setJobId(jobId: string | null): void {
    this.roleApplied = jobId;
    this.dateUpdated = new Date();
  }

  isAppliedForJob(jobId: string): boolean {
    return this.roleApplied === jobId;
  }

  removeJobApplication(): void {
    this.roleApplied = null;
    this.dateUpdated = new Date();
  }

  // =======================
  // UTILITY METHODS
  // =======================
  toObject(): CandidateData {
    return {
      candidateId: this.candidateId,
      name: this.name,
      email: this.email,
      birthdate: this.birthdate,
      dateCreated: this.dateCreated,
      dateUpdated: this.dateUpdated,
      roleApplied: this.roleApplied,
      resume: this.resumeMetadata,
      status: this.status,
      isDeleted: this.isDeleted,
      skills: this.skills.map((s) => s.toObject()),
      experience: this.experience.map((e) => e.toObject()),
      education: this.education.map((e) => e.toObject()),
      certification: this.certification.map((c) => c.toObject()),
      strengths: this.strengths.map((s) => s.toObject()),
      weaknesses: this.weaknesses.map((w) => w.toObject()),
      resumeAssessment: this.resumeAssessment,
      transcripts: this.transcripts,
      interviewVideos: this.interviewVideos,
      introductionVideos: this.introductionVideos,
      personality: this.personality.toObject(),
      interviewAssessment: this.interviewAssessment,
    };
  }
  getPersonalInfo(): PersonalInfoData {
    return {
      candidateId: this.candidateId,
      name: this.name,
      email: this.email,
      birthdate: this.birthdate,
      dateCreated: this.dateCreated,
      dateUpdated: this.dateUpdated,
      roleApplied: this.roleApplied,
      status: this.status,
      isDeleted: this.isDeleted,
    };
  }
  getResumeData(): ResumeData {
    return {
      candidateId: this.candidateId,
      resume: this.resumeMetadata,
      skills: this.skills.map((s) => s.toObject()),
      experience: this.experience.map((e) => e.toObject()),
      education: this.education.map((e) => e.toObject()),
      certification: this.certification.map((c) => c.toObject()),
      strengths: this.strengths.map((s) => s.toObject()),
      weaknesses: this.weaknesses.map((w) => w.toObject()),
      resumeAssessment: this.resumeAssessment,
      dateUpdated: this.dateUpdated,
    };
  }
  getInterviewData(): InterviewData {
    return {
      candidateId: this.candidateId,
      transcripts: this.transcripts,
      interviewVideos: this.interviewVideos,
      introductionVideos: this.introductionVideos,
      personality: this.personality.toObject(),
      interviewAssessment: this.interviewAssessment,
      dateUpdated: this.dateUpdated,
    };
  }
  isActive(): boolean {
    return !this.isDeleted;
  }
  getAge(): number {
    const today = new Date();
    const birthDate = new Date(this.birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  }
  getSummary(): string {
    const role = this.roleApplied || "No role applied";
    return `${this.name} - ${role} (${this.status})`;
  }
  hasResume(): boolean {
    return (
      this.resumeMetadata !== undefined &&
      this.resumeMetadata.fileId !== undefined
    );
  }
  hasTranscripts(): boolean {
    return this.transcripts.length > 0;
  }
  getTranscriptCount(): number {
    return this.transcripts.length;
  }
  getTranscriptsByRound(round?: string): TranscriptMetadata[] {
    if (!round) return this.transcripts;
    return this.transcripts.filter((t) => t.interviewRound === round);
  }
  getInterviewRounds(): string[] {
    const rounds = this.transcripts
      .filter((t) => t.interviewRound)
      .map((t) => t.interviewRound!);
    return [...new Set(rounds)]; // Remove duplicates
  }
  getTranscribedFiles(): TranscriptMetadata[] {
    return this.transcripts.filter(
      (t) => t.transcriptionStatus === "completed" && t.textContent
    );
  }

  // =======================
  // VIDEO UTILITY METHODS
  // =======================

  hasInterviewVideos(): boolean {
    return this.interviewVideos.length > 0;
  }

  hasIntroductionVideos(): boolean {
    return this.introductionVideos.length > 0;
  }

  hasAnyVideos(): boolean {
    return this.hasInterviewVideos() || this.hasIntroductionVideos();
  }

  getInterviewVideoCount(): number {
    return this.interviewVideos.length;
  }

  getIntroductionVideoCount(): number {
    return this.introductionVideos.length;
  }

  getTotalVideoCount(): number {
    return this.interviewVideos.length + this.introductionVideos.length;
  }

  getInterviewVideosByRound(round?: string): VideoMetadata[] {
    if (!round) return this.interviewVideos;
    return this.interviewVideos.filter((v) => v.interviewRound === round);
  }

  getVideoInterviewRounds(): string[] {
    const rounds = this.interviewVideos
      .filter((v) => v.interviewRound)
      .map((v) => v.interviewRound!);
    return [...new Set(rounds)]; // Remove duplicates
  }

  getProcessedVideos(): VideoMetadata[] {
    return [...this.interviewVideos, ...this.introductionVideos].filter(
      (v) => v.processingStatus === "completed" && v.analysisText
    );
  }

  getVideosByType(type: "interview" | "introduction"): VideoMetadata[] {
    return type === "interview"
      ? this.interviewVideos
      : this.introductionVideos;
  }

  getTotalVideoSize(): number {
    const interviewSize = this.interviewVideos.reduce(
      (total, v) => total + v.size,
      0
    );
    const introSize = this.introductionVideos.reduce(
      (total, v) => total + v.size,
      0
    );
    return interviewSize + introSize;
  }

  getVideoSummary(): string {
    const interviewCount = this.getInterviewVideoCount();
    const introCount = this.getIntroductionVideoCount();
    const processedCount = this.getProcessedVideos().length;
    const totalCount = this.getTotalVideoCount();

    if (totalCount === 0) {
      return "No videos uploaded";
    }

    let summary = "";
    if (interviewCount > 0) {
      summary += `${interviewCount} interview video${
        interviewCount > 1 ? "s" : ""
      }`;
    }
    if (introCount > 0) {
      if (summary) summary += ", ";
      summary += `${introCount} introduction video${introCount > 1 ? "s" : ""}`;
    }
    summary += ` (${processedCount}/${totalCount} processed)`;

    return summary;
  }
  getProfileCompleteness(): {
    skills: number;
    experience: number;
    education: number;
    certifications: number;
    transcripts: number;
    interviewVideos: number;
    introductionVideos: number;
    personalityTraits: number;
    personalityCompletion: number;
    total: number;
  } {
    const completedTraits = this.getCompletedPersonalityTraitsCount();
    const transcriptCount = this.transcripts.length;
    const interviewVideoCount = this.interviewVideos.length;
    const introVideoCount = this.introductionVideos.length;

    return {
      skills: this.skills.length,
      experience: this.experience.length,
      education: this.education.length,
      certifications: this.certification.length,
      transcripts: transcriptCount,
      interviewVideos: interviewVideoCount,
      introductionVideos: introVideoCount,
      personalityTraits: completedTraits,
      personalityCompletion: this.personality.getCompletionPercentage(),
      total:
        this.skills.length +
        this.experience.length +
        this.education.length +
        this.certification.length +
        transcriptCount +
        interviewVideoCount +
        introVideoCount +
        completedTraits,
    };
  }
  getPersonalityScore(): number {
    return this.personality.getOverallPersonalityScore();
  }
  getPersonalityCompletionPercentage(): number {
    return this.personality.getCompletionPercentage();
  }
  getPersonalityStrengths(count: number = 5): any[] {
    return this.personality.getTopStrengths(count);
  }
  getPersonalityImprovementAreas(count: number = 3): any[] {
    return this.personality.getAreasForImprovement(count);
  }
  hasPersonalityAssessment(): boolean {
    return this.getCompletedPersonalityTraitsCount() > 0;
  }
  getPersonalitySummary(): string {
    const score = this.getPersonalityScore();
    const completion = this.getPersonalityCompletionPercentage();
    const traits = this.getCompletedPersonalityTraitsCount();
    if (traits === 0) {
      return "Personality assessment not started";
    }
    return `Personality Score: ${score}/10 (${completion}% complete, ${traits} traits assessed)`;
  }
  private getCompletedPersonalityTraitsCount(): number {
    const allTraits = [
      ...Object.values(this.personality.cognitiveAndProblemSolving),
      ...Object.values(this.personality.communicationAndTeamwork),
      ...Object.values(this.personality.workEthicAndReliability),
      ...Object.values(this.personality.growthAndLeadership),
      ...Object.values(this.personality.cultureAndPersonalityFit),
      ...Object.values(this.personality.bonusTraits),
    ];
    return allTraits.filter((trait) => trait.score > 0).length;
  }
}
// =======================
// ENUMS AND INTERFACES
// =======================
export enum CandidateStatus {
  APPLIED = "Applied",
  REFERENCE_CHECK = "Reference Check",
  OFFER = "Offer",
  HIRED = "Hired",
  REJECTED = "Rejected",
  WITHDRAWN = "Withdrawn",
}
export interface CandidateData {
  candidateId: string;
  name: string;
  email: string[];
  birthdate: Date;
  dateCreated: Date;
  dateUpdated: Date;
  roleApplied: string | null;
  resume?: ResumeMetadata;
  status: CandidateStatus;
  isDeleted: boolean;
  skills: SkillData[];
  experience: ExperienceData[];
  education: EducationData[];
  certification: CertificationData[];
  strengths: StrengthWeaknessData[];
  weaknesses: StrengthWeaknessData[];
  resumeAssessment?: string;
  transcripts: TranscriptMetadata[];
  interviewVideos: VideoMetadata[];
  introductionVideos: VideoMetadata[];
  personality: PersonalityData;
  interviewAssessment?: string;
}
export interface PersonalInfoData {
  candidateId: string;
  name: string;
  email: string[];
  birthdate: Date;
  dateCreated: Date;
  dateUpdated: Date;
  roleApplied: string | null;
  status: CandidateStatus;
  isDeleted: boolean;
}
export interface ResumeData {
  candidateId: string;
  resume?: ResumeMetadata;
  skills: SkillData[];
  experience: ExperienceData[];
  education: EducationData[];
  certification: CertificationData[];
  strengths: StrengthWeaknessData[];
  weaknesses: StrengthWeaknessData[];
  resumeAssessment?: string;
  dateUpdated: Date;
}
export interface InterviewData {
  candidateId: string;
  transcripts: TranscriptMetadata[];
  interviewVideos: VideoMetadata[];
  introductionVideos: VideoMetadata[];
  personality: PersonalityData;
  interviewAssessment?: string;
  dateUpdated: Date;
}
// =======================
// JOB REFERENCE INTERFACES
// =======================

export interface CandidateJobApplication {
  candidateId: string;
  jobId: string | null;
  appliedAt?: Date;
}

export interface CreateCandidateData {
  name: string;
  email: string[];
  birthdate: Date;
  roleApplied?: string | null;
  status?: CandidateStatus;
}

export interface CandidateJobSummary {
  candidateId: string;
  candidateName: string;
  jobId: string | null;
  jobName?: string;
  status: CandidateStatus;
  appliedAt: Date;
}
