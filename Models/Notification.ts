/**
 * Notification Model
 * Represents a notification sent to a user through various channels
 */

import {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NotificationChannel,
  DeliveryStatus
} from './enums/NotificationTypes';

/**
 * Channel-specific delivery tracking
 */
export interface ChannelDeliveryStatus {
  status: DeliveryStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  error?: string;
  retryCount?: number;
  lastRetryAt?: Date;
}

/**
 * Delivery status tracking for all channels
 */
export interface NotificationDeliveryStatus {
  inApp?: ChannelDeliveryStatus;
  email?: ChannelDeliveryStatus;
  push?: ChannelDeliveryStatus;
  sms?: ChannelDeliveryStatus;
  webhook?: ChannelDeliveryStatus;
}

/**
 * Optional action associated with notification
 */
export interface NotificationAction {
  label: string;           // e.g., "View Candidate", "Review Application"
  url: string;            // e.g., "/candidates/123"
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  payload?: Record<string, any>;
}

/**
 * Main Notification interface
 */
export interface Notification {
  notificationId: string;
  
  // Recipient
  userId: string;          // User ID who receives the notification
  userEmail?: string;      // Optional email for reference
  
  // Classification
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  
  // Content
  title: string;           // Short notification title
  message: string;         // Detailed message body
  data: Record<string, any>; // Flexible contextual data (candidateId, jobId, etc.)
  
  // Delivery
  channels: NotificationChannel[];
  deliveryStatus: NotificationDeliveryStatus;
  
  // User Interaction
  isRead: boolean;
  readAt?: Date;
  isArchived: boolean;
  archivedAt?: Date;
  
  // Actions
  action?: NotificationAction;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;        // Auto-cleanup date
  
  // Grouping (for batch notifications)
  groupKey?: string;       // Group related notifications
  groupCount?: number;     // Count of grouped items
  
  // Source tracking
  sourceId?: string;       // ID of the entity that triggered this notification
  sourceType?: string;     // Type of source (candidate, job, user, etc.)
  triggeredBy?: string;    // User ID who triggered the action
}

/**
 * Data for creating a new notification
 */
export interface CreateNotificationData {
  userId: string;
  userEmail?: string;
  type: NotificationType;
  category?: NotificationCategory; // Optional - will be derived from type if not provided
  priority?: NotificationPriority; // Optional - will be derived from type if not provided
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: NotificationChannel[]; // Optional - defaults to user preferences
  action?: NotificationAction;
  expiresAt?: Date;
  groupKey?: string;
  sourceId?: string;
  sourceType?: string;
  triggeredBy?: string;
}

/**
 * Data for updating a notification
 */
export interface UpdateNotificationData {
  isRead?: boolean;
  readAt?: Date;
  isArchived?: boolean;
  archivedAt?: Date;
  deliveryStatus?: Partial<NotificationDeliveryStatus>;
}

/**
 * Notification filter criteria for queries
 */
export interface NotificationFilter {
  userId?: string;
  type?: NotificationType | NotificationType[];
  category?: NotificationCategory | NotificationCategory[];
  priority?: NotificationPriority | NotificationPriority[];
  isRead?: boolean;
  isArchived?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  expiresAfter?: Date;
  expiresBefore?: Date;
  groupKey?: string;
  sourceId?: string;
  sourceType?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'priority' | 'readAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Notification summary for dashboard/overview
 */
export interface NotificationSummary {
  userId: string;
  unreadCount: number;
  totalCount: number;
  countByCategory: Record<NotificationCategory, number>;
  countByPriority: Record<NotificationPriority, number>;
  latestNotification?: Notification;
  oldestUnread?: Notification;
}

/**
 * Bulk notification operation result
 */
export interface BulkNotificationResult {
  success: boolean;
  processedCount: number;
  successCount: number;
  failureCount: number;
  errors?: Array<{
    notificationId: string;
    error: string;
  }>;
}

/**
 * Notification template for common notification patterns
 */
export interface NotificationTemplate {
  templateId: string;
  name: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  titleTemplate: string;      // Handlebars template for title
  messageTemplate: string;    // Handlebars template for message
  defaultChannels: NotificationChannel[];
  defaultAction?: Partial<NotificationAction>;
  variables: string[];        // Required template variables
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-app notification display data (for frontend)
 */
export interface NotificationDisplayData {
  notificationId: string;
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  isRead: boolean;
  createdAt: Date;
  action?: NotificationAction;
  icon?: string;          // Icon name/class for UI
  color?: string;         // Color code for UI
  groupCount?: number;
}
