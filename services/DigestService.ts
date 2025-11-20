/**
 * Digest Service
 * Handles aggregation and sending of notification digests
 */

import { NotificationRepository } from '../repositories/NotificationRepository';
import { NotificationPreferencesRepository } from '../repositories/NotificationPreferencesRepository';
import { emailQueueService } from './EmailQueueService';
import { templateService } from './TemplateService';
import { emailService, EmailOptions } from './EmailService';
import { Notification } from '../Models/Notification';
import { NotificationPreferences } from '../Models/NotificationPreferences';
import { DigestFrequency, NotificationCategory, NotificationPriority } from '../Models/enums/NotificationTypes';

export interface DigestData {
  userId: string;
  userEmail: string;
  userName: string;
  frequency: DigestFrequency;
  notifications: Notification[];
  period: {
    start: Date;
    end: Date;
  };
  stats: {
    total: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
  };
}

export class DigestService {
  private notificationRepository: NotificationRepository;
  private notificationPreferencesRepository: NotificationPreferencesRepository;

  constructor(
    notificationRepository: NotificationRepository,
    notificationPreferencesRepository: NotificationPreferencesRepository
  ) {
    this.notificationRepository = notificationRepository;
    this.notificationPreferencesRepository = notificationPreferencesRepository;
  }
  /**
   * Process hourly digests for all eligible users
   */
  async processHourlyDigests(): Promise<number> {
    console.log(`[DigestService] Processing hourly digests...`);
    return await this.processDigests(DigestFrequency.HOURLY, 1);
  }

  /**
   * Process daily digests for all eligible users
   */
  async processDailyDigests(): Promise<number> {
    console.log(`[DigestService] Processing daily digests...`);
    return await this.processDigests(DigestFrequency.DAILY, 24);
  }

  /**
   * Process weekly digests for all eligible users
   */
  async processWeeklyDigests(): Promise<number> {
    console.log(`[DigestService] Processing weekly digests...`);
    return await this.processDigests(DigestFrequency.WEEKLY, 168); // 7 days * 24 hours
  }

  /**
   * Process digests for a specific frequency
   */
  private async processDigests(frequency: DigestFrequency, hoursBack: number): Promise<number> {
    try {
      // Get all users with this digest frequency enabled
      const users = await this.getUsersWithDigestFrequency(frequency);
      console.log(`  Found ${users.length} users with ${frequency} digest enabled`);

      let digestsSent = 0;

      for (const user of users) {
        try {
          const sent = await this.sendDigestForUser(user.userId, frequency, hoursBack);
          if (sent) digestsSent++;
        } catch (error) {
          console.error(`  Failed to send digest for user ${user.userId}:`, error);
        }
      }

      console.log(`  Sent ${digestsSent} ${frequency} digests`);
      return digestsSent;
    } catch (error) {
      console.error(`[DigestService] Failed to process ${frequency} digests:`, error);
      return 0;
    }
  }

  /**
   * Send digest for a specific user
   */
  async sendDigestForUser(
    userId: string,
    frequency: DigestFrequency,
    hoursBack: number
  ): Promise<boolean> {
    try {
      // Calculate time range
      const end = new Date();
      const start = new Date(end.getTime() - hoursBack * 60 * 60 * 1000);

      // Get undigested notifications
      const notifications = await this.notificationRepository.getUndigestedNotifications(
        userId,
        start,
        end
      );

      // Skip if no notifications
      if (notifications.length === 0) {
        console.log(`  No undigested notifications for user ${userId}`);
        return false;
      }

      // Get user preferences
      const preferences = await this.notificationPreferencesRepository.getByUserId(userId);
      if (!preferences) {
        console.log(`  No preferences found for user ${userId}`);
        return false;
      }

      // Filter notifications based on preferences
      const filteredNotifications = this.filterNotificationsByPreferences(
        notifications,
        preferences
      );

      if (filteredNotifications.length === 0) {
        console.log(`  All notifications filtered out for user ${userId}`);
        // Still mark as digested to avoid reprocessing
        await this.notificationRepository.markAsDigested(
          notifications.map((n: Notification) => n.notificationId)
        );
        return false;
      }

      // Get user info (would typically come from user repository)
      const userEmail = filteredNotifications[0].userEmail || '';
      if (!userEmail) {
        console.log(`  No email found for user ${userId}`);
        return false;
      }

      // Calculate stats
      const stats = this.calculateDigestStats(filteredNotifications);

      // Prepare digest data
      const digestData: DigestData = {
        userId,
        userEmail,
        userName: preferences.userId, // Would be actual name from user service
        frequency,
        notifications: filteredNotifications,
        period: { start, end },
        stats
      };

      // Send digest email
      await this.sendDigestEmail(digestData);

      // Mark notifications as digested
      await this.notificationRepository.markAsDigested(
        filteredNotifications.map(n => n.notificationId)
      );

      console.log(`  Sent ${frequency} digest to ${userEmail} (${filteredNotifications.length} notifications)`);
      return true;
    } catch (error) {
      console.error(`Failed to send digest for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Send digest email
   */
  private async sendDigestEmail(digestData: DigestData): Promise<void> {
    const templateName = this.getDigestTemplateName(digestData.frequency);

    // Group notifications by category
    const groupedByCategory = this.groupNotificationsByCategory(digestData.notifications);

    // Render email template
    const html = await templateService.renderTemplate(templateName, {
      ...digestData,
      groupedByCategory,
      appUrl: process.env.APP_URL || 'https://saludo.com',
      appName: process.env.APP_NAME || 'SaLuDo'
    });

    const text = this.generatePlainTextDigest(digestData, groupedByCategory);

    const emailOptions: EmailOptions = {
      to: digestData.userEmail,
      subject: this.getDigestSubject(digestData.frequency, digestData.stats.total),
      html,
      text
    };

    await emailService.sendEmail(emailOptions);
  }

  /**
   * Get digest template name based on frequency
   */
  private getDigestTemplateName(frequency: DigestFrequency): string {
    switch (frequency) {
      case DigestFrequency.HOURLY:
        return 'hourly-digest';
      case DigestFrequency.DAILY:
        return 'daily-digest';
      case DigestFrequency.WEEKLY:
        return 'weekly-digest';
      default:
        return 'daily-digest';
    }
  }

  /**
   * Get digest email subject
   */
  private getDigestSubject(frequency: DigestFrequency, count: number): string {
    const timeframe = frequency.toLowerCase();
    return `Your ${timeframe} SaLuDo digest (${count} notification${count !== 1 ? 's' : ''})`;
  }

  /**
   * Generate plain text version of digest
   */
  private generatePlainTextDigest(
    digestData: DigestData,
    groupedByCategory: Record<string, Notification[]>
  ): string {
    let text = `Your ${digestData.frequency} SaLuDo Digest\n\n`;
    text += `${digestData.stats.total} notifications from ${digestData.period.start.toLocaleDateString()} to ${digestData.period.end.toLocaleDateString()}\n\n`;

    Object.entries(groupedByCategory).forEach(([category, notifications]) => {
      text += `\n${category} (${notifications.length}):\n`;
      notifications.forEach(n => {
        text += `  • ${n.title}\n`;
        text += `    ${n.message}\n`;
      });
    });

    text += `\n\nView all notifications: ${process.env.APP_URL}/notifications\n`;
    return text;
  }

  /**
   * Filter notifications based on user preferences
   */
  private filterNotificationsByPreferences(
    notifications: Notification[],
    preferences: NotificationPreferences
  ): Notification[] {
    const { emailDigest } = preferences;

    return notifications.filter(notification => {
      // Check if category should be included
      if (emailDigest.includeCategories && emailDigest.includeCategories.length > 0) {
        if (!emailDigest.includeCategories.includes(notification.category)) {
          return false;
        }
      }

      // Check minimum priority
      if (emailDigest.minPriority) {
        const priorityOrder = {
          [NotificationPriority.LOW]: 1,
          [NotificationPriority.MEDIUM]: 2,
          [NotificationPriority.HIGH]: 3,
          [NotificationPriority.CRITICAL]: 4
        };

        const notificationPriorityLevel = priorityOrder[notification.priority] || 0;
        const minPriorityLevel = priorityOrder[emailDigest.minPriority] || 0;

        if (notificationPriorityLevel < minPriorityLevel) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Calculate digest statistics
   */
  private calculateDigestStats(notifications: Notification[]): DigestData['stats'] {
    const byCategory: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    notifications.forEach(n => {
      byCategory[n.category] = (byCategory[n.category] || 0) + 1;
      byPriority[n.priority] = (byPriority[n.priority] || 0) + 1;
    });

    return {
      total: notifications.length,
      byCategory,
      byPriority
    };
  }

  /**
   * Group notifications by category
   */
  private groupNotificationsByCategory(
    notifications: Notification[]
  ): Record<string, Notification[]> {
    const grouped: Record<string, Notification[]> = {};

    notifications.forEach(notification => {
      const category = notification.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(notification);
    });

    // Sort each category by priority and date
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => {
        // Priority comparison (higher priority first)
        const priorityOrder = {
          [NotificationPriority.CRITICAL]: 4,
          [NotificationPriority.HIGH]: 3,
          [NotificationPriority.MEDIUM]: 2,
          [NotificationPriority.LOW]: 1
        };
        
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // Date comparison (newer first)
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    });

    return grouped;
  }

  /**
   * Get users with specific digest frequency enabled
   */
  private async getUsersWithDigestFrequency(frequency: DigestFrequency): Promise<NotificationPreferences[]> {
    // This would use a repository method to query users
    // For now, we'll get all preferences and filter
    // This would ideally use a repository method to query users with specific frequency
    const allPreferences: NotificationPreferences[] = [];
    
    return allPreferences.filter((pref: NotificationPreferences) => 
      pref.emailDigest.enabled && pref.emailDigest.frequency === frequency
    );
  }
}

// Note: DigestService instance is created in DigestScheduler with proper repository injection

