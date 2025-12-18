/**
 * Migration script to fix candidates with null status
 * Sets null status to FOR_REVIEW (the initial status)
 */

import { connectDB } from "../mongo_db";
import { PersonalInfoRepository } from "../repositories/CandidateRepository";
import { CandidateStatus } from "../Models/Candidate";

async function fixNullStatus() {
  console.log("🔧 Starting null status fix...");

  try {
    const db = await connectDB();
    const personalInfoRepo = new PersonalInfoRepository(db);

    // Find all candidates with null or undefined status
    const allCandidates = await personalInfoRepo.findAll();
    const candidatesWithNullStatus = allCandidates.filter(
      (c) => !c.status || c.status === null
    );

    console.log(`Found ${candidatesWithNullStatus.length} candidates with null status`);

    if (candidatesWithNullStatus.length === 0) {
      console.log("✅ No candidates with null status found!");
      process.exit(0);
    }

    // Update each candidate to FOR_REVIEW status
    let successCount = 0;
    let errorCount = 0;

    for (const candidate of candidatesWithNullStatus) {
      try {
        await personalInfoRepo.update(candidate.candidateId, {
          status: CandidateStatus.FOR_REVIEW,
        });

        console.log(
          `✅ Updated ${candidate.name} (${candidate.candidateId}) -> FOR_REVIEW`
        );
        successCount++;
      } catch (error) {
        console.error(
          `❌ Failed to update ${candidate.name}:`,
          error instanceof Error ? error.message : error
        );
        errorCount++;
      }
    }

    console.log("\n📊 Migration Summary:");
    console.log(`  ✅ Successfully updated: ${successCount}`);
    console.log(`  ❌ Failed: ${errorCount}`);
    console.log(`  📝 Total processed: ${candidatesWithNullStatus.length}`);

    process.exit(errorCount > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

fixNullStatus();
