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

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(BAD_REQUEST).json({ error: 'Invalid URL format' });
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

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        return res.status(BAD_REQUEST).json({ error: 'Invalid URL format' });
      }
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
