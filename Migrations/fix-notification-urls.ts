/**
 * Migration Script: Fix Notification URLs
 * 
 * This script updates existing notifications that have incorrect URLs:
 * - Changes /candidates/:id to /profile/:id
 * - Changes /jobs/:id to /job/:id
 * 
 * It also adds entityId and entityType to the data object for better handling.
 * 
 * Usage: ts-node Migrations/fix-notification-urls.ts
 */

import { connectDB } from "../mongo_db";

interface MigrationStats {
  totalNotifications: number;
  candidateUrlsFixed: number;
  jobUrlsFixed: number;
  skippedNotifications: number;
  errors: number;
  errorDetails: Array<{ notificationId: string; error: string }>;
}

async function fixNotificationUrls(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalNotifications: 0,
    candidateUrlsFixed: 0,
    jobUrlsFixed: 0,
    skippedNotifications: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    console.log("🚀 Starting Notification URL Migration...\n");

    // Connect to database
    const db = await connectDB();
    const collection = db.collection("notifications");

    // Get all notifications
    const allNotifications = await collection.find({}).toArray();
    stats.totalNotifications = allNotifications.length;

    console.log(`📊 Found ${stats.totalNotifications} total notifications\n`);

    // Process each notification
    for (const notification of allNotifications) {
      try {
        let needsUpdate = false;
        const updates: any = {};

        // Check if notification has an action.url that needs fixing
        if (notification.action?.url) {
          const oldUrl = notification.action.url;
          let newUrl = oldUrl;
          let fixType: 'candidate' | 'job' | null = null;

          // Fix candidate URLs: /candidates/:id -> /profile/:id
          if (oldUrl.includes('/candidates/')) {
            newUrl = oldUrl.replace(/\/candidates\/([^\/]+)/, '/profile/$1');
            fixType = 'candidate';
            needsUpdate = true;
          }

          // Fix job URLs: /jobs/:id -> /job/:id
          if (oldUrl.includes('/jobs/')) {
            newUrl = oldUrl.replace(/\/jobs\/([^\/]+)/, '/job/$1');
            fixType = 'job';
            needsUpdate = true;
          }

          if (needsUpdate) {
            updates['action.url'] = newUrl;

            // Extract the ID from the URL
            const idMatch = newUrl.match(/\/(profile|job)\/([^\/\?]+)/);
            if (idMatch) {
              const id = idMatch[2];
              
              // Add entityId and entityType to data if not present
              const data = notification.data || {};
              
              if (fixType === 'candidate') {
                if (!data.entityId) {
                  updates['data.entityId'] = id;
                }
                if (!data.entityType) {
                  updates['data.entityType'] = 'CANDIDATE';
                }
                if (!data.candidateId) {
                  updates['data.candidateId'] = id;
                }
              } else if (fixType === 'job') {
                if (!data.entityId) {
                  updates['data.entityId'] = id;
                }
                if (!data.entityType) {
                  updates['data.entityType'] = 'JOB';
                }
                if (!data.jobId) {
                  updates['data.jobId'] = id;
                }
              }
            }

            console.log(`🔧 Fixing notification ${notification.notificationId}:`);
            console.log(`   Old URL: ${oldUrl}`);
            console.log(`   New URL: ${newUrl}`);

            if (fixType === 'candidate') {
              stats.candidateUrlsFixed++;
            } else if (fixType === 'job') {
              stats.jobUrlsFixed++;
            }
          }
        }

        // Also check actionUrl field (direct property)
        if (notification.actionUrl) {
          const oldUrl = notification.actionUrl;
          let newUrl = oldUrl;

          // Fix candidate URLs
          if (oldUrl.includes('/candidates/')) {
            newUrl = oldUrl.replace(/\/candidates\/([^\/]+)/, '/profile/$1');
            needsUpdate = true;
            stats.candidateUrlsFixed++;
          }

          // Fix job URLs
          if (oldUrl.includes('/jobs/')) {
            newUrl = oldUrl.replace(/\/jobs\/([^\/]+)/, '/job/$1');
            needsUpdate = true;
            stats.jobUrlsFixed++;
          }

          if (oldUrl !== newUrl) {
            updates.actionUrl = newUrl;
            console.log(`🔧 Fixing notification ${notification.notificationId}:`);
            console.log(`   Old actionUrl: ${oldUrl}`);
            console.log(`   New actionUrl: ${newUrl}`);
          }
        }

        // Apply updates if needed
        if (needsUpdate && Object.keys(updates).length > 0) {
          await collection.updateOne(
            { notificationId: notification.notificationId },
            { $set: updates }
          );
        } else {
          stats.skippedNotifications++;
        }

      } catch (error) {
        stats.errors++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        stats.errorDetails.push({
          notificationId: notification.notificationId,
          error: errorMessage,
        });
        console.error(`❌ Error processing notification ${notification.notificationId}:`, errorMessage);
      }
    }

    console.log("\n✅ Migration completed!\n");
    return stats;

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run migration
(async () => {
  try {
    const stats = await fixNotificationUrls();

    console.log("📈 Migration Statistics:");
    console.log("=" .repeat(50));
    console.log(`Total notifications processed: ${stats.totalNotifications}`);
    console.log(`Candidate URLs fixed: ${stats.candidateUrlsFixed}`);
    console.log(`Job URLs fixed: ${stats.jobUrlsFixed}`);
    console.log(`Notifications skipped (no changes): ${stats.skippedNotifications}`);
    console.log(`Errors encountered: ${stats.errors}`);

    if (stats.errorDetails.length > 0) {
      console.log("\n❌ Error Details:");
      stats.errorDetails.forEach((detail, index) => {
        console.log(`${index + 1}. Notification ${detail.notificationId}: ${detail.error}`);
      });
    }

    console.log("\n✅ All done!");
    process.exit(0);
  } catch (error) {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  }
})();
