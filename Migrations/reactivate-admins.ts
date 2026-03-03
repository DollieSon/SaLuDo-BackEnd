// =======================
// REACTIVATE ADMIN ACCOUNTS SCRIPT
// =======================
// Purpose: Unlock and reactivate all admin user accounts
// Usage: npx ts-node Migrations/reactivate-admins.ts
// Notes:
// - Uses existing UserRepository methods to unlock and activate accounts
// - Only affects users with role = admin and not soft-deleted
// =======================

import { connectDB } from '../mongo_db';
import { UserRepository } from '../repositories/UserRepository';
import { UserRole, UserData } from '../Models/User';

async function reactivateAdmins() {
  console.log('\n=== SaLuDo Admin Reactivation ===');
  try {
    const db = await connectDB();
    const userRepo = new UserRepository(db);

    console.log('Fetching admin users...');
    const admins: UserData[] = await userRepo.findByRole(UserRole.ADMIN);
    console.log(`Found ${admins.length} admin account(s).`);

    let reactivated = 0;
    let alreadyActive = 0;

    for (const admin of admins) {
      const needsUnlock = !!admin.accountLockedUntil || (admin.failedLoginAttempts ?? 0) > 0;
      const needsActivate = admin.isActive !== true;

      if (needsUnlock) {
        await userRepo.unlockAccount(admin.userId);
      }
      if (needsActivate) {
        await userRepo.activate(admin.userId);
      }

      if (needsUnlock || needsActivate) {
        reactivated++;
        console.log(`✓ Reactivated admin ${admin.email} (${admin.userId})`);
      } else {
        alreadyActive++;
      }
    }

    console.log('\nSummary:');
    console.log('─────────────────────────────────');
    console.log(`Total admins:       ${admins.length}`);
    console.log(`Reactivated:        ${reactivated}`);
    console.log(`Already active:     ${alreadyActive}`);
    console.log('─────────────────────────────────');

    console.log('\nDone.');
    process.exit(0);
  } catch (err) {
    console.error('Error reactivating admins:', err);
    process.exit(1);
  }
}

reactivateAdmins();
