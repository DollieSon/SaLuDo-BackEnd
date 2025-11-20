/**
 * Notification System Type Definitions
 * Defines all enums and types used across the notification system
 */

/**
 * Notification Types - Extensible enum for all notification events
 */
export enum NotificationType {
  // Candidate Events
  CANDIDATE_APPLIED = 'CANDIDATE_APPLIED',
  CANDIDATE_STATUS_CHANGED = 'CANDIDATE_STATUS_CHANGED',
  CANDIDATE_DOCUMENT_UPLOADED = 'CANDIDATE_DOCUMENT_UPLOADED',
  CANDIDATE_AI_ANALYSIS_COMPLETE = 'CANDIDATE_AI_ANALYSIS_COMPLETE',
  CANDIDATE_ASSIGNED = 'CANDIDATE_ASSIGNED',
  
  // Job Events
  JOB_POSTED = 'JOB_POSTED',
  JOB_UPDATED = 'JOB_UPDATED',
  JOB_CLOSED = 'JOB_CLOSED',
  JOB_APPLICATION_RECEIVED = 'JOB_APPLICATION_RECEIVED',
  
  // Interview Events
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  INTERVIEW_REMINDER = 'INTERVIEW_REMINDER',
  INTERVIEW_COMPLETED = 'INTERVIEW_COMPLETED',
  INTERVIEW_CANCELLED = 'INTERVIEW_CANCELLED',
  
  // User Management Events
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  
  // Security Events
  SECURITY_ALERT = 'SECURITY_ALERT',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  MULTIPLE_FAILED_LOGINS = 'MULTIPLE_FAILED_LOGINS',
  
  // Comment System Events (Future)
  COMMENT_MENTION = 'COMMENT_MENTION',
  COMMENT_REPLY = 'COMMENT_REPLY',
  COMMENT_ON_CANDIDATE = 'COMMENT_ON_CANDIDATE',
  COMMENT_ON_JOB = 'COMMENT_ON_JOB',
  COMMENT_EDITED = 'COMMENT_EDITED',
  COMMENT_DELETED = 'COMMENT_DELETED',
  
  // System Events
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  SYSTEM_UPDATE = 'SYSTEM_UPDATE',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  BACKUP_COMPLETED = 'BACKUP_COMPLETED',
  
  // Admin Broadcast
  ADMIN_ANNOUNCEMENT = 'ADMIN_ANNOUNCEMENT',
  EMERGENCY_ALERT = 'EMERGENCY_ALERT'
}

/**
 * Notification Categories - High-level grouping for preference management
 */
export enum NotificationCategory {
  HR_ACTIVITIES = 'HR_ACTIVITIES',
  SECURITY_ALERTS = 'SECURITY_ALERTS',
  SYSTEM_UPDATES = 'SYSTEM_UPDATES',
  COMMENTS = 'COMMENTS',
  INTERVIEWS = 'INTERVIEWS',
  ADMIN = 'ADMIN'
}

/**
 * Notification Priority Levels
 */
export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Notification Delivery Channels
 */
export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
  SMS = 'SMS',
  WEBHOOK = 'WEBHOOK'
}

/**
 * Delivery Status for tracking
 */
export enum DeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  READ = 'READ'
}

/**
 * Email Digest Frequency
 */
export enum DigestFrequency {
  IMMEDIATE = 'IMMEDIATE',
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  NEVER = 'NEVER'
}

/**
 * Map notification types to their default categories
 */
export const NOTIFICATION_TYPE_TO_CATEGORY: Record<NotificationType, NotificationCategory> = {
  // Candidate Events
  [NotificationType.CANDIDATE_APPLIED]: NotificationCategory.HR_ACTIVITIES,
  [NotificationType.CANDIDATE_STATUS_CHANGED]: NotificationCategory.HR_ACTIVITIES,
  [NotificationType.CANDIDATE_DOCUMENT_UPLOADED]: NotificationCategory.HR_ACTIVITIES,
  [NotificationType.CANDIDATE_AI_ANALYSIS_COMPLETE]: NotificationCategory.HR_ACTIVITIES,
  [NotificationType.CANDIDATE_ASSIGNED]: NotificationCategory.HR_ACTIVITIES,
  
  // Job Events
  [NotificationType.JOB_POSTED]: NotificationCategory.HR_ACTIVITIES,
  [NotificationType.JOB_UPDATED]: NotificationCategory.HR_ACTIVITIES,
  [NotificationType.JOB_CLOSED]: NotificationCategory.HR_ACTIVITIES,
  [NotificationType.JOB_APPLICATION_RECEIVED]: NotificationCategory.HR_ACTIVITIES,
  
  // Interview Events
  [NotificationType.INTERVIEW_SCHEDULED]: NotificationCategory.INTERVIEWS,
  [NotificationType.INTERVIEW_REMINDER]: NotificationCategory.INTERVIEWS,
  [NotificationType.INTERVIEW_COMPLETED]: NotificationCategory.INTERVIEWS,
  [NotificationType.INTERVIEW_CANCELLED]: NotificationCategory.INTERVIEWS,
  
  // User Management
  [NotificationType.USER_CREATED]: NotificationCategory.ADMIN,
  [NotificationType.USER_UPDATED]: NotificationCategory.ADMIN,
  [NotificationType.USER_ROLE_CHANGED]: NotificationCategory.ADMIN,
  [NotificationType.PASSWORD_RESET_REQUESTED]: NotificationCategory.SECURITY_ALERTS,
  [NotificationType.PASSWORD_CHANGED]: NotificationCategory.SECURITY_ALERTS,
  
  // Security
  [NotificationType.SECURITY_ALERT]: NotificationCategory.SECURITY_ALERTS,
  [NotificationType.UNAUTHORIZED_ACCESS_ATTEMPT]: NotificationCategory.SECURITY_ALERTS,
  [NotificationType.SUSPICIOUS_ACTIVITY]: NotificationCategory.SECURITY_ALERTS,
  [NotificationType.ACCOUNT_LOCKED]: NotificationCategory.SECURITY_ALERTS,
  [NotificationType.MULTIPLE_FAILED_LOGINS]: NotificationCategory.SECURITY_ALERTS,
  
  // Comments
  [NotificationType.COMMENT_MENTION]: NotificationCategory.COMMENTS,
  [NotificationType.COMMENT_REPLY]: NotificationCategory.COMMENTS,
  [NotificationType.COMMENT_ON_CANDIDATE]: NotificationCategory.COMMENTS,
  [NotificationType.COMMENT_ON_JOB]: NotificationCategory.COMMENTS,
  [NotificationType.COMMENT_EDITED]: NotificationCategory.COMMENTS,
  [NotificationType.COMMENT_DELETED]: NotificationCategory.COMMENTS,
  
  // System
  [NotificationType.SYSTEM_MAINTENANCE]: NotificationCategory.SYSTEM_UPDATES,
  [NotificationType.SYSTEM_UPDATE]: NotificationCategory.SYSTEM_UPDATES,
  [NotificationType.SYSTEM_ERROR]: NotificationCategory.SYSTEM_UPDATES,
  [NotificationType.BACKUP_COMPLETED]: NotificationCategory.SYSTEM_UPDATES,
  
  // Admin
  [NotificationType.ADMIN_ANNOUNCEMENT]: NotificationCategory.ADMIN,
  [NotificationType.EMERGENCY_ALERT]: NotificationCategory.ADMIN
};

/**
 * Default priority mapping for notification types
 */
export const NOTIFICATION_TYPE_TO_PRIORITY: Record<NotificationType, NotificationPriority> = {
  // Candidate Events - Medium priority
  [NotificationType.CANDIDATE_APPLIED]: NotificationPriority.MEDIUM,
  [NotificationType.CANDIDATE_STATUS_CHANGED]: NotificationPriority.MEDIUM,
  [NotificationType.CANDIDATE_DOCUMENT_UPLOADED]: NotificationPriority.LOW,
  [NotificationType.CANDIDATE_AI_ANALYSIS_COMPLETE]: NotificationPriority.LOW,
  [NotificationType.CANDIDATE_ASSIGNED]: NotificationPriority.HIGH,
  
  // Job Events
  [NotificationType.JOB_POSTED]: NotificationPriority.MEDIUM,
  [NotificationType.JOB_UPDATED]: NotificationPriority.LOW,
  [NotificationType.JOB_CLOSED]: NotificationPriority.MEDIUM,
  [NotificationType.JOB_APPLICATION_RECEIVED]: NotificationPriority.MEDIUM,
  
  // Interview Events - High priority
  [NotificationType.INTERVIEW_SCHEDULED]: NotificationPriority.HIGH,
  [NotificationType.INTERVIEW_REMINDER]: NotificationPriority.HIGH,
  [NotificationType.INTERVIEW_COMPLETED]: NotificationPriority.MEDIUM,
  [NotificationType.INTERVIEW_CANCELLED]: NotificationPriority.HIGH,
  
  // User Management
  [NotificationType.USER_CREATED]: NotificationPriority.MEDIUM,
  [NotificationType.USER_UPDATED]: NotificationPriority.LOW,
  [NotificationType.USER_ROLE_CHANGED]: NotificationPriority.HIGH,
  [NotificationType.PASSWORD_RESET_REQUESTED]: NotificationPriority.MEDIUM,
  [NotificationType.PASSWORD_CHANGED]: NotificationPriority.MEDIUM,
  
  // Security - High/Critical priority
  [NotificationType.SECURITY_ALERT]: NotificationPriority.CRITICAL,
  [NotificationType.UNAUTHORIZED_ACCESS_ATTEMPT]: NotificationPriority.HIGH,
  [NotificationType.SUSPICIOUS_ACTIVITY]: NotificationPriority.HIGH,
  [NotificationType.ACCOUNT_LOCKED]: NotificationPriority.CRITICAL,
  [NotificationType.MULTIPLE_FAILED_LOGINS]: NotificationPriority.HIGH,
  
  // Comments - Low/Medium priority
  [NotificationType.COMMENT_MENTION]: NotificationPriority.MEDIUM,
  [NotificationType.COMMENT_REPLY]: NotificationPriority.LOW,
  [NotificationType.COMMENT_ON_CANDIDATE]: NotificationPriority.LOW,
  [NotificationType.COMMENT_ON_JOB]: NotificationPriority.LOW,
  [NotificationType.COMMENT_EDITED]: NotificationPriority.LOW,
  [NotificationType.COMMENT_DELETED]: NotificationPriority.LOW,
  
  // System
  [NotificationType.SYSTEM_MAINTENANCE]: NotificationPriority.HIGH,
  [NotificationType.SYSTEM_UPDATE]: NotificationPriority.LOW,
  [NotificationType.SYSTEM_ERROR]: NotificationPriority.HIGH,
  [NotificationType.BACKUP_COMPLETED]: NotificationPriority.LOW,
  
  // Admin - Critical
  [NotificationType.ADMIN_ANNOUNCEMENT]: NotificationPriority.MEDIUM,
  [NotificationType.EMERGENCY_ALERT]: NotificationPriority.CRITICAL
};
