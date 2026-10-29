// =======================
// WEBHOOK ROUTES
// =======================
// Purpose: Webhook configuration endpoints - manage outgoing webhook subscriptions
// Related: WebhookService, WebhookRepository, NotificationService
// =======================

import { Router, Request, Response } from 'express';
import { WebhookRepository } from '../repositories/WebhookRepository';
import { WebhookService } from '../services/WebhookService';
import { connectDB } from '../mongo_db';
import { asyncHandler, errorHandler } from './middleware/errorHandler';
import { AuthMiddleware, AuthenticatedRequest } from './middleware/auth';
import { CreateWebhookData, UpdateWebhookData, WebhookEvent } from '../Models/WebhookConfig';
import { OK, CREATED, BAD_REQUEST, UNAUTHORIZED, NOT_FOUND, FORBIDDEN } from '../constants/HttpStatusCodes';
import { AuditLogger } from '../utils/AuditLogger';
import { AuditEventType } from '../types/AuditEventTypes';
import { UserRole } from '../Models/User';
import {
  ALLOWED_WEBHOOK_METHODS,
  validateWebhookHeaders,
  validateWebhookUrl,
} from '../utils/safeOutboundRequest';

const router = Router();
let webhookRepository: WebhookRepository;
let webhookService: WebhookService;

// Initialize services
const initializeService = async () => {
  const db = await connectDB();
  webhookRepository = new WebhookRepository(db.collection('webhooks'));
  webhookService = new WebhookService(webhookRepository);
  await AuthMiddleware.initialize();
};

initializeService().catch(console.error);

// Webhooks can send candidate data off-platform, so only admins may manage them
router.use(AuthMiddleware.authenticate, AuthMiddleware.requireRole(UserRole.ADMIN));

// Shared validation for webhook URL, method and custom headers
const validateWebhookTarget = async (body: any, requireUrl: boolean): Promise<string | null> => {
  if (body.url !== undefined || requireUrl) {
    const urlError = await validateWebhookUrl(body.url);
    if (urlError) return urlError;
  }
  if (body.method !== undefined && !(ALLOWED_WEBHOOK_METHODS as readonly string[]).includes(body.method)) {
    return `Method must be one of: ${ALLOWED_WEBHOOK_METHODS.join(', ')}`;
  }
  return validateWebhookHeaders(body.headers);
};

// ====================
// WEBHOOK ENDPOINTS
// ====================

/**
 * GET /api/webhooks
 * Get all webhooks for authenticated user
 */
router.get(
  '/',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    const webhooks = await webhookRepository.getByUserId(userId);
    res.json({ webhooks, count: webhooks.length });
  })
);

/**
 * GET /api/webhooks/statistics
 * Get webhook statistics for authenticated user
 */
router.get(
  '/statistics',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    const statistics = await webhookRepository.getStatistics(userId);
    res.json({ statistics });
  })
);

/**
 * GET /api/webhooks/:webhookId
 * Get specific webhook by ID
 */
router.get(
  '/:webhookId',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { webhookId } = req.params;

    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    const webhook = await webhookRepository.getById(webhookId);
    if (!webhook) {
      return res.status(NOT_FOUND).json({ error: 'Webhook not found' });
    }

    // Verify ownership
    if (webhook.userId !== userId) {
      return res.status(FORBIDDEN).json({ error: 'Access denied' });
    }

    res.json({ webhook });
  })
);

/**
 * POST /api/webhooks
 * Create new webhook
 */
router.post(
  '/',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    const { url, method, headers, secret, events, description, maxRetries, retryBackoff, timeoutMs } = req.body;

    // Validation
    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      return res.status(BAD_REQUEST).json({ 
        error: 'Missing required fields: url, events (non-empty array)' 
      });
    }

    // Validate URL (https, public address only), method and headers
    const targetError = await validateWebhookTarget(req.body, true);
    if (targetError) {
      return res.status(BAD_REQUEST).json({ error: targetError });
    }

    // Validate events
    const validEvents = Object.values(WebhookEvent);
    const invalidEvents = events.filter((e: string) => !validEvents.includes(e as WebhookEvent));
    if (invalidEvents.length > 0) {
      return res.status(BAD_REQUEST).json({ 
        error: `Invalid events: ${invalidEvents.join(', ')}`,
        validEvents 
      });
    }

    const webhookData: CreateWebhookData = {
      userId,
      url,
      method: method || 'POST',
      headers,
      secret,
      events,
      description,
      maxRetries,
      retryBackoff,
      timeoutMs,
      createdBy: userId
    };

    const webhook = await webhookRepository.create(webhookData);

    // Log webhook configuration
    await AuditLogger.log({
      eventType: AuditEventType.WEBHOOK_CONFIGURED,
      userId,
      userEmail: req.user?.email,
      resource: 'webhook',
      resourceId: webhook.webhookId,
      action: 'created',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        url: webhook.url,
        events: webhook.events,
        method: webhook.method
      }
    });

    res.status(CREATED).json({ 
      webhook, 
      message: 'Webhook created successfully' 
    });
  })
);

/**
 * PUT /api/webhooks/:webhookId
 * Update webhook configuration
 */
router.put(
  '/:webhookId',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { webhookId } = req.params;

    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    const webhook = await webhookRepository.getById(webhookId);
    if (!webhook) {
      return res.status(NOT_FOUND).json({ error: 'Webhook not found' });
    }

    // Verify ownership
    if (webhook.userId !== userId) {
      return res.status(FORBIDDEN).json({ error: 'Access denied' });
    }

    const { url, method, headers, secret, events, status, isActive, description, maxRetries, retryBackoff, timeoutMs } = req.body;

    // Validate URL (https, public address only), method and headers if provided
    const targetError = await validateWebhookTarget(req.body, false);
    if (targetError) {
      return res.status(BAD_REQUEST).json({ error: targetError });
    }

    // Validate events if provided
    if (events) {
      if (!Array.isArray(events) || events.length === 0) {
        return res.status(BAD_REQUEST).json({ error: 'Events must be a non-empty array' });
      }
      
      const validEvents = Object.values(WebhookEvent);
      const invalidEvents = events.filter((e: string) => !validEvents.includes(e as WebhookEvent));
      if (invalidEvents.length > 0) {
        return res.status(BAD_REQUEST).json({ 
          error: `Invalid events: ${invalidEvents.join(', ')}`,
          validEvents 
        });
      }
    }

    const updateData: UpdateWebhookData = {
      url,
      method,
      headers,
      secret,
      events,
      status,
      isActive,
      description,
      maxRetries,
      retryBackoff,
      timeoutMs
    };

    const updatedWebhook = await webhookRepository.update(webhookId, updateData);

    if (updatedWebhook) {
      // Log webhook configuration update
      await AuditLogger.log({
        eventType: AuditEventType.WEBHOOK_CONFIGURED,
        userId,
        userEmail: req.user?.email,
        resource: 'webhook',
        resourceId: webhookId,
        action: 'updated',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          url: updatedWebhook.url,
          events: updatedWebhook.events,
          isActive: updatedWebhook.isActive
        }
      });
    }

    res.json({ 
      webhook: updatedWebhook, 
      message: 'Webhook updated successfully' 
    });
  })
);

/**
 * POST /api/webhooks/:webhookId/toggle
 * Toggle webhook active status
 */
router.post(
  '/:webhookId/toggle',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { webhookId } = req.params;
    const { isActive } = req.body;

    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    if (typeof isActive !== 'boolean') {
      return res.status(BAD_REQUEST).json({ error: 'isActive must be a boolean' });
    }

    const webhook = await webhookRepository.getById(webhookId);
    if (!webhook) {
      return res.status(NOT_FOUND).json({ error: 'Webhook not found' });
    }

    // Verify ownership
    if (webhook.userId !== userId) {
      return res.status(FORBIDDEN).json({ error: 'Access denied' });
    }

    const success = await webhookRepository.toggleActive(webhookId, isActive);
    res.json({ 
      success, 
      message: isActive ? 'Webhook enabled' : 'Webhook paused' 
    });
  })
);

/**
 * POST /api/webhooks/:webhookId/test
 * Test webhook configuration
 */
router.post(
  '/:webhookId/test',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { webhookId } = req.params;

    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    const webhook = await webhookRepository.getById(webhookId);
    if (!webhook) {
      return res.status(NOT_FOUND).json({ error: 'Webhook not found' });
    }

    // Verify ownership
    if (webhook.userId !== userId) {
      return res.status(FORBIDDEN).json({ error: 'Access denied' });
    }

    const result = await webhookService.testWebhook(webhookId);
    res.json({ 
      result,
      message: result.success ? 'Webhook test successful' : 'Webhook test failed'
    });
  })
);

/**
 * DELETE /api/webhooks/:webhookId
 * Delete webhook
 */
router.delete(
  '/:webhookId',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { webhookId } = req.params;

    if (!userId) {
      return res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    const webhook = await webhookRepository.getById(webhookId);
    if (!webhook) {
      return res.status(NOT_FOUND).json({ error: 'Webhook not found' });
    }

    // Verify ownership
    if (webhook.userId !== userId) {
      return res.status(FORBIDDEN).json({ error: 'Access denied' });
    }

    const success = await webhookRepository.delete(webhookId);
    res.json({ success, message: 'Webhook deleted successfully' });
  })
);

/**
 * GET /api/webhooks/events/available
 * Get list of available webhook events
 */
router.get(
  '/events/available',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const events = Object.values(WebhookEvent).map(event => ({
      value: event,
      label: event.split('_').map(word => 
        word.charAt(0) + word.slice(1).toLowerCase()
      ).join(' ')
    }));

    res.json({ events });
  })
);

// Error handling middleware
router.use(errorHandler);

export default router;
