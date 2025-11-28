/**
 * Notification Service
 * Business logic layer for notification management
 */

import { NotificationRepository } from '../repositories/NotificationRepository';
import { NotificationPreferencesRepository } from '../repositories/NotificationPreferencesRepository';
import { WebhookRepository } from '../repositories/WebhookRepository';
import { webSocketService } from './WebSocketService';
import { emailQueueService } from './EmailQueueService';
import { WebhookService } from './WebhookService';
import { AuditLogger } from '../utils/AuditLogger';
import { AuditEventType } from '../types/AuditEventTypes';
import {
  Notification,
  CreateNotificationData,
  NotificationFilter,
  NotificationSummary,
  NotificationDisplayData
} from '../Models/Notification';
import {
  NotificationPreferences,
  CreateNotificationPreferencesData,
  UpdateNotificationPreferencesData,
  PreferenceEvaluationResult
} from '../Models/NotificationPreferences';
import {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NotificationChannel,
  DeliveryStatus,
  DigestFrequency
} from '../Models/enums/NotificationTypes';

export class NotificationService {
  private notificationRepository: NotificationRepository;
  private notificationPreferencesRepository: NotificationPreferencesRepository;
  private webhookService: WebhookService | null = null;

  constructor(
    notificationRepository: NotificationRepository,
    notificationPreferencesRepository: NotificationPreferencesRepository,
    webhookRepository?: WebhookRepository
  ) {
    this.notificationRepository = notificationRepository;
    this.notificationPreferencesRepository = notificationPreferencesRepository;
    
    // Initialize webhook service if repository is provided
    if (webhookRepository) {
      this.webhookService = new WebhookService(webhookRepository);
    }
  }

  /**
   * Create and send a notification
   */
  async createNotification(data: CreateNotificationData): Promise<Notification | null> {
    try {
      // Evaluate user preferences
      const evaluation = await this.notificationPreferencesRepository.evaluatePreferences(
        data.userId,
        data.type,
        data.priority || NotificationPriority.MEDIUM
      );

      if (!evaluation.shouldNotify) {
        console.log(`Notification blocked for user ${data.userId}: ${evaluation.reason}`);
        return null;
      }

      // Override channels with evaluated channels
      const notificationData: CreateNotificationData = {
        ...data,
        channels: evaluation.channels.length > 0 ? evaluation.channels : data.channels
      };

      // Create notification
      const notification = await this.notificationRepository.create(notificationData);

      // Deliver via enabled channels
      await this.deliverNotification(notification);

      console.log(`Notification created and delivered: ${notification.notificationId} for user ${notification.userId}`);
      
      // Audit log notification sent
      await AuditLogger.logNotificationOperation({
        eventType: AuditEventType.NOTIFICATION_SENT,
        notificationId: notification.notificationId,
        userId: notification.userId,
        action: `Sent ${notification.type} notification: ${notification.title}`,
        metadata: {
          type: notification.type,
          priority: notification.priority,
          channels: notification.channels
        }
      });

      return notification;
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Deliver notification through enabled channels
   */
  private async deliverNotification(notification: Notification): Promise<void> {
    for (const channel of notification.channels) {
      try {
        switch (channel) {
          case NotificationChannel.IN_APP:
            // Send via WebSocket for real-time delivery
            webSocketService.sendNotificationToUser(notification.userId, notification);
            await this.notificationRepository.updateDeliveryStatus(
              notification.notificationId,
              channel,
              DeliveryStatus.DELIVERED
            );
            break;

          case NotificationChannel.EMAIL:
            // Check user's digest preferences before sending email
            const preferences = await this.notificationPreferencesRepository.getByUserId(notification.userId);
            
            // Skip immediate email if digest is enabled (unless IMMEDIATE or CRITICAL priority)
            const shouldSendImmediately = 
              !preferences ||
              !preferences.emailDigest.enabled ||
              preferences.emailDigest.frequency === DigestFrequency.IMMEDIATE ||
              notification.priority === NotificationPriority.CRITICAL;

            if (shouldSendImmediately) {
              // Queue email for async delivery
              try {
                await emailQueueService.queueEmail({
                  notification,
                  recipientEmail: notification.userEmail || '',
                  recipientName: notification.data?.recipientName
                });
                await this.notificationRepository.updateDeliveryStatus(
                  notification.notificationId,
                  channel,
                  DeliveryStatus.SENT
                );
              } catch (emailError) {
                console.error('Failed to queue email:', emailError);
                await this.notificationRepository.updateDeliveryStatus(
                  notification.notificationId,
                  channel,
                  DeliveryStatus.PENDING
                );
              }
            } else {
              // Mark as pending for digest
              await this.notificationRepository.updateDeliveryStatus(
                notification.notificationId,
                channel,
                DeliveryStatus.PENDING
              );
              console.log(`Email for notification ${notification.notificationId} queued for ${preferences.emailDigest.frequency} digest`);
            }
            break;

          case NotificationChannel.PUSH:
            // TODO: Push notification delivery (Phase 3)
            await this.notificationRepository.updateDeliveryStatus(
              notification.notificationId,
              channel,
              DeliveryStatus.PENDING
            );
            break;

          case NotificationChannel.SMS:
            // TODO: SMS delivery (Phase 3)
            await this.notificationRepository.updateDeliveryStatus(
              notification.notificationId,
              channel,
              DeliveryStatus.PENDING
            );
            break;

          case NotificationChannel.WEBHOOK:
            // Deliver via webhook service
            if (this.webhookService) {
              try {
                await this.webhookService.deliverNotification(notification);
                await this.notificationRepository.updateDeliveryStatus(
                  notification.notificationId,
                  channel,
                  DeliveryStatus.DELIVERED
                );
              } catch (webhookError) {
                console.error('Webhook delivery error:', webhookError);
                await this.notificationRepository.updateDeliveryStatus(
                  notification.notificationId,
                  channel,
                  DeliveryStatus.FAILED,
                  webhookError instanceof Error ? webhookError.message : 'Webhook delivery failed'
                );
              }
            } else {
              console.warn('Webhook service not initialized');
              await this.notificationRepository.updateDeliveryStatus(
                notification.notificationId,
                channel,
                DeliveryStatus.FAILED,
                'Webhook service not available'
              );
            }
            break;
        }
      } catch (error) {
        console.error(`Failed to deliver notification via ${channel}:`, error);
        await this.notificationRepository.updateDeliveryStatus(
          notification.notificationId,
          channel,
          DeliveryStatus.FAILED,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }

  /**
   * Create notifications for multiple users
   */
  async createBulkNotifications(
    userIds: string[],
    notificationData: Omit<CreateNotificationData, 'userId'>
  ): Promise<Notification[]> {
    const notifications: Notification[] = [];

    for (const userId of userIds) {
      const notification = await this.createNotification({
        ...notificationData,
        userId
      });

      if (notification) {
        notifications.push(notification);
      }
    }

    return notifications;
  }

  /**
   * Broadcast notification to all users (admin announcements)
   */
  async broadcastNotification(
    notificationData: Omit<CreateNotificationData, 'userId'>,
    excludeUserIds: string[] = []
  ): Promise<number> {
    try {
      // Get all active users
      const allPreferences = await this.notificationPreferencesRepository.getAllEnabledUsers();

      const userIds = allPreferences
        .map(pref => pref.userId)
        .filter(userId => !excludeUserIds.includes(userId));

      const notifications = await this.createBulkNotifications(userIds, notificationData);

      return notifications.length;
    } catch (error) {
      console.error('Failed to broadcast notification:', error);
      throw error;
    }
  }

  /**
   * Get notification by ID
   */
  async getNotification(notificationId: string): Promise<Notification | null> {
    return await this.notificationRepository.getById(notificationId);
  }

  /**
   * Get notifications with filtering
   */
  async getNotifications(
    filter: NotificationFilter
  ): Promise<{ notifications: Notification[]; total: number; hasMore: boolean }> {
    const result = await this.notificationRepository.find(filter);
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const hasMore = result.total > page * limit;

    return {
      notifications: result.notifications,
      total: result.total,
      hasMore
    };
  }

  /**
   * Get notifications for display (simplified format)
   */
  async getNotificationsForDisplay(
    userId: string,
    filter?: Partial<NotificationFilter>
  ): Promise<NotificationDisplayData[]> {
    const result = await this.notificationRepository.find({
      userId,
      ...filter
    });

    return result.notifications.map(notification => ({
      notificationId: notification.notificationId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      category: notification.category,
      priority: notification.priority,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      action: notification.action,
      groupCount: notification.groupCount
    }));
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    return await this.notificationRepository.markAsRead(notificationId);
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(notificationIds: string[]): Promise<number> {
    return await this.notificationRepository.markMultipleAsRead(notificationIds);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    return await this.notificationRepository.markAllAsReadForUser(userId);
  }

  /**
   * Archive notification
   */
  async archiveNotification(notificationId: string): Promise<boolean> {
    return await this.notificationRepository.archive(notificationId);
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    return await this.notificationRepository.delete(notificationId);
  }

  /**
   * Delete multiple notifications
   */
  async deleteMultipleNotifications(notificationIds: string[]): Promise<number> {
    return await this.notificationRepository.deleteMultiple(notificationIds);
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepository.getUnreadCount(userId);
  }

  /**
   * Get notification summary for a user
   */
  async getSummary(userId: string): Promise<NotificationSummary> {
    return await this.notificationRepository.getSummary(userId);
  }

  /**
   * Delete expired notifications (cleanup job)
   */
  async deleteExpiredNotifications(): Promise<number> {
    return await this.notificationRepository.deleteExpired();
  }

  // ==================== Preferences Management ====================

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    return await this.notificationPreferencesRepository.getOrCreate(userId);
  }

  /**
   * Create user preferences
   */
  async createPreferences(data: CreateNotificationPreferencesData): Promise<NotificationPreferences> {
    return await this.notificationPreferencesRepository.create(data);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    data: UpdateNotificationPreferencesData
  ): Promise<NotificationPreferences | null> {
    const result = await this.notificationPreferencesRepository.update(userId, data);
    
    // Audit log preference update
    if (result) {
      await AuditLogger.logNotificationOperation({
        eventType: AuditEventType.NOTIFICATION_PREFERENCES_UPDATED,
        userId,
        action: 'Updated notification preferences',
        metadata: {
          updatedFields: Object.keys(data),
          defaultChannels: data.defaultChannels
        }
      });
    }
    
    return result;
  }

  /**
   * Update category preferences
   */
  async updateCategoryPreferences(
    userId: string,
    category: NotificationCategory,
    enabled: boolean,
    channels?: NotificationChannel[],
    minPriority?: NotificationPriority
  ): Promise<boolean> {
    const updates: any = { enabled };
    if (channels) updates.channels = channels;
    if (minPriority) updates.minPriority = minPriority;

    return await this.notificationPreferencesRepository.updateCategoryPreferences(userId, category, updates);
  }

  /**
   * Toggle notifications globally for a user
   */
  async toggleNotifications(userId: string, enabled: boolean): Promise<boolean> {
    const result = await this.notificationPreferencesRepository.update(userId, { enabled });
    return result !== null;
  }

  /**
   * Enable/disable email digest
   */
  async updateEmailDigest(
    userId: string,
    enabled: boolean,
    frequency?: string,
    time?: string
  ): Promise<boolean> {
    const updates: any = { 'emailDigest.enabled': enabled };
    if (frequency) updates['emailDigest.frequency'] = frequency;
    if (time) updates['emailDigest.time'] = time;

    const result = await this.notificationPreferencesRepository.update(userId, updates);
    return result !== null;
  }

  /**
   * Update quiet hours
   */
  async updateQuietHours(
    userId: string,
    enabled: boolean,
    start?: string,
    end?: string,
    allowCritical?: boolean
  ): Promise<boolean> {
    const updates: any = { 'quietHours.enabled': enabled };
    if (start) updates['quietHours.start'] = start;
    if (end) updates['quietHours.end'] = end;
    if (allowCritical !== undefined) updates['quietHours.allowCritical'] = allowCritical;

    const result = await this.notificationPreferencesRepository.update(userId, updates);
    return result !== null;
  }

  // ==================== Helper Methods for Integration ====================

  /**
   * Create candidate-related notification
   */
  async notifyCandidateEvent(
    type: NotificationType,
    userId: string,
    candidateId: string,
    candidateName: string,
    additionalData?: Record<string, any>
  ): Promise<Notification | null> {
    const messages: Record<string, { title: string; message: string }> = {
      [NotificationType.CANDIDATE_APPLIED]: {
        title: 'New Candidate Application',
        message: `${candidateName} has applied for a position`
      },
      [NotificationType.CANDIDATE_STATUS_CHANGED]: {
        title: 'Candidate Status Updated',
        message: `Status changed for candidate ${candidateName}`
      },
      [NotificationType.CANDIDATE_DOCUMENT_UPLOADED]: {
        title: 'Document Uploaded',
        message: `New document uploaded for ${candidateName}`
      },
      [NotificationType.CANDIDATE_AI_ANALYSIS_COMPLETE]: {
        title: 'AI Analysis Complete',
        message: `Analysis completed for ${candidateName}`
      }
    };

    const content = messages[type] || {
      title: 'Candidate Update',
      message: `Update for candidate ${candidateName}`
    };

    return await this.createNotification({
      userId,
      type,
      title: content.title,
      message: content.message,
      data: {
        candidateId,
        candidateName,
        ...additionalData
      },
      action: {
        label: 'View Candidate',
        url: `/candidates/${candidateId}`
      },
      sourceId: candidateId,
      sourceType: 'candidate'
    });
  }

  /**
   * Create job-related notification
   */
  async notifyJobEvent(
    type: NotificationType,
    userId: string,
    jobId: string,
    jobName: string,
    additionalData?: Record<string, any>
  ): Promise<Notification | null> {
    const messages: Record<string, { title: string; message: string }> = {
      [NotificationType.JOB_POSTED]: {
        title: 'New Job Posted',
        message: `Job "${jobName}" has been posted`
      },
      [NotificationType.JOB_APPLICATION_RECEIVED]: {
        title: 'New Application',
        message: `New application received for "${jobName}"`
      },
      [NotificationType.JOB_UPDATED]: {
        title: 'Job Updated',
        message: `Job "${jobName}" has been updated`
      },
      [NotificationType.JOB_CLOSED]: {
        title: 'Job Closed',
        message: `Job "${jobName}" has been closed`
      }
    };

    const content = messages[type] || {
      title: 'Job Update',
      message: `Update for job ${jobName}`
    };

    return await this.createNotification({
      userId,
      type,
      title: content.title,
      message: content.message,
      data: {
        jobId,
        jobName,
        ...additionalData
      },
      action: {
        label: 'View Job',
        url: `/jobs/${jobId}`
      },
      sourceId: jobId,
      sourceType: 'job'
    });
  }

  /**
   * Create security alert notification
   */
  async notifySecurityEvent(
    type: NotificationType,
    userId: string,
    message: string,
    additionalData?: Record<string, any>
  ): Promise<Notification | null> {
    return await this.createNotification({
      userId,
      type,
      priority: NotificationPriority.CRITICAL,
      title: 'Security Alert',
      message,
      data: additionalData || {},
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL] // Force both channels for security
    });
  }
}
