/**
 * Webhook Service
 * Handles outgoing webhook delivery for notifications
 */

import crypto from 'crypto';
import { WebhookRepository } from '../repositories/WebhookRepository';
import { 
  WebhookConfig, 
  WebhookPayload, 
  WebhookDeliveryAttempt,
  WebhookEvent 
} from '../Models/WebhookConfig';
import { Notification } from '../Models/Notification';
import { AuditLogger } from '../utils/AuditLogger';
import { AuditEventType, AuditSeverity } from '../types/AuditEventTypes';

export class WebhookService {
  private webhookRepository: WebhookRepository;

  constructor(webhookRepository: WebhookRepository) {
    this.webhookRepository = webhookRepository;
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Calculate retry delay based on attempt number and strategy
   */
  private calculateRetryDelay(attempt: number, strategy: 'linear' | 'exponential'): number {
    if (strategy === 'exponential') {
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      return Math.min(Math.pow(2, attempt) * 1000, 30000);
    } else {
      // Linear backoff: 2s, 4s, 6s, 8s, 10s
      return Math.min((attempt + 1) * 2000, 30000);
    }
  }

  /**
   * Send webhook with retry logic
   */
  private async sendWebhookRequest(
    webhook: WebhookConfig,
    payload: WebhookPayload,
    attempt: number = 0
  ): Promise<WebhookDeliveryAttempt> {
    const startTime = Date.now();
    const attemptData: WebhookDeliveryAttempt = {
      attemptedAt: new Date(),
      success: false
    };

    try {
      // Generate signature if secret is configured
      const payloadString = JSON.stringify(payload);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'SaLuDo-Webhook/1.0',
        'X-Webhook-ID': webhook.webhookId,
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp.toISOString(),
        ...webhook.headers
      };

      if (webhook.secret) {
        headers['X-Webhook-Signature'] = this.generateSignature(payloadString, webhook.secret);
      }

      // Make HTTP request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), webhook.timeoutMs);

      const response = await fetch(webhook.url, {
        method: webhook.method,
        headers,
        body: payloadString,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      attemptData.statusCode = response.status;
      attemptData.responseTime = Date.now() - startTime;
      attemptData.success = response.ok; // 2xx status codes

      if (!response.ok) {
        attemptData.error = `HTTP ${response.status}: ${response.statusText}`;

        // Log webhook failure
        await AuditLogger.log({
          eventType: AuditEventType.WEBHOOK_FAILED,
          userId: webhook.userId,
          resource: 'webhook',
          resourceId: webhook.webhookId,
          action: 'trigger',
          severity: AuditSeverity.MEDIUM,
          metadata: {
            url: webhook.url,
            event: payload.event,
            statusCode: response.status,
            error: attemptData.error,
            attempt: attempt + 1,
            maxRetries: webhook.maxRetries
          }
        });
        
        // Retry on 5xx errors or 429 (rate limit)
        if ((response.status >= 500 || response.status === 429) && attempt < webhook.maxRetries) {
          const delay = this.calculateRetryDelay(attempt, webhook.retryBackoff);
          console.log(`Webhook ${webhook.webhookId} failed, retrying in ${delay}ms (attempt ${attempt + 1}/${webhook.maxRetries})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return await this.sendWebhookRequest(webhook, payload, attempt + 1);
        }
      } else {
        // Log successful webhook trigger
        await AuditLogger.log({
          eventType: AuditEventType.WEBHOOK_TRIGGERED,
          userId: webhook.userId,
          resource: 'webhook',
          resourceId: webhook.webhookId,
          action: 'trigger',
          severity: AuditSeverity.LOW,
          metadata: {
            url: webhook.url,
            event: payload.event,
            statusCode: response.status,
            responseTime: attemptData.responseTime
          }
        });
      }

    } catch (error) {
      attemptData.responseTime = Date.now() - startTime;
      attemptData.success = false;
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          attemptData.error = `Timeout after ${webhook.timeoutMs}ms`;
        } else {
          attemptData.error = error.message;
        }
      } else {
        attemptData.error = 'Unknown error';
      }

      // Log webhook failure
      await AuditLogger.log({
        eventType: AuditEventType.WEBHOOK_FAILED,
        userId: webhook.userId,
        resource: 'webhook',
        resourceId: webhook.webhookId,
        action: 'trigger',
        severity: AuditSeverity.MEDIUM,
        metadata: {
          url: webhook.url,
          event: payload.event,
          error: attemptData.error,
          attempt: attempt + 1,
          maxRetries: webhook.maxRetries
        }
      });

      // Retry on network errors
      if (attempt < webhook.maxRetries) {
        const delay = this.calculateRetryDelay(attempt, webhook.retryBackoff);
        console.log(`Webhook ${webhook.webhookId} network error, retrying in ${delay}ms (attempt ${attempt + 1}/${webhook.maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return await this.sendWebhookRequest(webhook, payload, attempt + 1);
      }
    }

    // Record delivery attempt
    await this.webhookRepository.recordDeliveryAttempt(webhook.webhookId, attemptData);

    return attemptData;
  }

  /**
   * Deliver notification to all configured webhooks
   */
  async deliverNotification(notification: Notification): Promise<void> {
    try {
      // Map notification type to webhook event
      const event = notification.type as string;
      
      // Find active webhooks for this user and event
      const webhooks = await this.webhookRepository.getActiveForEvent(
        notification.userId,
        event
      );

      if (webhooks.length === 0) {
        console.log(`No active webhooks found for user ${notification.userId} and event ${event}`);
        return;
      }

      // Prepare webhook payload
      const payload: WebhookPayload = {
        webhookId: '', // Will be set per webhook
        event,
        timestamp: new Date(),
        notification: {
          notificationId: notification.notificationId,
          type: notification.type,
          category: notification.category,
          priority: notification.priority,
          title: notification.title,
          message: notification.message,
          data: notification.data
        }
      };

      // Send to all webhooks (don't await - fire and forget with internal retry)
      const deliveryPromises = webhooks.map(webhook => {
        const webhookPayload = { ...payload, webhookId: webhook.webhookId };
        return this.sendWebhookRequest(webhook, webhookPayload)
          .catch(error => {
            console.error(`Failed to deliver webhook ${webhook.webhookId}:`, error);
          });
      });

      // Wait for all deliveries to complete
      await Promise.allSettled(deliveryPromises);

      console.log(`Delivered notification ${notification.notificationId} to ${webhooks.length} webhook(s)`);

    } catch (error) {
      console.error('Error delivering notification via webhooks:', error);
      throw error;
    }
  }

  /**
   * Test webhook configuration by sending a test payload
   */
  async testWebhook(webhookId: string): Promise<WebhookDeliveryAttempt> {
    const webhook = await this.webhookRepository.getById(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload: WebhookPayload = {
      webhookId: webhook.webhookId,
      event: 'test',
      timestamp: new Date(),
      notification: {
        notificationId: 'test-notification',
        type: 'TEST',
        category: 'SYSTEM_UPDATES',
        priority: 'LOW',
        title: 'Webhook Test',
        message: 'This is a test notification to verify your webhook configuration.',
        data: {
          test: true,
          webhookId: webhook.webhookId
        }
      }
    };

    return await this.sendWebhookRequest(webhook, testPayload);
  }
}
