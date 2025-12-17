/**
 * Audit Event Types Enum
 * Comprehensive list of all auditable events in the system
 */

export enum AuditEventType {
  // ============================================
  // AUTHENTICATION EVENTS
  // ============================================
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILURE = "LOGIN_FAILURE",
  LOGOUT = "LOGOUT",
  TOKEN_REFRESH = "TOKEN_REFRESH",

  // ============================================
  // USER MANAGEMENT EVENTS
  // ============================================
  USER_CREATED = "USER_CREATED",
  USER_UPDATED = "USER_UPDATED",
  USER_DELETED = "USER_DELETED",
  USER_ACTIVATED = "USER_ACTIVATED",
  USER_DEACTIVATED = "USER_DEACTIVATED",
  ROLE_CHANGED = "ROLE_CHANGED",

  // ============================================
  // PASSWORD EVENTS
  // ============================================
  PASSWORD_CHANGED = "PASSWORD_CHANGED",
  PASSWORD_RESET = "PASSWORD_RESET",
  PASSWORD_RESET_REQUESTED = "PASSWORD_RESET_REQUESTED",
  PASSWORD_RESET_BY_ADMIN = "PASSWORD_RESET_BY_ADMIN",
  PASSWORD_CHANGE_FORCED = "PASSWORD_CHANGE_FORCED",

  // ============================================
  // SECURITY EVENTS
  // ============================================
  FAILED_LOGIN_ATTEMPT = "FAILED_LOGIN_ATTEMPT",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  UNAUTHORIZED_ACCESS_ATTEMPT = "UNAUTHORIZED_ACCESS_ATTEMPT",
  PERMISSION_GRANTED = "PERMISSION_GRANTED",
  PERMISSION_REVOKED = "PERMISSION_REVOKED",

  // ============================================
  // CANDIDATE MANAGEMENT EVENTS
  // ============================================
  CANDIDATE_CREATED = "CANDIDATE_CREATED",
  CANDIDATE_UPDATED = "CANDIDATE_UPDATED",
  CANDIDATE_DELETED = "CANDIDATE_DELETED",
  CANDIDATE_STATUS_CHANGED = "CANDIDATE_STATUS_CHANGED",
  CANDIDATE_ASSIGNED = "CANDIDATE_ASSIGNED",
  CANDIDATE_UNASSIGNED = "CANDIDATE_UNASSIGNED",
  CANDIDATE_VIEWED = "CANDIDATE_VIEWED",

  // ============================================
  // CANDIDATE DOCUMENT EVENTS
  // ============================================
  CANDIDATE_DOCUMENT_UPLOADED = "CANDIDATE_DOCUMENT_UPLOADED",
  CANDIDATE_DOCUMENT_DELETED = "CANDIDATE_DOCUMENT_DELETED",
  CANDIDATE_RESUME_PARSED = "CANDIDATE_RESUME_PARSED",
  CANDIDATE_VIDEO_UPLOADED = "CANDIDATE_VIDEO_UPLOADED",
  CANDIDATE_VIDEO_DELETED = "CANDIDATE_VIDEO_DELETED",

  // ============================================
  // JOB POSTING EVENTS
  // ============================================
  JOB_CREATED = "JOB_CREATED",
  JOB_UPDATED = "JOB_UPDATED",
  JOB_DELETED = "JOB_DELETED",
  JOB_VIEWED = "JOB_VIEWED",

  // ============================================
  // AI/ANALYSIS EVENTS
  // ============================================
  AI_ANALYSIS_REQUESTED = "AI_ANALYSIS_REQUESTED",
  AI_ANALYSIS_COMPLETED = "AI_ANALYSIS_COMPLETED",
  AI_ANALYSIS_FAILED = "AI_ANALYSIS_FAILED",
  PERSONALITY_ASSESSMENT_GENERATED = "PERSONALITY_ASSESSMENT_GENERATED",
  SKILL_ANALYSIS_COMPLETED = "SKILL_ANALYSIS_COMPLETED",
  TRANSCRIPT_GENERATED = "TRANSCRIPT_GENERATED",
  VIDEO_ANALYSIS_COMPLETED = "VIDEO_ANALYSIS_COMPLETED",

  // ============================================
  // COMMENT/COLLABORATION EVENTS
  // ============================================
  COMMENT_CREATED = "COMMENT_CREATED",
  COMMENT_UPDATED = "COMMENT_UPDATED",
  COMMENT_DELETED = "COMMENT_DELETED",
  COMMENT_MENTION = "COMMENT_MENTION",

  // ============================================
  // NOTIFICATION EVENTS
  // ============================================
  NOTIFICATION_SENT = "NOTIFICATION_SENT",
  NOTIFICATION_PREFERENCES_UPDATED = "NOTIFICATION_PREFERENCES_UPDATED",
  EMAIL_SENT = "EMAIL_SENT",
  EMAIL_FAILED = "EMAIL_FAILED",

  // ============================================
  // REPORTING EVENTS
  // ============================================
  REPORT_GENERATED = "REPORT_GENERATED",

  // ============================================
  // DATA ACCESS EVENTS
  // ============================================
  PROFILE_VIEWED = "PROFILE_VIEWED",
  FILE_UPLOADED = "FILE_UPLOADED",
  FILE_DOWNLOADED = "FILE_DOWNLOADED",
  FILE_DELETED = "FILE_DELETED",

  // ============================================
  // ADMIN EVENTS
  // ============================================
  BULK_OPERATION_PERFORMED = "BULK_OPERATION_PERFORMED",

  // ============================================
  // DATA PRIVACY/COMPLIANCE EVENTS
  // ============================================
  PII_VIEWED = "PII_VIEWED",

  // ============================================
  // INTEGRATION/WEBHOOK EVENTS
  // ============================================
  WEBHOOK_CONFIGURED = "WEBHOOK_CONFIGURED",
  WEBHOOK_TRIGGERED = "WEBHOOK_TRIGGERED",
  WEBHOOK_FAILED = "WEBHOOK_FAILED",

  // ============================================
  // SYSTEM EVENTS
  // ============================================
  SYSTEM_ERROR = "SYSTEM_ERROR",
}

export enum AuditSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}
