import { connectDB } from "../mongo_db";
import { CandidateStatus } from "../Models/Candidate";

/**
 * Migration script to add status and statusHistory fields to existing candidates
 * Run this once to ensure all candidates have these fields
 */
async function migrateStatusHistory() {
  try {
    console.log("Starting status history migration...");
    
    const db = await connectDB();
    const personalInfoCollection = db.collection("personalInfo");

    // Find all candidates without status field
    const candidatesWithoutStatus = await personalInfoCollection.countDocuments({
      status: { $exists: false }
    });

    console.log(`Found ${candidatesWithoutStatus} candidates without status field`);

    if (candidatesWithoutStatus > 0) {
      // Update candidates missing status field
      const statusResult = await personalInfoCollection.updateMany(
        { status: { $exists: false } },
        { 
          $set: { 
            status: CandidateStatus.APPLIED,
            dateUpdated: new Date()
          } 
        }
      );
      console.log(`✓ Added default status to ${statusResult.modifiedCount} candidates`);
    }

    // Find all candidates without statusHistory field
    const candidatesWithoutHistory = await personalInfoCollection.countDocuments({
      statusHistory: { $exists: false }
    });

    console.log(`Found ${candidatesWithoutHistory} candidates without statusHistory field`);

    if (candidatesWithoutHistory > 0) {
      // Update candidates missing statusHistory field
      const historyResult = await personalInfoCollection.updateMany(
        { statusHistory: { $exists: false } },
        { 
          $set: { 
            statusHistory: [],
            dateUpdated: new Date()
          } 
        }
      );
      console.log(`✓ Added empty statusHistory to ${historyResult.modifiedCount} candidates`);
    }

    // Verify migration
    const totalCandidates = await personalInfoCollection.countDocuments({
      isDeleted: { $ne: true }
    });
    
    const candidatesWithBoth = await personalInfoCollection.countDocuments({
      status: { $exists: true },
      statusHistory: { $exists: true },
      isDeleted: { $ne: true }
    });

    console.log("\n=== Migration Summary ===");
    console.log(`Total active candidates: ${totalCandidates}`);
    console.log(`Candidates with status & statusHistory: ${candidatesWithBoth}`);
    
    if (totalCandidates === candidatesWithBoth) {
      console.log("✓ Migration completed successfully! All candidates have status and statusHistory fields.");
    } else {
      console.log(`⚠ Warning: ${totalCandidates - candidatesWithBoth} candidates still missing fields`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateStatusHistory();
