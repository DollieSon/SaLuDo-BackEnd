/**
 * Digest Scheduler
 * Schedules and manages cron jobs for sending digest emails
 */

import * as cron from 'node-cron';
import { DigestService } from './services/DigestService';
import { NotificationRepository } from './repositories/NotificationRepository';
import { NotificationPreferencesRepository } from './repositories/NotificationPreferencesRepository';
import { Db } from 'mongodb';

export class DigestScheduler {
  private hourlyJob: cron.ScheduledTask | null = null;
  private dailyJob: cron.ScheduledTask | null = null;
  private weeklyJob: cron.ScheduledTask | null = null;
  private digestService: DigestService;

  constructor(db: Db) {
    // Initialize digest service with repository instances
    const notificationRepository = new NotificationRepository(db.collection('notifications'));
    const preferencesRepository = new NotificationPreferencesRepository(db.collection('notificationPreferences'));
    this.digestService = new DigestService(notificationRepository, preferencesRepository);
  }

  /**
   * Start all digest cron jobs
   */
  start(): void {
    console.log('='.repeat(60));
    console.log('Digest Scheduler Starting...');
    console.log('='.repeat(60));

    this.startHourlyDigest();
    this.startDailyDigest();
    this.startWeeklyDigest();

    console.log('Digest Scheduler: All jobs scheduled');
    console.log('='.repeat(60));
  }

  /**
   * Start hourly digest job
   * Runs at the top of every hour
   */
  private startHourlyDigest(): void {
    // Run at minute 0 of every hour (e.g., 1:00, 2:00, 3:00)
    this.hourlyJob = cron.schedule('0 * * * *', async () => {
      console.log(`\n[${new Date().toISOString()}] Running hourly digest job...`);
      try {
        const count = await this.digestService.processHourlyDigests();
        console.log(`Hourly digest job completed: ${count} digests sent\n`);
      } catch (error) {
        console.error('Hourly digest job failed:', error);
      }
    });

    console.log('✓ Hourly digest scheduled (runs at :00 every hour)');
  }

  /**
   * Start daily digest job
   * Runs at 9:00 AM every day (configurable via env)
   */
  private startDailyDigest(): void {
    // Get time from env or default to 9:00 AM
    const digestTime = process.env.DAILY_DIGEST_TIME || '09:00';
    const [hour, minute] = digestTime.split(':');

    // Run at specified time every day
    this.dailyJob = cron.schedule(`${minute} ${hour} * * *`, async () => {
      console.log(`\n[${new Date().toISOString()}] Running daily digest job...`);
      try {
        const count = await this.digestService.processDailyDigests();
        console.log(`Daily digest job completed: ${count} digests sent\n`);
      } catch (error) {
        console.error('Daily digest job failed:', error);
      }
    });

    console.log(`✓ Daily digest scheduled (runs at ${digestTime} every day)`);
  }

  /**
   * Start weekly digest job
   * Runs every Monday at 9:00 AM (configurable via env)
   */
  private startWeeklyDigest(): void {
    // Get time from env or default to 9:00 AM
    const digestTime = process.env.WEEKLY_DIGEST_TIME || '09:00';
    const [hour, minute] = digestTime.split(':');

    // Run at specified time every Monday (day 1)
    this.weeklyJob = cron.schedule(`${minute} ${hour} * * 1`, async () => {
      console.log(`\n[${new Date().toISOString()}] Running weekly digest job...`);
      try {
        const count = await this.digestService.processWeeklyDigests();
        console.log(`Weekly digest job completed: ${count} digests sent\n`);
      } catch (error) {
        console.error('Weekly digest job failed:', error);
      }
    });

    console.log(`✓ Weekly digest scheduled (runs at ${digestTime} every Monday)`);
  }

  /**
   * Stop all digest jobs
   */
  stop(): void {
    console.log('Stopping digest scheduler...');

    if (this.hourlyJob) {
      this.hourlyJob.stop();
      console.log('✓ Hourly digest job stopped');
    }

    if (this.dailyJob) {
      this.dailyJob.stop();
      console.log('✓ Daily digest job stopped');
    }

    if (this.weeklyJob) {
      this.weeklyJob.stop();
      console.log('✓ Weekly digest job stopped');
    }

    console.log('Digest scheduler stopped');
  }

  /**
   * Get status of all jobs
   */
  getStatus(): {
    hourly: boolean;
    daily: boolean;
    weekly: boolean;
  } {
    return {
      hourly: this.hourlyJob !== null,
      daily: this.dailyJob !== null,
      weekly: this.weeklyJob !== null
    };
  }

  /**
   * Manually trigger hourly digest (for testing)
   */
  async triggerHourlyDigest(): Promise<number> {
    console.log('Manually triggering hourly digest...');
    return await this.digestService.processHourlyDigests();
  }

  /**
   * Manually trigger daily digest (for testing)
   */
  async triggerDailyDigest(): Promise<number> {
    console.log('Manually triggering daily digest...');
    return await this.digestService.processDailyDigests();
  }

  /**
   * Manually trigger weekly digest (for testing)
   */
  async triggerWeeklyDigest(): Promise<number> {
    console.log('Manually triggering weekly digest...');
    return await this.digestService.processWeeklyDigests();
  }
}

// Note: DigestScheduler instance is created in index.ts with proper db injection
