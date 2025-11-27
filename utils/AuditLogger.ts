/**
 * Audit Logger Utility
 * Provides easy-to-use methods for logging audit events throughout the application
 */

import { AuditLogRepository, AuditLogEntry } from '../repositories/AuditLogRepository';
import { AuditEventType, AuditSeverity } from '../types/AuditEventTypes';
import { connectDB } from '../mongo_db';

export class AuditLogger {
  private static repository: AuditLogRepository | null = null;

  /**
   * Initialize the audit logger
   */
  private static async init(): Promise<void> {
    if (!this.repository) {
      const db = await connectDB();
      this.repository = new AuditLogRepository(db);
    }
  }

  /**
   * Log an audit event
   */
  static async log(params: {
    eventType: AuditEventType;
    severity?: AuditSeverity;
    userId?: string;
    userEmail?: string;
    targetUserId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    action: string;
    resource?: string;
    resourceId?: string;
    oldValue?: any;
    newValue?: any;
    success?: boolean;
    error?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.init();

      const entry: Omit<AuditLogEntry, '_id'> = {
        eventType: params.eventType,
        severity: params.severity || this.getDefaultSeverity(params.eventType),
        userId: params.userId,
        userEmail: params.userEmail,
        targetUserId: params.targetUserId,
        sessionId: params.sessionId,
        ipAddress: params.ipAddress || '',
        userAgent: params.userAgent || '',
        timestamp: new Date(),
        details: {
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId,
          oldValue: params.oldValue,
          newValue: params.newValue,
          error: params.error,
          metadata: params.metadata
        },
        success: params.success !== undefined ? params.success : !params.error
      };

      await this.repository!.logEvent(entry);
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - audit logging should not break the application
    }
  }

  /**
   * Get default severity based on event type
   */
  private static getDefaultSeverity(eventType: AuditEventType): AuditSeverity {
    // Security events
    if ([
      AuditEventType.FAILED_LOGIN_ATTEMPT,
      AuditEventType.ACCOUNT_LOCKED,
      AuditEventType.SUSPICIOUS_ACTIVITY,
      AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
      AuditEventType.RATE_LIMIT_EXCEEDED
    ].includes(eventType)) {
      return AuditSeverity.HIGH;
    }

    // Critical system events
    if ([
      AuditEventType.SYSTEM_ERROR,
      AuditEventType.DATA_DELETION_REQUESTED,
      AuditEventType.PERMISSION_REVOKED,
      AuditEventType.ROLE_CHANGED
    ].includes(eventType)) {
      return AuditSeverity.CRITICAL;
    }

    // Medium priority events
    if ([
      AuditEventType.USER_CREATED,
      AuditEventType.USER_DELETED,
      AuditEventType.PASSWORD_CHANGED,
      AuditEventType.CANDIDATE_DELETED,
      AuditEventType.JOB_DELETED,
      AuditEventType.CONFIG_CHANGED,
      AuditEventType.BULK_OPERATION_PERFORMED
    ].includes(eventType)) {
      return AuditSeverity.MEDIUM;
    }

    // Default to LOW for routine operations
    return AuditSeverity.LOW;
  }

  /**
   * Helper: Log candidate operations
   */
  static async logCandidateOperation(params: {
    eventType: AuditEventType;
    candidateId: string;
    candidateName?: string;
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    userAgent?: string;
    action: string;
    oldValue?: any;
    newValue?: any;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      ...params,
      resource: 'candidate',
      resourceId: params.candidateId,
      metadata: {
        ...params.metadata,
        candidateName: params.candidateName
      }
    });
  }

  /**
   * Helper: Log job operations
   */
  static async logJobOperation(params: {
    eventType: AuditEventType;
    jobId: string;
    jobTitle?: string;
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    userAgent?: string;
    action: string;
    oldValue?: any;
    newValue?: any;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      ...params,
      resource: 'job',
      resourceId: params.jobId,
      metadata: {
        ...params.metadata,
        jobTitle: params.jobTitle
      }
    });
  }

  /**
   * Helper: Log interview operations
   */
  static async logInterviewOperation(params: {
    eventType: AuditEventType;
    candidateId: string;
    interviewId?: string;
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    userAgent?: string;
    action: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      ...params,
      resource: 'interview',
      resourceId: params.interviewId || params.candidateId,
      metadata: {
        ...params.metadata,
        candidateId: params.candidateId
      }
    });
  }

  /**
   * Helper: Log AI operations
   */
  static async logAIOperation(params: {
    eventType: AuditEventType;
    candidateId?: string;
    userId?: string;
    userEmail?: string;
    action: string;
    success?: boolean;
    error?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      ...params,
      resource: 'ai_analysis',
      resourceId: params.candidateId,
      severity: params.error ? AuditSeverity.MEDIUM : AuditSeverity.LOW
    });
  }

  /**
   * Helper: Log comment operations
   */
  static async logCommentOperation(params: {
    eventType: AuditEventType;
    commentId: string;
    candidateId?: string;
    jobId?: string;
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    userAgent?: string;
    action: string;
    oldValue?: any;
    newValue?: any;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      ...params,
      resource: 'comment',
      resourceId: params.commentId,
      metadata: {
        ...params.metadata,
        candidateId: params.candidateId,
        jobId: params.jobId
      }
    });
  }

  /**
   * Helper: Log notification operations
   */
  static async logNotificationOperation(params: {
    eventType: AuditEventType;
    userId: string;
    notificationId?: string;
    action: string;
    success?: boolean;
    error?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      ...params,
      resource: 'notification',
      resourceId: params.notificationId,
      severity: params.error ? AuditSeverity.MEDIUM : AuditSeverity.LOW
    });
  }

  /**
   * Helper: Log file operations
   */
  static async logFileOperation(params: {
    eventType: AuditEventType;
    fileId: string;
    fileName?: string;
    fileType?: string;
    candidateId?: string;
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    userAgent?: string;
    action: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      ...params,
      resource: 'file',
      resourceId: params.fileId,
      metadata: {
        ...params.metadata,
        fileName: params.fileName,
        fileType: params.fileType,
        candidateId: params.candidateId
      }
    });
  }

  /**
   * Helper: Log user operations
   */
  static async logUserOperation(params: {
    eventType: AuditEventType;
    targetUserId: string;
    performedBy?: string;
    ipAddress?: string;
    userAgent?: string;
    action: string;
    oldValue?: any;
    newValue?: any;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      ...params,
      userId: params.performedBy,
      resource: 'user',
      resourceId: params.targetUserId
    });
  }
}
