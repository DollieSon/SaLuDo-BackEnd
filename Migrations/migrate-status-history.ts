/**
 * Migration Script: Initialize Status History for Existing Candidates
 * 
 * This script creates an initial status history entry for all existing candidates
 * who don't have a statusHistory array. It uses their current status and dateCreated
 * as the basis for the initial entry.
 * 
 * Usage: ts-node migrate-status-history.ts
 */

import { connectDB } from "../mongo_db";
import { PersonalInfoRepository } from "../repositories/CandidateRepository";
import { v4 as uuidv4 } from "uuid";

interface MigrationStats {
  totalCandidates: number;
  migratedCandidates: number;
  skippedCandidates: number;
  errors: number;
  errorDetails: Array<{ candidateId: string; error: string }>;
}

async function migrateStatusHistory(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalCandidates: 0,
    migratedCandidates: 0,
    skippedCandidates: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    console.log("🚀 Starting Status History Migration...\n");

    // Connect to database
    const db = await connectDB();
    const personalInfoRepo = new PersonalInfoRepository(db);

    // Get all candidates
    const allCandidates = await personalInfoRepo.findAll();
    stats.totalCandidates = allCandidates.length;

    console.log(`📊 Found ${stats.totalCandidates} total candidates\n`);

    // Process each candidate
    for (const candidate of allCandidates) {
      try {
        // Check if candidate already has statusHistory
        const existingHistory = (candidate as any).statusHistory;
        
        if (existingHistory && Array.isArray(existingHistory) && existingHistory.length > 0) {
          console.log(`⏭️  Skipping ${candidate.name} (${candidate.candidateId}) - already has status history`);
          stats.skippedCandidates++;
          continue;
        }

        // Create initial status history entry
        const initialEntry = {
          historyId: uuidv4(),
          status: candidate.status,
          previousStatus: null,
          changedAt: candidate.dateCreated,
          changedBy: "system",
          changedByName: "System Migration",
          changedByEmail: "system@migration",
          reason: "Initial status - migrated from existing data",
          notes: `Migrated on ${new Date().toISOString()}. Original status: ${candidate.status}`,
          isAutomated: true,
          source: "migration" as const,
        };

        // Update candidate with statusHistory
        await personalInfoRepo.update(candidate.candidateId, {
          statusHistory: [initialEntry],
        });

        console.log(`✅ Migrated ${candidate.name} (${candidate.candidateId}) - Status: ${candidate.status}`);
        stats.migratedCandidates++;
      } catch (error) {
        console.error(`❌ Error migrating ${candidate.name} (${candidate.candidateId}):`, error);
        stats.errors++;
        stats.errorDetails.push({
          candidateId: candidate.candidateId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📋 Migration Summary");
    console.log("=".repeat(60));
    console.log(`Total Candidates:    ${stats.totalCandidates}`);
    console.log(`Migrated:            ${stats.migratedCandidates} ✅`);
    console.log(`Skipped:             ${stats.skippedCandidates} ⏭️`);
    console.log(`Errors:              ${stats.errors} ❌`);
    console.log("=".repeat(60));

    if (stats.errorDetails.length > 0) {
      console.log("\n⚠️  Error Details:");
      stats.errorDetails.forEach((err, index) => {
        console.log(`  ${index + 1}. Candidate ${err.candidateId}: ${err.error}`);
      });
    }

    if (stats.errors === 0) {
      console.log("\n🎉 Migration completed successfully!");
    } else {
      console.log("\n⚠️  Migration completed with errors. Please review the error details above.");
    }

    return stats;
  } catch (error) {
    console.error("\n💥 Fatal error during migration:", error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrateStatusHistory()
    .then((stats) => {
      process.exit(stats.errors > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

export { migrateStatusHistory };
