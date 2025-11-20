/**
 * Notification Repository
 * Data access layer for notification operations
 */

import { Collection, ObjectId } from 'mongodb';
import {
  Notification,
  CreateNotificationData,
  UpdateNotificationData,
  NotificationFilter,
  NotificationSummary,
  BulkNotificationResult
} from '../Models/Notification';
import {
  NotificationCategory,
  NotificationPriority,
  NotificationChannel,
  DeliveryStatus,
  NOTIFICATION_TYPE_TO_CATEGORY,
  NOTIFICATION_TYPE_TO_PRIORITY
} from '../Models/enums/NotificationTypes';

export class NotificationRepository {
  private collection: Collection;

  constructor(collection: Collection) {
    this.collection = collection;
  }

  /**
   * Generate a UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Create a new notification
   */
  async create(data: CreateNotificationData): Promise<Notification> {
    const now = new Date();
    
    // Derive category and priority if not provided
    const category = data.category || NOTIFICATION_TYPE_TO_CATEGORY[data.type];
    const priority = data.priority || NOTIFICATION_TYPE_TO_PRIORITY[data.type];
    
    const notification: Notification = {
      notificationId: this.generateUUID(),
      userId: data.userId,
      userEmail: data.userEmail,
      type: data.type,
      category,
      priority,
      title: data.title,
      message: data.message,
      data: data.data || {},
      channels: data.channels || [NotificationChannel.IN_APP],
      deliveryStatus: this.initializeDeliveryStatus(data.channels || [NotificationChannel.IN_APP]),
      isRead: false,
      isArchived: false,
      action: data.action,
      createdAt: now,
      updatedAt: now,
      expiresAt: data.expiresAt,
      groupKey: data.groupKey,
      sourceId: data.sourceId,
      sourceType: data.sourceType,
      triggeredBy: data.triggeredBy
    };

    await this.collection.insertOne(notification);
    return notification;
  }

  /**
   * Initialize delivery status for selected channels
   */
  private initializeDeliveryStatus(channels: NotificationChannel[]) {
    const status: any = {};
    
    channels.forEach(channel => {
      const channelKey = channel.toLowerCase();
      status[channelKey] = {
        status: DeliveryStatus.PENDING,
        retryCount: 0
      };
    });
    
    return status;
  }

  /**
   * Get notification by ID
   */
  async getById(notificationId: string): Promise<Notification | null> {
    return await this.collection.findOne({ notificationId }) as Notification | null;
  }

  /**
   * Get notifications with filtering
   */
  async find(filter: NotificationFilter): Promise<{ notifications: Notification[]; total: number }> {
    const query: any = {};
    
    // Build query
    if (filter.userId) query.userId = filter.userId;
    if (filter.type) {
      query.type = Array.isArray(filter.type) ? { $in: filter.type } : filter.type;
    }
    if (filter.category) {
      query.category = Array.isArray(filter.category) ? { $in: filter.category } : filter.category;
    }
    if (filter.priority) {
      query.priority = Array.isArray(filter.priority) ? { $in: filter.priority } : filter.priority;
    }
    if (filter.isRead !== undefined) query.isRead = filter.isRead;
    if (filter.isArchived !== undefined) query.isArchived = filter.isArchived;
    if (filter.groupKey) query.groupKey = filter.groupKey;
    if (filter.sourceId) query.sourceId = filter.sourceId;
    if (filter.sourceType) query.sourceType = filter.sourceType;
    
    // Date filters
    if (filter.createdAfter || filter.createdBefore) {
      query.createdAt = {};
      if (filter.createdAfter) query.createdAt.$gte = filter.createdAfter;
      if (filter.createdBefore) query.createdAt.$lte = filter.createdBefore;
    }
    
    if (filter.expiresAfter || filter.expiresBefore) {
      query.expiresAt = {};
      if (filter.expiresAfter) query.expiresAt.$gte = filter.expiresAfter;
      if (filter.expiresBefore) query.expiresAt.$lte = filter.expiresBefore;
    }
    
    // Pagination
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;
    
    // Sorting
    const sortField = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;
    const sort: any = { [sortField]: sortOrder };
    
    const [notifications, total] = await Promise.all([
      this.collection
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray() as unknown as Promise<Notification[]>,
      this.collection.countDocuments(query)
    ]);
    
    return { notifications, total };
  }

  /**
   * Update a notification
   */
  async update(notificationId: string, data: UpdateNotificationData): Promise<Notification | null> {
    const updateData: any = { ...data, updatedAt: new Date() };
    
    const result = await this.collection.findOneAndUpdate(
      { notificationId },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    return result as Notification | null;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    const result = await this.collection.updateOne(
      { notificationId },
      { 
        $set: { 
          isRead: true, 
          readAt: new Date(),
          updatedAt: new Date()
        } 
      }
    );
    
    return result.modifiedCount > 0;
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(notificationIds: string[]): Promise<number> {
    const result = await this.collection.updateMany(
      { notificationId: { $in: notificationIds } },
      { 
        $set: { 
          isRead: true, 
          readAt: new Date(),
          updatedAt: new Date()
        } 
      }
    );
    
    return result.modifiedCount;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsReadForUser(userId: string): Promise<number> {
    const result = await this.collection.updateMany(
      { userId, isRead: false },
      { 
        $set: { 
          isRead: true, 
          readAt: new Date(),
          updatedAt: new Date()
        } 
      }
    );
    
    return result.modifiedCount;
  }

  /**
   * Archive a notification
   */
  async archive(notificationId: string): Promise<boolean> {
    const result = await this.collection.updateOne(
      { notificationId },
      { 
        $set: { 
          isArchived: true, 
          archivedAt: new Date(),
          updatedAt: new Date()
        } 
      }
    );
    
    return result.modifiedCount > 0;
  }

  /**
   * Delete a notification
   */
  async delete(notificationId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ notificationId });
    return result.deletedCount > 0;
  }

  /**
   * Delete multiple notifications
   */
  async deleteMultiple(notificationIds: string[]): Promise<number> {
    const result = await this.collection.deleteMany({
      notificationId: { $in: notificationIds }
    });
    return result.deletedCount;
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllForUser(userId: string): Promise<number> {
    const result = await this.collection.deleteMany({ userId });
    return result.deletedCount;
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await this.collection.countDocuments({
      userId,
      isRead: false,
      isArchived: false
    });
  }

  /**
   * Get notification summary for a user
   */
  async getSummary(userId: string): Promise<NotificationSummary> {
    const [unreadCount, totalCount, notifications] = await Promise.all([
      this.getUnreadCount(userId),
      this.collection.countDocuments({ userId, isArchived: false }),
      this.collection
        .find({ userId, isArchived: false })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray() as unknown as Promise<Notification[]>
    ]);
    
    // Get counts by category
    const categoryCounts = await this.collection.aggregate([
      { $match: { userId, isArchived: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]).toArray();
    
    const countByCategory = Object.values(NotificationCategory).reduce((acc, cat) => {
      acc[cat] = 0;
      return acc;
    }, {} as Record<NotificationCategory, number>);
    
    categoryCounts.forEach((item: any) => {
      countByCategory[item._id as NotificationCategory] = item.count;
    });
    
    // Get counts by priority
    const priorityCounts = await this.collection.aggregate([
      { $match: { userId, isArchived: false } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]).toArray();
    
    const countByPriority = Object.values(NotificationPriority).reduce((acc, pri) => {
      acc[pri] = 0;
      return acc;
    }, {} as Record<NotificationPriority, number>);
    
    priorityCounts.forEach((item: any) => {
      countByPriority[item._id as NotificationPriority] = item.count;
    });
    
    // Get oldest unread
    const oldestUnreadArr = await this.collection
      .find({ userId, isRead: false, isArchived: false })
      .sort({ createdAt: 1 })
      .limit(1)
      .toArray() as unknown as Notification[];
    
    return {
      userId,
      unreadCount,
      totalCount,
      countByCategory,
      countByPriority,
      latestNotification: notifications[0],
      oldestUnread: oldestUnreadArr[0]
    };
  }

  /**
   * Delete expired notifications
   */
  async deleteExpired(): Promise<number> {
    const now = new Date();
    const result = await this.collection.deleteMany({
      expiresAt: { $lte: now }
    });
    return result.deletedCount;
  }

  /**
   * Update delivery status for a channel
   */
  async updateDeliveryStatus(
    notificationId: string,
    channel: NotificationChannel,
    status: DeliveryStatus,
    error?: string
  ): Promise<boolean> {
    const channelKey = channel.toLowerCase();
    const updateData: any = {
      updatedAt: new Date()
    };
    
    updateData[`deliveryStatus.${channelKey}.status`] = status;
    
    if (status === DeliveryStatus.SENT) {
      updateData[`deliveryStatus.${channelKey}.sentAt`] = new Date();
    } else if (status === DeliveryStatus.DELIVERED) {
      updateData[`deliveryStatus.${channelKey}.deliveredAt`] = new Date();
    } else if (status === DeliveryStatus.FAILED) {
      if (error) {
        updateData[`deliveryStatus.${channelKey}.error`] = error;
      }
      updateData[`deliveryStatus.${channelKey}.lastRetryAt`] = new Date();
      // Increment retry count
      await this.collection.updateOne(
        { notificationId },
        { $inc: { [`deliveryStatus.${channelKey}.retryCount`]: 1 } }
      );
    }
    
    const result = await this.collection.updateOne(
      { notificationId },
      { $set: updateData }
    );
    
    return result.modifiedCount > 0;
  }

  /**
   * Get notifications pending delivery for a channel
   */
  async getPendingForChannel(channel: NotificationChannel, limit: number = 100): Promise<Notification[]> {
    const channelKey = channel.toLowerCase();
    
    return await this.collection
      .find({
        channels: channel,
        [`deliveryStatus.${channelKey}.status`]: DeliveryStatus.PENDING
      })
      .sort({ priority: -1, createdAt: 1 })
      .limit(limit)
      .toArray() as unknown as Notification[];
  }

  /**
   * Get failed notifications for retry
   */
  async getFailedForRetry(channel: NotificationChannel, maxRetries: number = 3): Promise<Notification[]> {
    const channelKey = channel.toLowerCase();
    
    return await this.collection
      .find({
        channels: channel,
        [`deliveryStatus.${channelKey}.status`]: DeliveryStatus.FAILED,
        [`deliveryStatus.${channelKey}.retryCount`]: { $lt: maxRetries }
      })
      .sort({ priority: -1, createdAt: 1 })
      .limit(100)
      .toArray() as unknown as Notification[];
  }
}
