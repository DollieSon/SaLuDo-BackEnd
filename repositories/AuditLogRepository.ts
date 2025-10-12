// =======================
// AUDIT LOG REPOSITORY
// =======================
// Purpose: Persist and manage security audit logs in MongoDB
// Related: Security events, user operations, compliance tracking
// =======================

import { Db, Collection } from 'mongodb';

export enum AuditEventType {
  // Authentication Events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  
  // User Management Events
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  
  // Password Events
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  
  // Security Events
  FAILED_LOGIN_ATTEMPT = 'FAILED_LOGIN_ATTEMPT',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  
  // Data Access Events
  PROFILE_VIEWED = 'PROFILE_VIEWED',
  SENSITIVE_DATA_ACCESSED = 'SENSITIVE_DATA_ACCESSED',
  FILE_UPLOADED = 'FILE_UPLOADED',
  FILE_DOWNLOADED = 'FILE_DOWNLOADED',
  
  // System Events
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  CONFIG_CHANGED = 'CONFIG_CHANGED',
  BACKUP_CREATED = 'BACKUP_CREATED'
}

export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface AuditLogEntry {
  _id?: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  userEmail?: string;
  targetUserId?: string; // For operations on other users
  sessionId?: string;
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
  details: {
    action: string;
    resource?: string;
    resourceId?: string;
    oldValue?: any;
    newValue?: any;
    error?: string;
    metadata?: Record<string, any>;
  };
  success: boolean;
  duration?: number; // Operation duration in milliseconds
  location?: {
    country?: string;
    city?: string;
    timezone?: string;
  };
}

export interface AuditLogFilter {
  eventType?: AuditEventType | AuditEventType[];
  severity?: AuditSeverity | AuditSeverity[];
  userId?: string;
  ipAddress?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  skip?: number;
}

export class AuditLogRepository {
  private db: Db;
  private collection: Collection<AuditLogEntry>;

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection('audit_logs');
    this.ensureIndexes();
  }

  // Create indexes for performance and compliance
  private async ensureIndexes(): Promise<void> {
    try {
      // Compound index for common queries
      await this.collection.createIndex({ 
        eventType: 1, 
        timestamp: -1 
      });
      
      // Index for user-specific queries
      await this.collection.createIndex({ userId: 1, timestamp: -1 });
      
      // Index for IP-based queries (security monitoring)
      await this.collection.createIndex({ ipAddress: 1, timestamp: -1 });
      
      // Index for severity-based queries
      await this.collection.createIndex({ severity: 1, timestamp: -1 });
      
      // Index for session tracking
      await this.collection.createIndex({ sessionId: 1, timestamp: -1 });
      
      // Text index for searching details
      await this.collection.createIndex({ 
        'details.action': 'text',
        'details.resource': 'text',
        userEmail: 'text'
      });
      
      // TTL index for automatic log rotation (keep logs for 2 years)
      await this.collection.createIndex(
        { timestamp: 1 },
        { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 } // 2 years
      );
      
      console.log('Audit log indexes created successfully');
    } catch (error) {
      console.error('Failed to create audit log indexes:', error);
    }
  }

  // Log a security event
  async logEvent(entry: Omit<AuditLogEntry, 'timestamp' | '_id'>): Promise<string> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date()
    };

    try {
      const result = await this.collection.insertOne(auditEntry);
      
      // Log critical events to console immediately
      if (entry.severity === AuditSeverity.CRITICAL) {
        console.error('CRITICAL SECURITY EVENT:', {
          eventType: entry.eventType,
          userId: entry.userId,
          ipAddress: entry.ipAddress,
          details: entry.details,
          timestamp: auditEntry.timestamp
        });
      }
      
      return result.insertedId.toString();
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // In production, you might want to use a fallback logging mechanism
      throw error;
    }
  }

  // Batch log multiple events (for performance)
  async logEvents(entries: Omit<AuditLogEntry, 'timestamp' | '_id'>[]): Promise<string[]> {
    const auditEntries: AuditLogEntry[] = entries.map(entry => ({
      ...entry,
      timestamp: new Date()
    }));

    try {
      const result = await this.collection.insertMany(auditEntries);
      return Object.values(result.insertedIds).map(id => id.toString());
    } catch (error) {
      console.error('Failed to batch log audit events:', error);
      throw error;
    }
  }

  // Get audit logs with filtering and pagination
  async getAuditLogs(filter: AuditLogFilter = {}): Promise<{
    logs: AuditLogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    const query: any = {};
    
    // Build MongoDB query from filter
    if (filter.eventType) {
      query.eventType = Array.isArray(filter.eventType) 
        ? { $in: filter.eventType }
        : filter.eventType;
    }
    
    if (filter.severity) {
      query.severity = Array.isArray(filter.severity)
        ? { $in: filter.severity }
        : filter.severity;
    }
    
    if (filter.userId) {
      query.userId = filter.userId;
    }
    
    if (filter.ipAddress) {
      query.ipAddress = filter.ipAddress;
    }
    
    if (filter.success !== undefined) {
      query.success = filter.success;
    }
    
    if (filter.startDate || filter.endDate) {
      query.timestamp = {};
      if (filter.startDate) {
        query.timestamp.$gte = filter.startDate;
      }
      if (filter.endDate) {
        query.timestamp.$lte = filter.endDate;
      }
    }

    const limit = filter.limit || 50;
    const skip = filter.skip || 0;

    try {
      const [logs, total] = await Promise.all([
        this.collection
          .find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        this.collection.countDocuments(query)
      ]);

      return {
        logs,
        total,
        hasMore: skip + logs.length < total
      };
    } catch (error) {
      console.error('Failed to retrieve audit logs:', error);
      throw error;
    }
  }

  // Get security alerts (high/critical severity events)
  async getSecurityAlerts(hours: number = 24): Promise<AuditLogEntry[]> {
    const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    try {
      return await this.collection
        .find({
          severity: { $in: [AuditSeverity.HIGH, AuditSeverity.CRITICAL] },
          timestamp: { $gte: startTime }
        })
        .sort({ timestamp: -1 })
        .toArray();
    } catch (error) {
      console.error('Failed to retrieve security alerts:', error);
      throw error;
    }
  }

  // Get user activity summary
  async getUserActivitySummary(userId: string, days: number = 30): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    lastActivity: Date | null;
    failedLogins: number;
  }> {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    try {
      const [totalEvents, eventsByType, lastActivity, failedLogins] = await Promise.all([
        // Total events
        this.collection.countDocuments({
          userId,
          timestamp: { $gte: startDate }
        }),
        
        // Events by type
        this.collection.aggregate([
          {
            $match: {
              userId,
              timestamp: { $gte: startDate }
            }
          },
          {
            $group: {
              _id: '$eventType',
              count: { $sum: 1 }
            }
          }
        ]).toArray(),
        
        // Last activity
        this.collection.findOne(
          { userId },
          { sort: { timestamp: -1 } }
        ),
        
        // Failed login attempts
        this.collection.countDocuments({
          userId,
          eventType: AuditEventType.LOGIN_FAILURE,
          timestamp: { $gte: startDate }
        })
      ]);

      const eventsByTypeObj: Record<string, number> = {};
      eventsByType.forEach((item: any) => {
        eventsByTypeObj[item._id] = item.count;
      });

      return {
        totalEvents,
        eventsByType: eventsByTypeObj,
        lastActivity: lastActivity?.timestamp || null,
        failedLogins
      };
    } catch (error) {
      console.error('Failed to get user activity summary:', error);
      throw error;
    }
  }

  // Clean up old audit logs beyond retention period
  async cleanupOldLogs(retentionDays: number = 730): Promise<number> {
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
    
    try {
      const result = await this.collection.deleteMany({
        timestamp: { $lt: cutoffDate }
      });
      
      if (result.deletedCount > 0) {
        console.log(`Cleaned up ${result.deletedCount} old audit log entries`);
      }
      
      return result.deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error);
      throw error;
    }
  }

  // Get audit statistics
  async getAuditStatistics(days: number = 30): Promise<{
    totalEvents: number;
    securityEvents: number;
    failedAttempts: number;
    uniqueUsers: number;
    uniqueIPs: number;
    eventsByDay: Array<{ date: string; count: number }>;
  }> {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    try {
      const [stats] = await this.collection.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate }
          }
        },
        {
          $facet: {
            totalEvents: [{ $count: 'count' }],
            securityEvents: [
              {
                $match: {
                  eventType: {
                    $in: [
                      AuditEventType.FAILED_LOGIN_ATTEMPT,
                      AuditEventType.SUSPICIOUS_ACTIVITY,
                      AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
                      AuditEventType.RATE_LIMIT_EXCEEDED
                    ]
                  }
                }
              },
              { $count: 'count' }
            ],
            failedAttempts: [
              {
                $match: {
                  success: false
                }
              },
              { $count: 'count' }
            ],
            uniqueUsers: [
              {
                $group: {
                  _id: '$userId'
                }
              },
              { $count: 'count' }
            ],
            uniqueIPs: [
              {
                $group: {
                  _id: '$ipAddress'
                }
              },
              { $count: 'count' }
            ],
            eventsByDay: [
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$timestamp'
                    }
                  },
                  count: { $sum: 1 }
                }
              },
              {
                $sort: { _id: 1 }
              }
            ]
          }
        }
      ]).toArray();

      return {
        totalEvents: stats.totalEvents[0]?.count || 0,
        securityEvents: stats.securityEvents[0]?.count || 0,
        failedAttempts: stats.failedAttempts[0]?.count || 0,
        uniqueUsers: stats.uniqueUsers[0]?.count || 0,
        uniqueIPs: stats.uniqueIPs[0]?.count || 0,
        eventsByDay: stats.eventsByDay.map((item: any) => ({
          date: item._id,
          count: item.count
        }))
      };
    } catch (error) {
      console.error('Failed to get audit statistics:', error);
      throw error;
    }
  }
}