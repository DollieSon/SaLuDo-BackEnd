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
  analysisText?: string; // AI-generated analysis of video content (deprecated - use videoAnalysis instead)
  videoAnalysis?: {
    communicationSkills?: {
      clarity: number;
      articulateness: number;
      pace: number;
      confidence: number;
      evidence: string;
    };
    nonVerbalCues?: {
      eyeContact: number;
      bodyLanguage: number;
      facialExpressions: number;
      overallPresence: number;
      evidence: string;
    };
    contentQuality?: {
      relevance: number;
      depth: number;
      structure: number;
      examples: number;
      evidence: string;
    };
    overallImpression?: {
      score: number;
      strengths: string[];
      areasForImprovement: string[];
      summary: string;
    };
    transcribedText?: string;
  };
  videoType: "interview" | "introduction"; // Type of video
  interviewRound?: string; // Which interview round (for interview videos)
  duration?: number; // Video duration in seconds
  resolution?: string; // Video resolution (e.g., "1920x1080")
  frameRate?: number; // Frame rate (e.g., 30)
  bitrate?: number; // Bitrate in kbps
}

export interface SocialLink {
  platform: string; // e.g., "LinkedIn", "GitHub", "Portfolio", etc.
  url: string; // Full URL to the social profile
}

// =======================
// PREDICTIVE SCORE INTERFACES
// =======================

/**
 * Breakdown of score by category
 */
export interface ScoreBreakdown {
  skillMatch: number; // 0-100 scaled contribution
  personalityFit: number; // 0-100 scaled contribution
  experience: number; // 0-100 scaled contribution
  education: number; // 0-100 scaled contribution
  profileQuality: number; // 0-100 scaled contribution
}

/**
 * Score history entry for tracking over time
 */
export interface ScoreHistoryEntry {
  historyId: string;
  candidateId: string;
  jobId?: string;
  overallScore: number;
  breakdown: ScoreBreakdown;
  confidence: number;
  mode: "job-specific" | "general";
  calculatedAt: Date;
  calculatedBy?: string;
}

/**
 * AI-generated insights stored on candidate
 */
export interface CandidateAIInsights {
  summary: string;
  strengths: string[];
  areasForImprovement: string[];
  recommendations: string[];
  generatedAt: Date;
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
  public socialLinks: SocialLink[]; // Social media and professional links
  // HR Assignment Information
  public assignedHRUserIds: string[]; // Array of HR user IDs assigned to this candidate
  public lastAssignedAt: Date | null; // When last assignment was made
  public lastAssignedBy: string | null; // Who made the last assignment
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

  // Predictive Score Information
  public scoreHistory: ScoreHistoryEntry[]; // History of calculated scores (max 50)
  public aiInsights?: CandidateAIInsights; // Cached AI-generated insights
  public insightsGeneratedAt?: Date; // When AI insights were last generated
  public lastScoreCalculatedAt?: Date; // When score was last calculated
  constructor(
    candidateId: string,
    name: string,
    email: string[],
    birthdate: Date,
    roleApplied: string | null = null,
    resumeMetadata?: ResumeMetadata,
    status: CandidateStatus = CandidateStatus.APPLIED,
    dateCreated?: Date,
    dateUpdated?: Date,
    assignedHRUserIds?: string[],
    lastAssignedAt?: Date | null,
    lastAssignedBy?: string | null,
    socialLinks?: SocialLink[]
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
    this.socialLinks = socialLinks || [];
    // Initialize assignment fields
    this.assignedHRUserIds = assignedHRUserIds || [];
    this.lastAssignedAt = lastAssignedAt || null;
    this.lastAssignedBy = lastAssignedBy || null;
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
    this.scoreHistory = []; // Initialize empty score history
  }

  // =======================
  // STATIC FACTORY METHODS
  // =======================

  static fromObject(data: CandidateData): Candidate {
    const candidate = new Candidate(
      data.candidateId,
      data.name,
      data.email,
      data.birthdate,
      data.roleApplied,
      data.resume,
      data.status,
      data.dateCreated,
      data.dateUpdated,
      data.assignedHRUserIds,
      data.lastAssignedAt,
      data.lastAssignedBy,
      data.socialLinks
    );

    candidate.isDeleted = data.isDeleted;

    // Populate complex objects
    candidate.skills = data.skills?.map((s: any) => Skill.fromObject(s)) || [];
    candidate.experience =
      data.experience?.map((e: any) => Experience.fromObject(e)) || [];
    candidate.education =
      data.education?.map((e: any) => Education.fromObject(e)) || [];
    candidate.certification =
      data.certification?.map((c: any) => Certification.fromObject(c)) || [];
    candidate.strengths =
      data.strengths?.map((s: any) => StrengthWeakness.fromObject(s)) || [];
    candidate.weaknesses =
      data.weaknesses?.map((w: any) => StrengthWeakness.fromObject(w)) || [];
    candidate.transcripts = data.transcripts || [];
    candidate.interviewVideos = data.interviewVideos || [];
    candidate.introductionVideos = data.introductionVideos || [];
    candidate.personality = data.personality
      ? Personality.fromObject(data.personality)
      : new Personality();
    candidate.resumeAssessment = data.resumeAssessment;
    candidate.interviewAssessment = data.interviewAssessment;

    // Populate score-related fields
    candidate.scoreHistory = data.scoreHistory || [];
    candidate.aiInsights = data.aiInsights;
    candidate.insightsGeneratedAt = data.insightsGeneratedAt
      ? new Date(data.insightsGeneratedAt)
      : undefined;
    candidate.lastScoreCalculatedAt = data.lastScoreCalculatedAt
      ? new Date(data.lastScoreCalculatedAt)
      : undefined;

    return candidate;
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
  // HR ASSIGNMENT METHODS
  // =======================

  assignHRUser(hrUserId: string, assignedBy: string): void {
    if (!this.assignedHRUserIds.includes(hrUserId)) {
      this.assignedHRUserIds.push(hrUserId);
      this.lastAssignedAt = new Date();
      this.lastAssignedBy = assignedBy;
      this.dateUpdated = new Date();
    }
  }

  unassignHRUser(hrUserId: string): void {
    const index = this.assignedHRUserIds.indexOf(hrUserId);
    if (index > -1) {
      this.assignedHRUserIds.splice(index, 1);
      this.dateUpdated = new Date();
    }
  }

  isAssignedToHRUser(hrUserId: string): boolean {
    return this.assignedHRUserIds.includes(hrUserId);
  }

  getAssignedHRUsers(): string[] {
    return [...this.assignedHRUserIds]; // Return copy to prevent mutation
  }

  hasAssignedHRUsers(): boolean {
    return this.assignedHRUserIds.length > 0;
  }

  clearAllAssignments(): void {
    this.assignedHRUserIds = [];
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
      assignedHRUserIds: this.assignedHRUserIds,
      lastAssignedAt: this.lastAssignedAt,
      lastAssignedBy: this.lastAssignedBy,
      socialLinks: this.socialLinks,
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
      scoreHistory: this.scoreHistory,
      aiInsights: this.aiInsights,
      insightsGeneratedAt: this.insightsGeneratedAt,
      lastScoreCalculatedAt: this.lastScoreCalculatedAt,
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
      assignedHRUserIds: this.assignedHRUserIds,
      lastAssignedAt: this.lastAssignedAt,
      lastAssignedBy: this.lastAssignedBy,
      socialLinks: this.socialLinks,
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

  // =======================
  // PREDICTIVE SCORE METHODS
  // =======================

  /**
   * Check if candidate has any score history
   */
  hasScoreHistory(): boolean {
    return this.scoreHistory.length > 0;
  }

  /**
   * Get the most recent score entry
   */
  getLatestScore(): ScoreHistoryEntry | null {
    if (this.scoreHistory.length === 0) return null;
    return this.scoreHistory[this.scoreHistory.length - 1];
  }

  /**
   * Get the most recent score for a specific job
   */
  getLatestScoreForJob(jobId: string): ScoreHistoryEntry | null {
    const jobScores = this.scoreHistory.filter((s) => s.jobId === jobId);
    if (jobScores.length === 0) return null;
    return jobScores[jobScores.length - 1];
  }

  /**
   * Get score history count
   */
  getScoreHistoryCount(): number {
    return this.scoreHistory.length;
  }

  /**
   * Check if AI insights are available
   */
  hasAIInsights(): boolean {
    return this.aiInsights !== undefined && this.aiInsights.summary !== "";
  }

  /**
   * Get AI insights age in hours
   */
  getInsightsAgeHours(): number | null {
    if (!this.insightsGeneratedAt) return null;
    const now = new Date();
    const diffMs = now.getTime() - new Date(this.insightsGeneratedAt).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60));
  }

  /**
   * Check if AI insights are stale (older than specified hours)
   */
  areInsightsStale(maxAgeHours: number = 24): boolean {
    const age = this.getInsightsAgeHours();
    if (age === null) return true;
    return age > maxAgeHours;
  }

  /**
   * Get score trend (comparing last two scores)
   */
  getScoreTrend(): "improving" | "declining" | "stable" | "unknown" {
    if (this.scoreHistory.length < 2) return "unknown";

    const latest = this.scoreHistory[this.scoreHistory.length - 1];
    const previous = this.scoreHistory[this.scoreHistory.length - 2];

    const diff = latest.overallScore - previous.overallScore;

    if (diff > 2) return "improving";
    if (diff < -2) return "declining";
    return "stable";
  }

  /**
   * Get average score from history
   */
  getAverageScore(): number {
    if (this.scoreHistory.length === 0) return 0;

    const total = this.scoreHistory.reduce(
      (sum, entry) => sum + entry.overallScore,
      0
    );
    return Number((total / this.scoreHistory.length).toFixed(1));
  }

  /**
   * Get score summary string
   */
  getScoreSummary(): string {
    const latest = this.getLatestScore();
    if (!latest) {
      return "No score calculated yet";
    }

    const trend = this.getScoreTrend();
    const trendText = trend === "unknown" ? "" : ` (${trend})`;

    return `Score: ${latest.overallScore}/100 | Confidence: ${latest.confidence}%${trendText}`;
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
  assignedHRUserIds: string[];
  lastAssignedAt: Date | null;
  lastAssignedBy: string | null;
  socialLinks: SocialLink[];
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
  // Predictive Score fields
  scoreHistory?: ScoreHistoryEntry[];
  aiInsights?: CandidateAIInsights;
  insightsGeneratedAt?: Date;
  lastScoreCalculatedAt?: Date;
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
  assignedHRUserIds: string[];
  lastAssignedAt: Date | null;
  lastAssignedBy: string | null;
  socialLinks: SocialLink[];
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
