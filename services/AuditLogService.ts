// =======================
// AUDIT LOG SERVICE
// =======================
// Purpose: Business logic for security audit logging and compliance tracking
// Related: AuditLogRepository, security events, user operations
// =======================

import { AuditLogRepository, AuditEventType, AuditSeverity, AuditLogEntry, AuditLogFilter } from '../repositories/AuditLogRepository';
import { User, UserRole } from '../Models/User';
import { AuditContext, SecurityAlert } from './types/AuthenticationTypes';

export class AuditLogService {
  private auditLogRepository: AuditLogRepository;
  private suspiciousActivityThresholds: Map<string, number>;

  constructor(auditLogRepository: AuditLogRepository) {
    this.auditLogRepository = auditLogRepository;
    
    // Configure thresholds for suspicious activity detection
    this.suspiciousActivityThresholds = new Map([
      ['failed_logins_per_hour', 10],
      ['password_changes_per_day', 5],
      ['account_lockouts_per_day', 3],
      ['rate_limits_per_hour', 20]
    ]);
  }

  // Log authentication events
  async logAuthenticationEvent(
    eventType: AuditEventType.LOGIN_SUCCESS | AuditEventType.LOGIN_FAILURE | AuditEventType.LOGOUT,
    context: AuditContext,
    details: {
      action: string;
      error?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    const severity = eventType === AuditEventType.LOGIN_FAILURE 
      ? AuditSeverity.MEDIUM 
      : AuditSeverity.LOW;

    const entry: Omit<AuditLogEntry, 'timestamp' | '_id'> = {
      eventType,
      severity,
      userId: context.userId,
      userEmail: context.userEmail,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details,
      success: eventType !== AuditEventType.LOGIN_FAILURE
    };

    const logId = await this.auditLogRepository.logEvent(entry);

    // Check for suspicious activity after login failures
    if (eventType === AuditEventType.LOGIN_FAILURE) {
      await this.checkSuspiciousActivity(context);
    }

    return logId;
  }

  // Log user management events
  async logUserManagementEvent(
    eventType: AuditEventType,
    context: AuditContext,
    targetUserId?: string,
    details: {
      action: string;
      resource?: string;
      oldValue?: any;
      newValue?: any;
      metadata?: Record<string, any>;
    } = { action: 'Unknown action' }
  ): Promise<string> {
    const severity = this.getSeverityForUserEvent(eventType);

    const entry: Omit<AuditLogEntry, 'timestamp' | '_id'> = {
      eventType,
      severity,
      userId: context.userId,
      userEmail: context.userEmail,
      targetUserId,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details,
      success: true
    };

    return await this.auditLogRepository.logEvent(entry);
  }

  // Log security events
  async logSecurityEvent(
    eventType: AuditEventType,
    context: AuditContext,
    details: {
      action: string;
      resource?: string;
      error?: string;
      metadata?: Record<string, any>;
    },
    success: boolean = false
  ): Promise<string> {
    const severity = this.getSeverityForSecurityEvent(eventType);

    const entry: Omit<AuditLogEntry, 'timestamp' | '_id'> = {
      eventType,
      severity,
      userId: context.userId,
      userEmail: context.userEmail,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details,
      success
    };

    const logId = await this.auditLogRepository.logEvent(entry);

    // Trigger real-time alerts for critical security events
    if (severity === AuditSeverity.CRITICAL) {
      await this.triggerSecurityAlert(entry);
    }

    return logId;
  }

  // Log password-related events
  async logPasswordEvent(
    eventType: AuditEventType.PASSWORD_CHANGED | AuditEventType.PASSWORD_RESET | AuditEventType.PASSWORD_RESET_REQUESTED,
    context: AuditContext,
    success: boolean = true,
    details: {
      action: string;
      error?: string;
      metadata?: Record<string, any>;
    } = { action: 'Password operation' }
  ): Promise<string> {
    const severity = success ? AuditSeverity.MEDIUM : AuditSeverity.HIGH;

    const entry: Omit<AuditLogEntry, 'timestamp' | '_id'> = {
      eventType,
      severity,
      userId: context.userId,
      userEmail: context.userEmail,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details,
      success
    };

    const logId = await this.auditLogRepository.logEvent(entry);

    // Check for excessive password changes
    if (eventType === AuditEventType.PASSWORD_CHANGED && context.userId) {
      await this.checkExcessivePasswordChanges(context.userId, context.ipAddress);
    }

    return logId;
  }

  // Log data access events
  async logDataAccessEvent(
    eventType: AuditEventType,
    context: AuditContext,
    resource: string,
    resourceId: string,
    success: boolean = true,
    details: Record<string, any> = {}
  ): Promise<string> {
    const entry: Omit<AuditLogEntry, 'timestamp' | '_id'> = {
      eventType,
      severity: AuditSeverity.LOW,
      userId: context.userId,
      userEmail: context.userEmail,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: {
        action: `Access ${resource}`,
        resource,
        resourceId,
        metadata: details
      },
      success
    };

    return await this.auditLogRepository.logEvent(entry);
  }

  // Get audit logs with filtering
  async getAuditLogs(filter: AuditLogFilter): Promise<{
    logs: AuditLogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    return await this.auditLogRepository.getAuditLogs(filter);
  }

  // Get security alerts
  async getSecurityAlerts(hours: number = 24): Promise<SecurityAlert[]> {
    const alerts = await this.auditLogRepository.getSecurityAlerts(hours);
    
    return alerts.map(alert => ({
      id: alert._id!,
      type: alert.eventType,
      severity: alert.severity,
      message: this.generateAlertMessage(alert),
      timestamp: alert.timestamp,
      userId: alert.userId,
      ipAddress: alert.ipAddress,
      details: alert.details
    }));
  }

  // Get user activity summary
  async getUserActivitySummary(userId: string, days: number = 30) {
    return await this.auditLogRepository.getUserActivitySummary(userId, days);
  }

  // Get audit statistics
  async getAuditStatistics(days: number = 30) {
    return await this.auditLogRepository.getAuditStatistics(days);
  }

  // Check for suspicious activity patterns
  private async checkSuspiciousActivity(context: AuditContext): Promise<void> {
    if (!context.userId && !context.ipAddress) return;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Check failed login attempts from this IP
    const recentFailures = await this.auditLogRepository.getAuditLogs({
      eventType: AuditEventType.LOGIN_FAILURE,
      ipAddress: context.ipAddress,
      startDate: oneHourAgo,
      limit: 100
    });

    const failureThreshold = this.suspiciousActivityThresholds.get('failed_logins_per_hour') || 10;
    
    if (recentFailures.logs.length >= failureThreshold) {
      await this.logSecurityEvent(
        AuditEventType.SUSPICIOUS_ACTIVITY,
        context,
        {
          action: 'Excessive failed login attempts detected',
          metadata: {
            failureCount: recentFailures.logs.length,
            threshold: failureThreshold,
            timeWindow: '1 hour'
          }
        }
      );
    }
  }

  // Check for excessive password changes
  private async checkExcessivePasswordChanges(userId: string, ipAddress: string): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recentChanges = await this.auditLogRepository.getAuditLogs({
      eventType: AuditEventType.PASSWORD_CHANGED,
      userId,
      startDate: oneDayAgo,
      limit: 50
    });

    const changeThreshold = this.suspiciousActivityThresholds.get('password_changes_per_day') || 5;
    
    if (recentChanges.logs.length >= changeThreshold) {
      await this.auditLogRepository.logEvent({
        eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
        severity: AuditSeverity.HIGH,
        userId,
        ipAddress,
        details: {
          action: 'Excessive password changes detected',
          metadata: {
            changeCount: recentChanges.logs.length,
            threshold: changeThreshold,
            timeWindow: '24 hours'
          }
        },
        success: false
      });
    }
  }

  // Get severity level for user management events
  private getSeverityForUserEvent(eventType: AuditEventType): AuditSeverity {
    switch (eventType) {
      case AuditEventType.USER_DELETED:
        return AuditSeverity.HIGH;
      case AuditEventType.USER_CREATED:
      case AuditEventType.USER_DEACTIVATED:
        return AuditSeverity.MEDIUM;
      default:
        return AuditSeverity.LOW;
    }
  }

  // Get severity level for security events
  private getSeverityForSecurityEvent(eventType: AuditEventType): AuditSeverity {
    switch (eventType) {
      case AuditEventType.SUSPICIOUS_ACTIVITY:
      case AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT:
        return AuditSeverity.CRITICAL;
      case AuditEventType.ACCOUNT_LOCKED:
      case AuditEventType.FAILED_LOGIN_ATTEMPT:
        return AuditSeverity.HIGH;
      case AuditEventType.RATE_LIMIT_EXCEEDED:
        return AuditSeverity.MEDIUM;
      default:
        return AuditSeverity.LOW;
    }
  }

  // Generate human-readable alert messages
  private generateAlertMessage(alert: AuditLogEntry): string {
    switch (alert.eventType) {
      case AuditEventType.SUSPICIOUS_ACTIVITY:
        return `Suspicious activity detected from ${alert.ipAddress}`;
      case AuditEventType.FAILED_LOGIN_ATTEMPT:
        return `Failed login attempt for user ${alert.userEmail || alert.userId}`;
      case AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT:
        return `Unauthorized access attempt to ${alert.details.resource || 'protected resource'}`;
      case AuditEventType.RATE_LIMIT_EXCEEDED:
        return `Rate limit exceeded from ${alert.ipAddress}`;
      case AuditEventType.ACCOUNT_LOCKED:
        return `Account locked for user ${alert.userEmail || alert.userId}`;
      default:
        return `Security event: ${alert.eventType}`;
    }
  }

  // Trigger security alert (could send notifications, emails, etc.)
  private async triggerSecurityAlert(entry: Omit<AuditLogEntry, 'timestamp' | '_id'>): Promise<void> {
    // In production, this could send notifications to security team
    console.error('🚨 CRITICAL SECURITY ALERT:', {
      type: entry.eventType,
      user: entry.userEmail || entry.userId,
      ip: entry.ipAddress,
      details: entry.details,
      timestamp: new Date().toISOString()
    });
    
    // TODO: Implement notification system (email, Slack, SMS, etc.)
    // await this.notificationService.sendSecurityAlert(entry);
  }

  // Create audit context from request
  static createAuditContext(
    req: any,
    user?: User,
    sessionId?: string
  ): AuditContext {
    return {
      userId: user?.userId,
      userEmail: user?.email,
      userRole: user?.role,
      sessionId,
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent'),
      requestId: req.id // If you have request ID middleware
    };
  }
}