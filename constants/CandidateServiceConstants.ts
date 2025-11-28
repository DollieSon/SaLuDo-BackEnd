/**
 * Candidate Service Constants
 * Contains all frequently used strings, values, and configurations across candidate services
 */

// ============================
// ERROR MESSAGES
// ============================
export const ERROR_MESSAGES = {
  CANDIDATE_NOT_FOUND: "Candidate not found",
  FAILED_TO_ADD_CANDIDATE: "Failed to add candidate",
  FAILED_TO_RETRIEVE_CANDIDATE: "Failed to retrieve candidate",
  FAILED_TO_UPDATE_CANDIDATE: "Failed to update candidate",
  FAILED_TO_DELETE_CANDIDATE: "Failed to delete candidate",
  FAILED_TO_RETRIEVE_CANDIDATES: "Failed to retrieve candidates",
  FAILED_TO_RETRIEVE_CANDIDATES_BY_STATUS: "Failed to retrieve candidates by status",
  
  // File operations
  FAILED_TO_RETRIEVE_RESUME_FILE: "Failed to retrieve resume file",
  FAILED_TO_UPDATE_RESUME_FILE: "Failed to update resume file",
  FAILED_TO_DELETE_RESUME_FILE: "Failed to delete resume file",
  FAILED_TO_RETRIEVE_RESUME_METADATA: "Failed to retrieve resume metadata",
  
  FAILED_TO_ADD_TRANSCRIPT_FILE: "Failed to add transcript file",
  FAILED_TO_RETRIEVE_TRANSCRIPT_FILE: "Failed to retrieve transcript file",
  FAILED_TO_UPDATE_TRANSCRIPT_FILE: "Failed to update transcript file",
  FAILED_TO_DELETE_TRANSCRIPT_FILE: "Failed to delete transcript file",
  FAILED_TO_RETRIEVE_TRANSCRIPTS: "Failed to retrieve transcripts",
  FAILED_TO_RETRIEVE_TRANSCRIPT_METADATA: "Failed to retrieve transcript metadata",
  FAILED_TO_RETRIEVE_TRANSCRIPT_BUFFER: "Failed to retrieve transcript buffer",
  
  FAILED_TO_ADD_VIDEO_FILE: "Failed to add video file",
  FAILED_TO_RETRIEVE_VIDEO_FILE: "Failed to retrieve video file",
  FAILED_TO_UPDATE_VIDEO_FILE: "Failed to update video file",
  FAILED_TO_DELETE_VIDEO_FILE: "Failed to delete video file",
  FAILED_TO_RETRIEVE_VIDEOS: "Failed to retrieve videos",
  FAILED_TO_RETRIEVE_VIDEO_METADATA: "Failed to retrieve video metadata",
  FAILED_TO_RETRIEVE_VIDEO_BUFFER: "Failed to retrieve video buffer",
  
  // Personality operations
  FAILED_TO_RETRIEVE_PERSONALITY: "Failed to retrieve candidate personality",
  FAILED_TO_UPDATE_PERSONALITY_TRAIT: "Failed to update candidate personality trait",
  FAILED_TO_UPDATE_PERSONALITY: "Failed to update candidate personality",
  
  // Validation errors
  INVALID_FILE_TYPE_TRANSCRIPT: "Invalid file type. Only MP3, WAV, M4A, OGG, TXT, and DOCX files are allowed.",
  INVALID_FILE_TYPE_VIDEO: "Invalid file type. Only MP4, WebM, AVI, MOV, WMV, FLV, MKV, and M4V files are allowed.",
  FILE_SIZE_TOO_LARGE_TRANSCRIPT: "File size too large. Maximum size is 50MB.",
  FILE_SIZE_TOO_LARGE_VIDEO: "File size too large. Maximum size is 500MB.",
  INVALID_PERSONALITY_DATA: "Invalid personality data: must be an object",
  INVALID_SCORE_RANGE: "Score must be between 0 and 10",
  INVALID_CATEGORY: "Invalid category",
  INVALID_TRAIT: "Trait not found",
  
  // Assignment operations
  HR_USER_ALREADY_ASSIGNED: "HR user is already assigned to this candidate",
  HR_USER_NOT_ASSIGNED: "HR user is not assigned to this candidate",
  
  // Generic
  TRANSCRIPT_NOT_FOUND: "Transcript not found",
  VIDEO_NOT_FOUND: "Video not found",
} as const;

// ============================
// SUCCESS MESSAGES / ACTIONS
// ============================
export const ACTIONS = {
  CREATED_NEW_CANDIDATE: "Created new candidate",
  UPDATED_CANDIDATE_PROFILE: "Updated candidate profile",
  DELETED_CANDIDATE: "Deleted candidate",
  CHANGED_CANDIDATE_STATUS: "Changed candidate status from",
  DELETED_RESUME_FILE: "Deleted resume file",
  ASSIGNED: "assigned",
  UNASSIGNED: "unassigned",
  UPLOAD: "upload",
} as const;

// ============================
// COLLECTION NAMES
// ============================
export const COLLECTION_NAMES = {
  NOTIFICATIONS: "notifications",
  NOTIFICATION_PREFERENCES: "notificationPreferences",
  WEBHOOKS: "webhooks",
  RESUMES_FILES: "resumes.files",
} as const;

// ============================
// GRIDFS BUCKET NAMES
// ============================
export const BUCKET_NAMES = {
  RESUMES: "resumes",
  TRANSCRIPTS: "transcripts",
  INTERVIEW_VIDEOS: "interview-videos",
  INTRODUCTION_VIDEOS: "introduction-videos",
} as const;

// ============================
// FILE TYPE VALIDATION
// ============================
export const ALLOWED_FILE_TYPES = {
  TRANSCRIPT: [
    "audio/mpeg",
    "audio/wav",
    "audio/mp4",
    "audio/ogg",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  VIDEO: [
    "video/mp4",
    "video/webm",
    "video/avi",
    "video/mov",
    "video/wmv",
    "video/flv",
    "video/mkv",
    "video/m4v",
  ],
} as const;

// ============================
// FILE SIZE LIMITS (in bytes)
// ============================
export const FILE_SIZE_LIMITS = {
  TRANSCRIPT: 50 * 1024 * 1024, // 50MB
  VIDEO: 500 * 1024 * 1024, // 500MB
} as const;

// ============================
// DEFAULT VALUES
// ============================
export const DEFAULT_VALUES = {
  ROLE_APPLIED: "Not specified",
  INTERVIEW_ROUND: "general",
  UPLOADED_BY: "candidate",
  UNKNOWN_CANDIDATE: "Unknown Candidate",
  UNKNOWN_USER: "Unknown User",
  UNKNOWN_EMAIL: "unknown@saludo.com",
  UNKNOWN: "Unknown",
} as const;

// ============================
// FILE TYPES
// ============================
export const FILE_TYPES = {
  RESUME: "resume",
  TRANSCRIPT: "transcript",
  INTERVIEW_VIDEO: "interview_video",
  INTRODUCTION_VIDEO: "introduction_video",
} as const;

// ============================
// VIDEO TYPES
// ============================
export const VIDEO_TYPES = {
  INTERVIEW: "interview",
  INTRODUCTION: "introduction",
} as const;

// ============================
// PROCESSING STATUS
// ============================
export const PROCESSING_STATUS = {
  NOT_STARTED: "not_started",
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

// ============================
// PERSONALITY CATEGORIES (for validation)
// ============================
export const PERSONALITY_CATEGORIES = {
  COGNITIVE: "cognitiveAndProblemSolving",
  COMMUNICATION: "communicationAndTeamwork",
  WORK_ETHIC: "workEthicAndReliability",
  GROWTH: "growthAndLeadership",
  CULTURE: "cultureAndPersonalityFit",
  BONUS: "bonusTraits",
} as const;

export const PERSONALITY_CATEGORY_MAP: Record<string, string> = {
  cognitive: "cognitiveAndProblemSolving",
  communication: "communicationAndTeamwork",
  workethic: "workEthicAndReliability",
  growth: "growthAndLeadership",
  culture: "cultureAndPersonalityFit",
  bonus: "bonusTraits",
};

export const PERSONALITY_SUBCATEGORY_MAP: Record<string, string> = {
  analyticalthinking: "analyticalThinking",
  curiosity: "curiosity",
  creativity: "creativity",
  attentiontodetail: "attentionToDetail",
  criticalthinking: "criticalThinking",
  resourcefulness: "resourcefulness",
  clearcommunication: "clearCommunication",
  activelistening: "activeListening",
  collaboration: "collaboration",
  empathy: "empathy",
  conflictresolution: "conflictResolution",
  dependability: "dependability",
  accountability: "accountability",
  persistence: "persistence",
  timemanagement: "timeManagement",
  organization: "organization",
  initiative: "initiative",
  selfmotivation: "selfMotivation",
  leadership: "leadership",
  adaptability: "adaptability",
  coachability: "coachability",
  positiveattitude: "positiveAttitude",
  humility: "humility",
  confidence: "confidence",
  integrity: "integrity",
  professionalism: "professionalism",
  openmindedness: "openMindedness",
  enthusiasm: "enthusiasm",
  customerfocus: "customerFocus",
  visionarythinking: "visionaryThinking",
  culturalawareness: "culturalAwareness",
  senseofhumor: "senseOfHumor",
  grit: "grit",
};

// ============================
// SCORE VALIDATION
// ============================
export const SCORE_RANGE = {
  MIN: 0,
  MAX: 10,
} as const;

// ============================
// METADATA FIELD NAMES
// ============================
export const METADATA_FIELDS = {
  CANDIDATE_ID: "candidateId",
  CONTENT_TYPE: "contentType",
  UPLOADED_BY: "uploadedBy",
  VIDEO_TYPE: "videoType",
  INTERVIEW_ROUND: "interviewRound",
  DURATION: "duration",
  RESOLUTION: "resolution",
  FRAME_RATE: "frameRate",
  BITRATE: "bitrate",
  CANDIDATE_NAME: "candidateName",
  HAS_RESUME: "hasResume",
  SOFT_DELETE: "softDelete",
  CHANGES: "changes",
  TOTAL_ASSIGNMENTS: "totalAssignments",
  REMAINING_ASSIGNMENTS: "remainingAssignments",
  ASSIGNED_TO_USER_ID: "assignedToUserId",
  ASSIGNED_TO_USER_NAME: "assignedToUserName",
  ASSIGNED_TO_USER_EMAIL: "assignedToUserEmail",
  ASSIGNED_BY: "assignedBy",
  UNASSIGNED_USER_ID: "unassignedUserId",
  UNASSIGNED_USER_NAME: "unassignedUserName",
  UNASSIGNED_USER_EMAIL: "unassignedUserEmail",
  OLD_STATUS: "oldStatus",
  NEW_STATUS: "newStatus",
  DOCUMENT_TYPE: "documentType",
  FILE_NAME: "fileName",
  FILE_SIZE: "fileSize",
} as const;

// ============================
// NOTIFICATION ERROR MESSAGES
// ============================
export const NOTIFICATION_ERROR_MESSAGES = {
  CANDIDATE_APPLIED: "Failed to send CANDIDATE_APPLIED notification:",
  CANDIDATE_STATUS_CHANGED: "Failed to send CANDIDATE_STATUS_CHANGED notification:",
  CANDIDATE_DOCUMENT_UPLOADED: "Failed to send CANDIDATE_DOCUMENT_UPLOADED notification:",
  CANDIDATE_ASSIGNED: "Failed to send CANDIDATE_ASSIGNED notification:",
} as const;

// ============================
// CONSOLE LOG MESSAGES
// ============================
export const LOG_MESSAGES = {
  ERROR_ADDING_CANDIDATE: "Error adding candidate:",
  ERROR_GETTING_CANDIDATE: "Error getting candidate:",
  ERROR_UPDATING_CANDIDATE: "Error updating candidate:",
  ERROR_DELETING_CANDIDATE: "Error deleting candidate:",
  ERROR_GETTING_ALL_CANDIDATES: "Error getting all candidates:",
  ERROR_GETTING_CANDIDATES_BY_STATUS: "Error getting candidates by status:",
  
  ERROR_GETTING_RESUME_FILE: "Error getting resume file:",
  ERROR_UPDATING_RESUME_FILE: "Error updating resume file:",
  ERROR_DELETING_RESUME_FILE: "Error deleting resume file:",
  ERROR_CHECKING_RESUME_EXISTENCE: "Error checking resume existence:",
  ERROR_GETTING_RESUME_METADATA: "Error getting resume metadata:",
  
  ERROR_ADDING_TRANSCRIPT_FILE: "Error adding transcript file:",
  ERROR_GETTING_TRANSCRIPT_FILE: "Error getting transcript file:",
  ERROR_UPDATING_TRANSCRIPT_FILE: "Error updating transcript file:",
  ERROR_DELETING_TRANSCRIPT_FILE: "Error deleting transcript file:",
  ERROR_GETTING_ALL_TRANSCRIPTS: "Error getting all transcripts:",
  ERROR_GETTING_TRANSCRIPT_METADATA: "Error getting transcript metadata:",
  ERROR_GETTING_TRANSCRIPT_BUFFER: "Error getting transcript buffer:",
  
  ERROR_ADDING_VIDEO_FILE: "Error adding video file:",
  ERROR_GETTING_VIDEO_FILE: "Error getting video file:",
  ERROR_UPDATING_VIDEO_FILE: "Error updating video file:",
  ERROR_DELETING_VIDEO_FILE: "Error deleting video file:",
  ERROR_GETTING_ALL_VIDEOS: "Error getting all videos:",
  ERROR_GETTING_VIDEO_METADATA: "Error getting video metadata:",
  ERROR_GETTING_VIDEO_BUFFER: "Error getting video buffer:",
  
  ERROR_GETTING_PERSONALITY: "Error getting candidate personality:",
  ERROR_UPDATING_PERSONALITY_TRAIT: "Error updating candidate personality trait:",
  ERROR_UPDATING_PERSONALITY: "Error updating candidate personality:",
  
  ERROR_ASSIGNING_HR_USER: "Error assigning HR user to candidate:",
  ERROR_UNASSIGNING_HR_USER: "Error unassigning HR user from candidate:",
  ERROR_GETTING_ASSIGNMENTS: "Error getting candidate assignments:",
  ERROR_GETTING_ASSIGNED_CANDIDATES: "Error getting candidates assigned to HR user:",
  ERROR_GETTING_UNASSIGNED_CANDIDATES: "Error getting unassigned candidates:",
  ERROR_CHECKING_ASSIGNMENT: "Error checking HR user assignment:",
  
  OLD_RESUME_FILE_NOT_FOUND: "Old resume file not found, continuing with upload",
} as const;
