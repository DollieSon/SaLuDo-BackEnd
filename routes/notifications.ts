// =======================
// NOTIFICATION ROUTES
// =======================
// Purpose: Notification management endpoints - create, read, update, delete notifications and preferences
// Related: NotificationService, NotificationPreferencesRepository, WebSocketService
// =======================

import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/NotificationService';
import { NotificationRepository } from '../repositories/NotificationRepository';
import { NotificationPreferencesRepository } from '../repositories/NotificationPreferencesRepository';
import { WebhookRepository } from '../repositories/WebhookRepository';
import { connectDB } from '../mongo_db';
import { asyncHandler, errorHandler } from './middleware/errorHandler';
import { AuthMiddleware, AuthenticatedRequest } from './middleware/auth';
import { NotificationType, NotificationCategory, NotificationChannel, NotificationPriority } from '../Models/enums/NotificationTypes';
import { CreateNotificationData, NotificationFilter } from '../Models/Notification';
import { AuditLogger } from '../utils/AuditLogger';
import { AuditEventType } from '../types/AuditEventTypes';

import { OK, CREATED, BAD_REQUEST, UNAUTHORIZED, NOT_FOUND } from "../constants/HttpStatusCodes";
const router = Router();
let notificationService: NotificationService;

// Initialize services
const initializeService = async () => {
  const db = await connectDB();
  const notificationRepository = new NotificationRepository(db.collection('notifications'));
  const preferencesRepository = new NotificationPreferencesRepository(db.collection('notificationPreferences'));
  const webhookRepository = new WebhookRepository(db.collection('webhooks'));
  notificationService = new NotificationService(notificationRepository, preferencesRepository, webhookRepository);
  await AuthMiddleware.initialize();
};

initializeService().catch(console.error);

// ====================
// NOTIFICATION ENDPOINTS
// ====================

/**
 * GET /api/notifications
 * Get notifications for authenticated user with filtering
 */
router.get(
  '/',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    const filter: NotificationFilter = {
      userId,
      isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
      priority: req.query.priority as NotificationPriority | undefined,
      category: req.query.category as NotificationCategory | undefined,
      type: req.query.type as NotificationType | undefined,
      limit: parseInt(req.query.limit as string) || 50,
      page: Math.floor((parseInt(req.query.skip as string) || 0) / (parseInt(req.query.limit as string) || 50)) + 1
    };

    const result = await notificationService.getNotifications(filter);
    res.json({ notifications: result.notifications, count: result.total, hasMore: result.hasMore });
  })
);

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
router.get(
  '/unread-count',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    const count = await notificationService.getUnreadCount(userId);
    res.json({ unreadCount: count });
  })
);

/**
 * GET /api/notifications/summary
 * Get notification summary by category
 */
router.get(
  '/summary',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    const summary = await notificationService.getSummary(userId);
    res.json({ summary });
  })
);

/**
 * GET /api/notifications/:notificationId
 * Get single notification by ID
 */
router.get(
  '/:notificationId',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { notificationId } = req.params;

    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    const notification = await notificationService.getNotification(notificationId);
    if (!notification || notification.userId !== userId) {
      return res.status(NOT_FOUND).json({ error: 'Notification not found' });
    }

    res.json({ notification });
  })
);

/**
 * POST /api/notifications
 * Create new notification (admin/system only)
 */
router.post(
  '/',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const notificationData: CreateNotificationData = req.body;

    if (!notificationData.userId || !notificationData.type) {
      return res.status(BAD_REQUEST).json({ error: 'Missing required fields: userId, type' });
    }

    const notification = await notificationService.createNotification(notificationData);
    res.status(CREATED).json({ notification });
  })
);

/**
 * PUT /api/notifications/:notificationId/read
 * Mark notification as read
 */
router.put(
  '/:notificationId/read',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { notificationId } = req.params;

    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    // Verify notification belongs to user
    const notification = await notificationService.getNotification(notificationId);
    if (!notification || notification.userId !== userId) {
      return res.status(NOT_FOUND).json({ error: 'Notification not found' });
    }

    await notificationService.markAsRead(notificationId);
    res.json({ success: true, message: 'Notification marked as read' });
  })
);

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put(
  '/read-all',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    await notificationService.markAllAsRead(userId);
    res.json({ success: true, message: 'All notifications marked as read' });
  })
);

/**
 * DELETE /api/notifications/:notificationId
 * Delete notification
 */
router.delete(
  '/:notificationId',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { notificationId } = req.params;

    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    // Verify notification belongs to user
    const notification = await notificationService.getNotification(notificationId);
    if (!notification || notification.userId !== userId) {
      return res.status(NOT_FOUND).json({ error: 'Notification not found' });
    }

    await notificationService.deleteNotification(notificationId);
    res.json({ success: true, message: 'Notification deleted' });
  })
);

/**
 * DELETE /api/notifications
 * Delete multiple notifications
 */
router.delete(
  '/',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { notificationIds } = req.body;

    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    if (!Array.isArray(notificationIds)) {
      return res.status(BAD_REQUEST).json({ error: 'notificationIds must be an array' });
    }

    // Verify all notifications belong to user
    const filter: NotificationFilter = { userId };
    const userNotifications = await notificationService.getNotifications(filter);
    const userNotificationIds = new Set(userNotifications.notifications.map(n => n.notificationId));
    const validIds = notificationIds.filter(id => userNotificationIds.has(id));

    const count = await notificationService.deleteMultipleNotifications(validIds);
    res.json({ success: true, message: `${count} notifications deleted` });
  })
);

// ====================
// NOTIFICATION PREFERENCES ENDPOINTS
// ====================

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences
 */
router.get(
  '/preferences/settings',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    const preferences = await notificationService.getPreferences(userId);
    res.json({ preferences });
  })
);

/**
 * PUT /api/notifications/preferences
 * Update notification preferences
 */
router.put(
  '/preferences/settings',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    const oldPreferences = await notificationService.getPreferences(userId);
    const preferences = await notificationService.updatePreferences(userId, req.body);
    
    // Log permission changes
    const preferencesChanged = JSON.stringify(oldPreferences) !== JSON.stringify(preferences);
    if (preferencesChanged && preferences) {
      await AuditLogger.log({
        eventType: AuditEventType.PERMISSION_GRANTED,
        userId,
        userEmail: req.user?.email,
        resource: 'notification_preferences',
        resourceId: userId,
        action: 'updated_preferences',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          updatedFields: Object.keys(req.body),
          enabled: preferences.enabled,
          defaultChannels: preferences.defaultChannels
        }
      });
    }
    
    res.json({ preferences, message: 'Preferences updated successfully' });
  })
);

/**
 * PUT /api/notifications/preferences/category
 * Update category-specific preferences
 */
router.put(
  '/preferences/category',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { category, channels } = req.body;

    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    if (!category || !channels) {
      return res.status(BAD_REQUEST).json({ error: 'Missing required fields: category, channels' });
    }

    const oldPreferences = await notificationService.getPreferences(userId);
    const preferences = await notificationService.updateCategoryPreferences(userId, category, channels);
    
    // Log permission changes for category
    const oldCategoryChannels = oldPreferences?.categories?.[category as NotificationCategory]?.channels || [];
    const newCategoryChannels = channels as NotificationChannel[];
    const channelsGranted = newCategoryChannels.filter(ch => !oldCategoryChannels.includes(ch));
    const channelsRevoked = oldCategoryChannels.filter(ch => !newCategoryChannels.includes(ch));
    
    if (channelsGranted.length > 0) {
      await AuditLogger.log({
        eventType: AuditEventType.PERMISSION_GRANTED,
        userId,
        userEmail: req.user?.email,
        resource: 'notification_preferences',
        resourceId: userId,
        action: 'granted_channels',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          category,
          channelsGranted,
          totalChannels: newCategoryChannels.length
        }
      });
    }
    
    if (channelsRevoked.length > 0) {
      await AuditLogger.log({
        eventType: AuditEventType.PERMISSION_REVOKED,
        userId,
        userEmail: req.user?.email,
        resource: 'notification_preferences',
        resourceId: userId,
        action: 'revoked_channels',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          category,
          channelsRevoked,
          remainingChannels: newCategoryChannels.length
        }
      });
    }
    
    res.json({ preferences, message: `${category} preferences updated` });
  })
);

/**
 * POST /api/notifications/preferences/reset
 * Reset preferences to defaults
 */
router.post(
  '/preferences/reset',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    // Reset by deleting and recreating with defaults
    const preferences = await notificationService.updatePreferences(userId, {
      enabled: true,
      defaultChannels: {
        inApp: true,
        email: true,
        push: false,
        sms: false
      }
    });
    res.json({ preferences, message: 'Preferences reset to defaults' });
  })
);

// Error handling middleware
router.use(errorHandler);

export default router;
