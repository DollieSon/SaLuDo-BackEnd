/**
 * Notification Preferences Repository
 * Data access layer for user notification preference operations
 */

import { Collection } from 'mongodb';
import {
  NotificationPreferences,
  CreateNotificationPreferencesData,
  UpdateNotificationPreferencesData,
  DEFAULT_NOTIFICATION_PREFERENCES,
  CategoryPreferences,
  EventOverride,
  PreferenceEvaluationResult
} from '../Models/NotificationPreferences';
import {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NotificationChannel,
  NOTIFICATION_TYPE_TO_CATEGORY,
  NOTIFICATION_TYPE_TO_PRIORITY
} from '../Models/enums/NotificationTypes';

export class NotificationPreferencesRepository {
  private collection: Collection;

  constructor(collection: Collection) {
    this.collection = collection;
  }

  /**
   * Create notification preferences for a user
   */
  async create(data: CreateNotificationPreferencesData): Promise<NotificationPreferences> {
    const now = new Date();
    
    // Merge with defaults
    const preferences: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...data,
      userId: data.userId,
      createdAt: now,
      updatedAt: now,
      // Deep merge for nested objects
      defaultChannels: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.defaultChannels,
        ...data.defaultChannels
      },
      categories: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
        ...data.categories
      },
      emailDigest: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.emailDigest,
        ...data.emailDigest
      },
      quietHours: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.quietHours,
        ...data.quietHours
      }
    };

    await this.collection.insertOne(preferences);
    return preferences;
  }

  /**
   * Get preferences by user ID
   */
  async getByUserId(userId: string): Promise<NotificationPreferences | null> {
    return await this.collection.findOne({ userId }) as NotificationPreferences | null;
  }

  /**
   * Get preferences or create with defaults if not exists
   */
  async getOrCreate(userId: string): Promise<NotificationPreferences> {
    let preferences = await this.getByUserId(userId);
    
    if (!preferences) {
      preferences = await this.create({ userId });
    }
    
    return preferences;
  }

  /**
   * Update preferences
   */
  async update(userId: string, data: UpdateNotificationPreferencesData): Promise<NotificationPreferences | null> {
    const updateData: any = {
      ...data,
      updatedAt: new Date()
    };

    const result = await this.collection.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result as NotificationPreferences | null;
  }

  /**
   * Update category preferences
   */
  async updateCategoryPreferences(
    userId: string,
    category: NotificationCategory,
    preferences: Partial<CategoryPreferences>
  ): Promise<boolean> {
    const updateData: any = {
      updatedAt: new Date()
    };
    
    // Build nested update
    Object.keys(preferences).forEach(key => {
      updateData[`categories.${category}.${key}`] = (preferences as any)[key];
    });

    const result = await this.collection.updateOne(
      { userId },
      { $set: updateData }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Add or update event override
   */
  async setEventOverride(userId: string, override: EventOverride): Promise<boolean> {
    // Remove existing override for this event type if exists
    await this.collection.updateOne(
      { userId },
      { 
        $pull: { eventOverrides: { type: override.type } } as any
      }
    );

    // Add new override
    const result = await this.collection.updateOne(
      { userId },
      { 
        $push: { eventOverrides: override } as any,
        $set: { updatedAt: new Date() }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Remove event override
   */
  async removeEventOverride(userId: string, eventType: NotificationType): Promise<boolean> {
    const result = await this.collection.updateOne(
      { userId },
      { 
        $pull: { eventOverrides: { type: eventType } } as any,
        $set: { updatedAt: new Date() }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Delete preferences
   */
  async delete(userId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ userId });
    return result.deletedCount > 0;
  }

  /**
   * Evaluate if a notification should be sent based on user preferences
   */
  async evaluatePreferences(
    userId: string,
    notificationType: NotificationType,
    priority: NotificationPriority,
    timestamp: Date = new Date()
  ): Promise<PreferenceEvaluationResult> {
    const preferences = await this.getOrCreate(userId);
    
    // Global toggle check
    if (!preferences.enabled) {
      return {
        shouldNotify: false,
        channels: [],
        reason: 'Notifications globally disabled by user'
      };
    }

    // Get category for this notification type
    const category = NOTIFICATION_TYPE_TO_CATEGORY[notificationType];
    
    // Check for event-level override first
    const eventOverride = preferences.eventOverrides.find(
      override => override.type === notificationType
    );
    
    if (eventOverride) {
      if (!eventOverride.enabled) {
        return {
          shouldNotify: false,
          channels: [],
          reason: `Event type ${notificationType} disabled by user`
        };
      }
      
      // Check quiet hours (unless critical)
      const quietHoursResult = this.checkQuietHours(preferences, priority, timestamp);
      if (!quietHoursResult.allowed) {
        return {
          shouldNotify: false,
          channels: [],
          reason: 'Quiet hours active',
          isQuietHours: true
        };
      }
      
      return {
        shouldNotify: true,
        channels: eventOverride.channels
      };
    }
    
    // Check category preferences
    const categoryPrefs = preferences.categories[category];
    
    if (!categoryPrefs.enabled) {
      return {
        shouldNotify: false,
        channels: [],
        reason: `Category ${category} disabled by user`
      };
    }
    
    // Check minimum priority
    if (categoryPrefs.minPriority) {
      const priorityOrder = [
        NotificationPriority.LOW,
        NotificationPriority.MEDIUM,
        NotificationPriority.HIGH,
        NotificationPriority.CRITICAL
      ];
      
      const currentPriorityIndex = priorityOrder.indexOf(priority);
      const minPriorityIndex = priorityOrder.indexOf(categoryPrefs.minPriority);
      
      if (currentPriorityIndex < minPriorityIndex) {
        return {
          shouldNotify: false,
          channels: [],
          reason: `Priority ${priority} below minimum ${categoryPrefs.minPriority}`
        };
      }
    }
    
    // Check quiet hours
    const quietHoursResult = this.checkQuietHours(preferences, priority, timestamp);
    if (!quietHoursResult.allowed) {
      return {
        shouldNotify: false,
        channels: [],
        reason: 'Quiet hours active',
        isQuietHours: true
      };
    }
    
    // Check email digest mode
    if (preferences.emailDigest.enabled && preferences.emailDigest.frequency !== 'IMMEDIATE') {
      // Filter out email channel for digest mode
      const channels = categoryPrefs.channels.filter(
        ch => ch !== NotificationChannel.EMAIL
      );
      
      return {
        shouldNotify: true,
        channels,
        isDigestMode: true
      };
    }
    
    return {
      shouldNotify: true,
      channels: categoryPrefs.channels
    };
  }

  /**
   * Check if quiet hours are active
   */
  private checkQuietHours(
    preferences: NotificationPreferences,
    priority: NotificationPriority,
    timestamp: Date
  ): { allowed: boolean; reason?: string } {
    if (!preferences.quietHours.enabled) {
      return { allowed: true };
    }
    
    // Allow critical notifications during quiet hours if configured
    if (priority === NotificationPriority.CRITICAL && preferences.quietHours.allowCritical) {
      return { allowed: true };
    }
    
    // Check day of week
    const dayOfWeek = timestamp.getDay();
    if (preferences.quietHours.daysOfWeek && 
        preferences.quietHours.daysOfWeek.length > 0 &&
        !preferences.quietHours.daysOfWeek.includes(dayOfWeek)) {
      return { allowed: true }; // Not a quiet hours day
    }
    
    // Parse time (simplified - assumes same day start/end for now)
    const [startHour, startMinute] = preferences.quietHours.start.split(':').map(Number);
    const [endHour, endMinute] = preferences.quietHours.end.split(':').map(Number);
    
    const currentHour = timestamp.getHours();
    const currentMinute = timestamp.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;
    
    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    const isQuietTime = endTime < startTime
      ? (currentTime >= startTime || currentTime <= endTime)
      : (currentTime >= startTime && currentTime <= endTime);
    
    if (isQuietTime) {
      return { 
        allowed: false, 
        reason: `Quiet hours (${preferences.quietHours.start} - ${preferences.quietHours.end})` 
      };
    }
    
    return { allowed: true };
  }

  /**
   * Get all users who should receive a specific notification type
   */
  async getUsersForNotificationType(
    notificationType: NotificationType,
    priority: NotificationPriority
  ): Promise<string[]> {
    const category = NOTIFICATION_TYPE_TO_CATEGORY[notificationType];
    
    // Find users with this notification type enabled
    const preferences = await this.collection.find({
      enabled: true,
      $or: [
        // Event override enabled
        { 
          'eventOverrides': { 
            $elemMatch: { 
              type: notificationType, 
              enabled: true 
            } 
          } 
        },
        // Category enabled and no override disabling it
        {
          [`categories.${category}.enabled`]: true,
          'eventOverrides.type': { $ne: notificationType }
        }
      ]
    }).toArray() as unknown as NotificationPreferences[];
    
    return preferences.map(pref => pref.userId);
  }

  /**
   * Get users for digest notifications
   */
  async getUsersForDigest(frequency: string): Promise<NotificationPreferences[]> {
    return await this.collection.find({
      enabled: true,
      'emailDigest.enabled': true,
      'emailDigest.frequency': frequency
    }).toArray() as unknown as NotificationPreferences[];
  }

  /**
   * Get all users with notifications enabled
   */
  async getAllEnabledUsers(): Promise<NotificationPreferences[]> {
    return await this.collection.find({
      enabled: true
    }).toArray() as unknown as NotificationPreferences[];
  }
}
