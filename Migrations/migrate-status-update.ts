/**
 * Migration Script: Update Candidate Statuses to New Pipeline
 * 
 * This script migrates existing candidates from old status values to the new
 * recruitment pipeline statuses.
 * 
 * Old Status Mapping:
 * - "Applied" -> "For Review"
 * - "Reference Check" -> "Paper Screening"
 * - "Offer" -> "Offer Extended"
 * - "Hired" -> "Hired" (no change)
 * - "Rejected" -> "Rejected" (no change)
 * - "Withdrawn" -> "Withdrawn" (no change)
 * 
 * Usage: ts-node migrate-status-update.ts
 */

import { connectDB } from "../mongo_db";
import { PersonalInfoRepository } from "../repositories/CandidateRepository";
import { CandidateStatus } from "../Models/Candidate";

interface StatusMapping {
  [key: string]: CandidateStatus;
}

const STATUS_MAPPING: StatusMapping = {
  "Applied": CandidateStatus.FOR_REVIEW,
  "Reference Check": CandidateStatus.PAPER_SCREENING,
  "Offer": CandidateStatus.OFFER_EXTENDED,
  "Hired": CandidateStatus.HIRED,
  "Rejected": CandidateStatus.REJECTED,
  "Withdrawn": CandidateStatus.WITHDRAWN,
};

interface MigrationStats {
  totalCandidates: number;
  updatedCandidates: number;
  skippedCandidates: number;
  errors: number;
  statusBreakdown: { [key: string]: number };
  errorDetails: Array<{ candidateId: string; error: string }>;
}

async function migrateStatuses(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalCandidates: 0,
    updatedCandidates: 0,
    skippedCandidates: 0,
    errors: 0,
    statusBreakdown: {},
    errorDetails: [],
  };

  try {
    console.log("🔄 Starting Status Migration to New Pipeline...\n");

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
        const oldStatus = candidate.status as string;
        const newStatus = STATUS_MAPPING[oldStatus];

        // Track status breakdown
        if (!stats.statusBreakdown[oldStatus]) {
          stats.statusBreakdown[oldStatus] = 0;
        }
        stats.statusBreakdown[oldStatus]++;

        if (!newStatus) {
          console.log(`⚠️  Unknown status "${oldStatus}" for ${candidate.name} (${candidate.candidateId})`);
          stats.skippedCandidates++;
          continue;
        }

        if (oldStatus === newStatus) {
          console.log(`⏭️  ${candidate.name} (${candidate.candidateId}) - Status unchanged: ${oldStatus}`);
          stats.skippedCandidates++;
          continue;
        }

        // Update status
        await personalInfoRepo.update(candidate.candidateId, {
          status: newStatus,
        });

        // Update status history if it exists
        const statusHistory = (candidate as any).statusHistory || [];
        if (statusHistory.length > 0) {
          // Update all historical status entries
          const updatedHistory = statusHistory.map((entry: any) => {
            const mappedStatus = STATUS_MAPPING[entry.status];
            if (mappedStatus && entry.status !== mappedStatus) {
              return {
                ...entry,
                status: mappedStatus,
                notes: entry.notes 
                  ? `${entry.notes} [Migrated from: ${entry.status}]` 
                  : `Migrated from: ${entry.status}`,
              };
            }
            return entry;
          });

          await personalInfoRepo.update(candidate.candidateId, {
            statusHistory: updatedHistory,
          });
        }

        console.log(`✅ Updated ${candidate.name} (${candidate.candidateId}): "${oldStatus}" -> "${newStatus}"`);
        stats.updatedCandidates++;
      } catch (error) {
        console.error(`❌ Error migrating ${candidate.name} (${candidate.candidateId}):`, error);
        stats.errors++;
        stats.errorDetails.push({
          candidateId: candidate.candidateId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("📋 Migration Summary");
    console.log("=".repeat(70));
    console.log(`Total Candidates:    ${stats.totalCandidates}`);
    console.log(`Updated:             ${stats.updatedCandidates} ✅`);
    console.log(`Skipped:             ${stats.skippedCandidates} ⏭️`);
    console.log(`Errors:              ${stats.errors} ❌`);
    console.log("=".repeat(70));

    console.log("\n📊 Status Breakdown:");
    Object.entries(stats.statusBreakdown).forEach(([status, count]) => {
      const newStatus = STATUS_MAPPING[status] || status;
      const arrow = status !== newStatus ? ` -> ${newStatus}` : " (no change)";
      console.log(`   ${status}${arrow}: ${count} candidates`);
    });

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
  migrateStatuses()
    .then((stats) => {
      process.exit(stats.errors > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

export { migrateStatuses };
