/**
 * Webhook Repository
 * Data access layer for webhook configuration operations
 */

import { Collection } from 'mongodb';
import {
  WebhookConfig,
  CreateWebhookData,
  UpdateWebhookData,
  WebhookEvent,
  WebhookStatus,
  WebhookDeliveryAttempt
} from '../Models/WebhookConfig';

export class WebhookRepository {
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
   * Create a new webhook configuration
   */
  async create(data: CreateWebhookData): Promise<WebhookConfig> {
    const now = new Date();
    
    const webhook: WebhookConfig = {
      webhookId: this.generateUUID(),
      userId: data.userId,
      url: data.url,
      method: data.method || 'POST',
      headers: data.headers,
      secret: data.secret,
      events: data.events,
      status: WebhookStatus.ACTIVE,
      isActive: true,
      maxRetries: data.maxRetries || 3,
      retryBackoff: data.retryBackoff || 'exponential',
      timeoutMs: data.timeoutMs || 5000,
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      consecutiveFailures: 0,
      lastAttempts: [],
      description: data.description,
      createdAt: now,
      updatedAt: now,
      createdBy: data.createdBy
    };

    await this.collection.insertOne(webhook);
    return webhook;
  }

  /**
   * Get webhook by ID
   */
  async getById(webhookId: string): Promise<WebhookConfig | null> {
    return await this.collection.findOne({ webhookId }) as WebhookConfig | null;
  }

  /**
   * Get all webhooks for a user
   */
  async getByUserId(userId: string): Promise<WebhookConfig[]> {
    return await this.collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray() as unknown as WebhookConfig[];
  }

  /**
   * Get active webhooks for a user and event
   */
  async getActiveForEvent(userId: string, event: string): Promise<WebhookConfig[]> {
    return await this.collection
      .find({
        userId,
        isActive: true,
        status: WebhookStatus.ACTIVE,
        $or: [
          { events: WebhookEvent.ALL },
          { events: event }
        ]
      })
      .toArray() as unknown as WebhookConfig[];
  }

  /**
   * Update webhook configuration
   */
  async update(webhookId: string, data: UpdateWebhookData): Promise<WebhookConfig | null> {
    const updateData: any = {
      ...data,
      updatedAt: new Date()
    };

    const result = await this.collection.findOneAndUpdate(
      { webhookId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result as WebhookConfig | null;
  }

  /**
   * Record delivery attempt
   */
  async recordDeliveryAttempt(
    webhookId: string,
    attempt: WebhookDeliveryAttempt
  ): Promise<void> {
    const webhook = await this.getById(webhookId);
    if (!webhook) return;

    const updates: any = {
      $inc: {
        totalDeliveries: 1
      },
      $set: {
        lastDeliveryAt: attempt.attemptedAt,
        updatedAt: new Date()
      },
      $push: {
        lastAttempts: {
          $each: [attempt],
          $slice: -10 // Keep only last 10 attempts
        }
      }
    };

    if (attempt.success) {
      updates.$inc.successfulDeliveries = 1;
      updates.$set.lastSuccessAt = attempt.attemptedAt;
      updates.$set.consecutiveFailures = 0;
      
      // Re-enable webhook if it was auto-disabled
      if (webhook.status === WebhookStatus.FAILED) {
        updates.$set.status = WebhookStatus.ACTIVE;
      }
    } else {
      updates.$inc.failedDeliveries = 1;
      updates.$inc.consecutiveFailures = 1;
      updates.$set.lastFailureAt = attempt.attemptedAt;
      
      // Auto-disable after 5 consecutive failures
      if (webhook.consecutiveFailures + 1 >= 5) {
        updates.$set.status = WebhookStatus.FAILED;
        updates.$set.isActive = false;
      }
    }

    await this.collection.updateOne(
      { webhookId },
      updates
    );
  }

  /**
   * Delete webhook
   */
  async delete(webhookId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ webhookId });
    return result.deletedCount > 0;
  }

  /**
   * Toggle webhook active status
   */
  async toggleActive(webhookId: string, isActive: boolean): Promise<boolean> {
    const result = await this.collection.updateOne(
      { webhookId },
      { 
        $set: { 
          isActive,
          status: isActive ? WebhookStatus.ACTIVE : WebhookStatus.PAUSED,
          updatedAt: new Date()
        }
      }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Get webhook statistics for a user
   */
  async getStatistics(userId: string): Promise<{
    total: number;
    active: number;
    paused: number;
    failed: number;
    totalDeliveries: number;
    successRate: number;
  }> {
    const webhooks = await this.getByUserId(userId);
    
    const total = webhooks.length;
    const active = webhooks.filter(w => w.status === WebhookStatus.ACTIVE).length;
    const paused = webhooks.filter(w => w.status === WebhookStatus.PAUSED).length;
    const failed = webhooks.filter(w => w.status === WebhookStatus.FAILED).length;
    
    const totalDeliveries = webhooks.reduce((sum, w) => sum + w.totalDeliveries, 0);
    const successfulDeliveries = webhooks.reduce((sum, w) => sum + w.successfulDeliveries, 0);
    const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

    return {
      total,
      active,
      paused,
      failed,
      totalDeliveries,
      successRate: Math.round(successRate * 100) / 100
    };
  }
}
