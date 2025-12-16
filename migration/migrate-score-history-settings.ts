import { connectDB } from "../mongo_db";

/**
 * Migration script to convert scoreHistory mode field to scoringSettingsId
 * This migration:
 * 1. Finds all candidates with scoreHistory entries
 * 2. For each entry with 'mode' field, attempts to determine the scoring settings ID:
 *    - For job-specific: looks up the job's scoring preferences
 *    - For general: uses global scoring preferences
 *    - Falls back to 'unknown' if preferences cannot be determined
 * 3. Removes the old 'mode' field
 * 
 * Run this once after deploying the scoringSettingsId changes
 */
async function migrateScoreHistorySettings() {
  try {
    console.log("Starting score history settings migration...");
    
    const db = await connectDB();
    const personalInfoCollection = db.collection("personalInfo");
    const scoringPrefsCollection = db.collection("scoringPreferences");

    // Find all candidates with score history
    const candidatesWithScoreHistory = await personalInfoCollection.find({
      scoreHistory: { $exists: true, $ne: [] },
      isDeleted: { $ne: true }
    }).toArray();

    console.log(`Found ${candidatesWithScoreHistory.length} candidates with score history`);

    if (candidatesWithScoreHistory.length === 0) {
      console.log("No candidates with score history to migrate");
      process.exit(0);
    }

    // Get global scoring preferences
    const globalPrefs = await scoringPrefsCollection.findOne({
      scope: 'global'
    });

    if (!globalPrefs) {
      console.log("⚠ Warning: No global scoring preferences found. Will use 'unknown' as fallback.");
    }

    let totalUpdated = 0;
    let totalEntries = 0;
    let entriesWithMode = 0;

    for (const candidate of candidatesWithScoreHistory) {
      const scoreHistory = candidate.scoreHistory || [];
      let modified = false;

      for (let i = 0; i < scoreHistory.length; i++) {
        const entry = scoreHistory[i];
        totalEntries++;

        // Check if entry has old 'mode' field
        if (entry.mode) {
          entriesWithMode++;
          let scoringSettingsId = 'unknown';

          // Try to determine the correct scoring settings ID
          if (entry.mode === 'job-specific' && entry.jobId) {
            // Look up job-specific scoring preferences
            const jobPrefs = await scoringPrefsCollection.findOne({
              scope: 'job',
              jobId: entry.jobId
            });

            if (jobPrefs && jobPrefs.preferencesId) {
              scoringSettingsId = jobPrefs.preferencesId;
            } else if (globalPrefs && globalPrefs.preferencesId) {
              // Fall back to global if job-specific not found
              scoringSettingsId = globalPrefs.preferencesId;
            }
          } else if (entry.mode === 'general') {
            // Use global preferences
            if (globalPrefs && globalPrefs.preferencesId) {
              scoringSettingsId = globalPrefs.preferencesId;
            }
          }

          // Add scoringSettingsId and remove mode
          scoreHistory[i].scoringSettingsId = scoringSettingsId;
          delete scoreHistory[i].mode;
          modified = true;
        } else if (!entry.scoringSettingsId) {
          // Entry doesn't have mode or scoringSettingsId, set default
          scoreHistory[i].scoringSettingsId = globalPrefs?.preferencesId || 'unknown';
          modified = true;
        }
      }

      // Update candidate if any changes were made
      if (modified) {
        await personalInfoCollection.updateOne(
          { candidateId: candidate.candidateId },
          {
            $set: {
              scoreHistory,
              dateUpdated: new Date()
            }
          }
        );
        totalUpdated++;
      }
    }

    // Verify migration
    const candidatesWithOldMode = await personalInfoCollection.countDocuments({
      "scoreHistory.mode": { $exists: true },
      isDeleted: { $ne: true }
    });

    const candidatesWithNewField = await personalInfoCollection.countDocuments({
      "scoreHistory.scoringSettingsId": { $exists: true },
      isDeleted: { $ne: true }
    });

    console.log("\n=== Migration Summary ===");
    console.log(`Total candidates processed: ${candidatesWithScoreHistory.length}`);
    console.log(`Total score history entries: ${totalEntries}`);
    console.log(`Entries with old 'mode' field: ${entriesWithMode}`);
    console.log(`Candidates updated: ${totalUpdated}`);
    console.log(`Candidates with scoringSettingsId: ${candidatesWithNewField}`);
    console.log(`Candidates still with old 'mode' field: ${candidatesWithOldMode}`);
    
    if (candidatesWithOldMode === 0 && candidatesWithNewField > 0) {
      console.log("✓ Migration completed successfully! All score history entries now use scoringSettingsId.");
    } else if (candidatesWithOldMode > 0) {
      console.log(`⚠ Warning: ${candidatesWithOldMode} candidates still have entries with old 'mode' field`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateScoreHistorySettings();
