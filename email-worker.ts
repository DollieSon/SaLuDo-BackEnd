/**
 * Email Worker
 * Background worker to process email notification queue using BullMQ
 * Run this as a separate process: ts-node email-worker.ts
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { EmailQueueService, EmailJobData } from './services/EmailQueueService';

// Load environment variables
dotenv.config();

// Redis connection configuration
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379');
const redisPassword = process.env.REDIS_PASSWORD;

console.log('='.repeat(60));
console.log('Email Worker Starting...');
console.log(`Redis: ${redisHost}:${redisPort}`);
console.log('='.repeat(60));

let redisConnection: Redis | null = null;
let worker: Worker | null = null;

/**
 * Initialize worker
 */
async function initializeWorker(): Promise<void> {
  try {
    // Create Redis connection
    redisConnection = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      maxRetriesPerRequest: null, // Important for BullMQ workers
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 100, 3000);
        console.log(`Retrying Redis connection in ${delay}ms (attempt ${times})`);
        return delay;
      }
    });

    // Add error handler to prevent crashes
    redisConnection.on('error', (error) => {
      console.error('Email Worker: Redis error (handled):', error.message);
    });

    // Test connection
    await redisConnection.ping();
    console.log('✓ Connected to Redis');

    // Create worker
    worker = new Worker(
      'email-notifications',
      async (job: Job<EmailJobData>) => {
        console.log(`\n[${new Date().toISOString()}] Processing job ${job.id}...`);
        console.log(`  Recipient: ${job.data.recipientEmail}`);
        console.log(`  Subject: ${job.data.notification.title}`);

        try {
          await EmailQueueService.processEmailJob(job);
          console.log(`✓ Job ${job.id} completed successfully`);
        } catch (error) {
          console.error(`✗ Job ${job.id} failed:`, error);
          throw error; // Re-throw to trigger BullMQ retry
        }
      },
      {
        connection: redisConnection,
        concurrency: 5, // Process up to 5 emails simultaneously
        limiter: {
          max: 10, // Maximum 10 jobs
          duration: 1000 // per second (rate limiting)
        }
      }
    );

    console.log('✓ Email worker initialized');
    console.log('  Concurrency: 5 jobs');
    console.log('  Rate limit: 10 jobs/second');
    console.log('\nWaiting for jobs...\n');

    // Worker event handlers
    worker.on('completed', (job: Job) => {
      console.log(`[${new Date().toISOString()}] ✓ Completed job ${job.id}`);
    });

    worker.on('failed', (job: Job | undefined, error: Error) => {
      if (job) {
        console.error(`[${new Date().toISOString()}] ✗ Failed job ${job.id}:`, error.message);
        console.error(`  Attempts: ${job.attemptsMade}/${job.opts.attempts}`);
      }
    });

    worker.on('error', (error: Error) => {
      console.error('Worker error:', error);
    });

    worker.on('stalled', (jobId: string) => {
      console.warn(`Job ${jobId} stalled`);
    });

    // Graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    console.error('Failed to initialize worker:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown(): Promise<void> {
  console.log('\n\nShutting down worker...');

  if (worker) {
    console.log('  Closing worker...');
    await worker.close();
    console.log('  ✓ Worker closed');
  }

  if (redisConnection) {
    console.log('  Closing Redis connection...');
    redisConnection.disconnect();
    console.log('  ✓ Redis disconnected');
  }

  console.log('\nWorker shut down successfully');
  process.exit(0);
}

/**
 * Display worker statistics every 30 seconds
 */
function startStatsReporter(): void {
  setInterval(async () => {
    if (worker) {
      try {
        console.log(`\n--- Worker Stats [${new Date().toISOString()}] ---`);
        console.log(`  Worker status: Running`);
        console.log('  Waiting for jobs...');
        console.log('---\n');
      } catch (error) {
        // Ignore stats errors
      }
    }
  }, 30000);
}

// Start the worker
initializeWorker()
  .then(() => {
    startStatsReporter();
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
