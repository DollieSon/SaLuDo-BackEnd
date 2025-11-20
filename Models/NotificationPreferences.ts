/**
 * Notification Preferences Model
 * Manages user-specific notification settings and delivery preferences
 */

import {
  NotificationChannel,
  NotificationCategory,
  NotificationType,
  NotificationPriority,
  DigestFrequency
} from './enums/NotificationTypes';

/**
 * Channel preferences
 */
export interface ChannelPreferences {
  inApp: boolean;
  email: boolean;
  push: boolean;
  sms: boolean;
}

/**
 * Category-specific notification preferences
 */
export interface CategoryPreferences {
  enabled: boolean;
  channels: NotificationChannel[];
  minPriority?: NotificationPriority; // Only notify for this priority and above
}

/**
 * Event-level override preferences
 */
export interface EventOverride {
  type: NotificationType;
  enabled: boolean;
  channels: NotificationChannel[];
  priority?: NotificationPriority;
}

/**
 * Email digest configuration
 */
export interface EmailDigestPreferences {
  enabled: boolean;
  frequency: DigestFrequency;
  time?: string;          // HH:MM format (e.g., "09:00")
  dayOfWeek?: number;     // 0-6 (Sunday-Saturday) for weekly digests
  timezone?: string;      // IANA timezone (e.g., "America/New_York")
  includeCategories?: NotificationCategory[]; // Which categories to include
  minPriority?: NotificationPriority; // Minimum priority for digest
}

/**
 * Quiet hours configuration
 */
export interface QuietHoursPreferences {
  enabled: boolean;
  start: string;          // HH:MM format (e.g., "22:00")
  end: string;            // HH:MM format (e.g., "08:00")
  timezone: string;       // IANA timezone
  allowCritical: boolean; // Allow CRITICAL priority notifications during quiet hours
  daysOfWeek?: number[];  // Days when quiet hours apply (0-6), empty = all days
}

/**
 * Main Notification Preferences interface
 */
export interface NotificationPreferences {
  userId: string;
  
  // Global toggle
  enabled: boolean;
  
  // Default channel preferences
  defaultChannels: ChannelPreferences;
  
  // Category-based preferences
  categories: {
    [NotificationCategory.HR_ACTIVITIES]: CategoryPreferences;
    [NotificationCategory.SECURITY_ALERTS]: CategoryPreferences;
    [NotificationCategory.SYSTEM_UPDATES]: CategoryPreferences;
    [NotificationCategory.COMMENTS]: CategoryPreferences;
    [NotificationCategory.INTERVIEWS]: CategoryPreferences;
    [NotificationCategory.ADMIN]: CategoryPreferences;
  };
  
  // Event-level overrides
  eventOverrides: EventOverride[];
  
  // Email digest settings
  emailDigest: EmailDigestPreferences;
  
  // Quiet hours
  quietHours: QuietHoursPreferences;
  
  // Advanced settings
  batchNotifications: boolean;      // Group similar notifications
  soundEnabled: boolean;            // Play sound for in-app notifications
  desktopNotifications: boolean;    // Browser desktop notifications
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastModifiedBy?: string;          // User ID who last modified preferences
}

/**
 * Default preferences for new users
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, 'userId' | 'createdAt' | 'updatedAt'> = {
  enabled: true,
  
  defaultChannels: {
    inApp: true,
    email: true,
    push: false,
    sms: false
  },
  
  categories: {
    [NotificationCategory.HR_ACTIVITIES]: {
      enabled: true,
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      minPriority: NotificationPriority.LOW
    },
    [NotificationCategory.SECURITY_ALERTS]: {
      enabled: true,
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      minPriority: NotificationPriority.MEDIUM
    },
    [NotificationCategory.SYSTEM_UPDATES]: {
      enabled: true,
      channels: [NotificationChannel.IN_APP],
      minPriority: NotificationPriority.MEDIUM
    },
    [NotificationCategory.COMMENTS]: {
      enabled: true,
      channels: [NotificationChannel.IN_APP],
      minPriority: NotificationPriority.LOW
    },
    [NotificationCategory.INTERVIEWS]: {
      enabled: true,
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      minPriority: NotificationPriority.MEDIUM
    },
    [NotificationCategory.ADMIN]: {
      enabled: true,
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      minPriority: NotificationPriority.MEDIUM
    }
  },
  
  eventOverrides: [],
  
  emailDigest: {
    enabled: false,
    frequency: DigestFrequency.DAILY,
    time: '09:00',
    timezone: 'UTC',
    includeCategories: [
      NotificationCategory.HR_ACTIVITIES,
      NotificationCategory.INTERVIEWS
    ],
    minPriority: NotificationPriority.LOW
  },
  
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
    timezone: 'UTC',
    allowCritical: true,
    daysOfWeek: []
  },
  
  batchNotifications: true,
  soundEnabled: true,
  desktopNotifications: true
};

/**
 * Data for creating notification preferences
 */
export interface CreateNotificationPreferencesData {
  userId: string;
  enabled?: boolean;
  defaultChannels?: Partial<ChannelPreferences>;
  categories?: Partial<NotificationPreferences['categories']>;
  eventOverrides?: EventOverride[];
  emailDigest?: Partial<EmailDigestPreferences>;
  quietHours?: Partial<QuietHoursPreferences>;
  batchNotifications?: boolean;
  soundEnabled?: boolean;
  desktopNotifications?: boolean;
}

/**
 * Data for updating notification preferences
 */
export interface UpdateNotificationPreferencesData {
  enabled?: boolean;
  defaultChannels?: Partial<ChannelPreferences>;
  categories?: Partial<NotificationPreferences['categories']>;
  eventOverrides?: EventOverride[];
  emailDigest?: Partial<EmailDigestPreferences>;
  quietHours?: Partial<QuietHoursPreferences>;
  batchNotifications?: boolean;
  soundEnabled?: boolean;
  desktopNotifications?: boolean;
  lastModifiedBy?: string;
}

/**
 * Preference evaluation result
 */
export interface PreferenceEvaluationResult {
  shouldNotify: boolean;
  channels: NotificationChannel[];
  reason?: string;              // Why notification was blocked (if applicable)
  isQuietHours?: boolean;
  isDigestMode?: boolean;
}

/**
 * Digest schedule calculation result
 */
export interface DigestSchedule {
  nextDigestAt: Date;
  frequency: DigestFrequency;
  timezone: string;
  includeCategories: NotificationCategory[];
}
