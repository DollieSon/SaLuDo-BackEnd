// =======================
// SEED USERS SCRIPT
// =======================
// Purpose: Create sample users for testing the SaLuDo application
// Usage: docker compose exec backend node dist/seed-users.js
// =======================

import { PasswordUtils } from "./routes/middleware/passwordUtils";
import { connectDB } from "./mongo_db";
import { UserRepository } from "./repositories/UserRepository";
import { UserRole } from "./Models/User";

const sampleUsers = [
  {
    email: "admin@saludo.com",
    password: PasswordUtils.generateTemporaryPassword(16),
    firstName: "John",
    lastName: "Admin",
    title: "System Administrator",
    role: UserRole.ADMIN,
  },
  {
    email: "hr.manager@saludo.com",
    password: PasswordUtils.generateTemporaryPassword(16),
    firstName: "Sarah",
    lastName: "Johnson",
    title: "HR Manager",
    role: UserRole.HR_MANAGER,
  },
  {
    email: "hr.user@saludo.com",
    password: PasswordUtils.generateTemporaryPassword(16),
    firstName: "Mike",
    lastName: "Davis",
    title: "HR Assistant",
    role: UserRole.HR_USER,
  },
  {
    email: "recruiter@saludo.com",
    password: PasswordUtils.generateTemporaryPassword(16),
    firstName: "Emma",
    lastName: "Wilson",
    title: "Senior Recruiter",
    role: UserRole.RECRUITER,
  },
  {
    email: "interviewer@saludo.com",
    password: PasswordUtils.generateTemporaryPassword(16),
    firstName: "David",
    lastName: "Martinez",
    title: "Technical Interviewer",
    role: UserRole.INTERVIEWER,
  },
];

async function seedUsers() {
  try {
    console.log("\n=== SaLuDo User Seeding ===\n");

    // Demo accounts must never be created on a production database
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED_USERS !== "true") {
      console.error("Refusing to seed demo users with NODE_ENV=production.");
      process.exit(1);
    }

    // Connect to database
    const db = await connectDB();
    const userRepository = new UserRepository(db);

    let created = 0;
    let skipped = 0;

    for (const userData of sampleUsers) {
      console.log(`Processing: ${userData.email}...`);

      // Check if user already exists
      const existingUser = await userRepository.getUserByEmail(userData.email);

      if (existingUser) {
        console.log(`  ⏭️  User already exists - skipped\n`);
        skipped++;
        continue;
      }

      // Hash the password
      const passwordHash = await PasswordUtils.hashPassword(userData.password);

      // Create user
      const newUser = await userRepository.createUser({
        email: userData.email.toLowerCase(),
        password: passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        title: userData.title,
        role: userData.role,
      });

      // Mark as verified and active (for testing purposes)
      await userRepository.updateUser(newUser.userId, {
        isVerified: true,
        isActive: true,
      });

      console.log(`  ✅ Created successfully`);
      console.log(`     User ID: ${newUser.userId}`);
      console.log(`     Role: ${userData.role}\n`);
      created++;
    }

    console.log("\n═══════════════════════════════════════");
    console.log("📊 Summary:");
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total:   ${sampleUsers.length}`);
    console.log("═══════════════════════════════════════\n");

    if (created > 0) {
      console.log("🎉 Sample users created successfully!\n");
      console.log("Login credentials (randomly generated, shown only once):\n");
      sampleUsers.forEach((user) => {
        console.log(`${user.role.toUpperCase()}:`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Password: ${user.password}\n`);
      });
    }
  } catch (error) {
    console.error("\n❌ Error seeding users:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the script
seedUsers();
