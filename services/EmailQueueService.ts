/**
 * Email Queue Service
 * Handles async email delivery using BullMQ with Redis
 * Falls back to direct email sending if Redis is unavailable
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { emailService, EmailOptions } from './EmailService';
import { templateService } from './TemplateService';
import { Notification } from '../Models/Notification';

export interface EmailJobData {
  notification: Notification;
  recipientEmail: string;
  recipientName?: string;
  templateData?: Record<string, any>;
}

export class EmailQueueService {
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private redisConnection: Redis | null = null;
  private isRedisAvailable: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Redis connection and BullMQ queue
   */
  private async initialize(): Promise<void> {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');
    const redisPassword = process.env.REDIS_PASSWORD;

    try {
      // Create Redis connection
      this.redisConnection = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            console.warn('EmailQueueService: Redis connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 100, 3000);
        }
      });

      // Test connection
      await this.redisConnection.ping();
      this.isRedisAvailable = true;
      console.log(`EmailQueueService: Connected to Redis at ${redisHost}:${redisPort}`);

      // Create BullMQ queue
      this.queue = new Queue('email-notifications', {
        connection: this.redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: {
            age: 86400, // Keep completed jobs for 24 hours
            count: 1000
          },
          removeOnFail: {
            age: 604800 // Keep failed jobs for 7 days
          }
        }
      });

      console.log('EmailQueueService: Queue initialized');
    } catch (error) {
      console.warn('EmailQueueService: Redis not available, falling back to direct email sending');
      console.warn('  To enable queue:', `Set REDIS_HOST=${redisHost} REDIS_PORT=${redisPort}`);
      this.isRedisAvailable = false;
      this.redisConnection = null;
      this.queue = null;
    }
  }

  /**
   * Queue an email for sending
   */
  async queueEmail(data: EmailJobData): Promise<{ jobId?: string; sent?: boolean }> {
    // If Redis is not available, send email directly
    if (!this.isRedisAvailable || !this.queue) {
      console.log('EmailQueueService: Sending email directly (Redis unavailable)');
      const success = await this.sendEmailDirect(data);
      return { sent: success };
    }

    try {
      const job = await this.queue.add('send-notification-email', data, {
        priority: this.getPriority(data.notification.priority)
      });

      console.log(`EmailQueueService: Email queued (Job ID: ${job.id})`);
      return { jobId: job.id };
    } catch (error) {
      console.error('EmailQueueService: Failed to queue email:', error);
      // Fallback to direct sending
      const success = await this.sendEmailDirect(data);
      return { sent: success };
    }
  }

  /**
   * Queue multiple emails
   */
  async queueBulkEmails(emails: EmailJobData[]): Promise<Array<{ jobId?: string; sent?: boolean }>> {
    const results: Array<{ jobId?: string; sent?: boolean }> = [];

    for (const email of emails) {
      const result = await this.queueEmail(email);
      results.push(result);
    }

    return results;
  }

  /**
   * Send email directly (fallback when Redis unavailable)
   */
  private async sendEmailDirect(data: EmailJobData): Promise<boolean> {
    try {
      const html = await templateService.renderEmail(data.notification, {
        recipientName: data.recipientName,
        ...data.templateData
      });

      const text = templateService.renderPlainText(data.notification, {
        recipientName: data.recipientName,
        ...data.templateData
      });

      const emailOptions: EmailOptions = {
        to: data.recipientEmail,
        subject: data.notification.title,
        html,
        text
      };

      const result = await emailService.sendEmail(emailOptions);
      return result.success;
    } catch (error) {
      console.error('EmailQueueService: Failed to send email directly:', error);
      return false;
    }
  }

  /**
   * Process email job (used by worker)
   */
  static async processEmailJob(job: Job<EmailJobData>): Promise<void> {
    const { notification, recipientEmail, recipientName, templateData } = job.data;

    console.log(`Processing email job ${job.id} for ${recipientEmail}`);

    // Render email template
    const html = await templateService.renderEmail(notification, {
      recipientName,
      ...templateData
    });

    const text = templateService.renderPlainText(notification, {
      recipientName,
      ...templateData
    });

    // Send email
    const emailOptions: EmailOptions = {
      to: recipientEmail,
      subject: notification.title,
      html,
      text
    };

    const result = await emailService.sendEmail(emailOptions);

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }

    console.log(`Email job ${job.id} completed successfully`);
  }

  /**
   * Get job priority from notification priority
   */
  private getPriority(notificationPriority: string): number {
    const priorityMap: Record<string, number> = {
      CRITICAL: 1,
      HIGH: 2,
      MEDIUM: 3,
      LOW: 4
    };
    return priorityMap[notificationPriority] || 3;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  } | null> {
    if (!this.queue) {
      return null;
    }

    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount()
      ]);

      return { waiting, active, completed, failed };
    } catch (error) {
      console.error('EmailQueueService: Failed to get queue stats:', error);
      return null;
    }
  }

  /**
   * Check if Redis is available
   */
  isQueueAvailable(): boolean {
    return this.isRedisAvailable;
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
    if (this.redisConnection) {
      this.redisConnection.disconnect();
    }
    console.log('EmailQueueService: Connections closed');
  }
}

// Export singleton instance
export const emailQueueService = new EmailQueueService();
