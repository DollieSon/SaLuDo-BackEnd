// =======================
// SEED USERS SCRIPT
// =======================
// Purpose: Create sample users for testing the SaLuDo application
// Usage: npx ts-node seed-users.ts
// =======================

const bcrypt = require("bcrypt");
import { connectDB } from "./mongo_db";
import { UserRepository } from "./repositories/UserRepository";
import { UserRole } from "./Models/User";

const sampleUsers = [
  {
    email: "admin@saludo.com",
    password: "Admin123!",
    firstName: "John",
    lastName: "Admin",
    title: "System Administrator",
    role: UserRole.ADMIN,
  },
  {
    email: "hr.manager@saludo.com",
    password: "Manager123!",
    firstName: "Sarah",
    lastName: "Johnson",
    title: "HR Manager",
    role: UserRole.HR_MANAGER,
  },
  {
    email: "hr.user@saludo.com",
    password: "HRUser123!",
    firstName: "Mike",
    lastName: "Davis",
    title: "HR Assistant",
    role: UserRole.HR_USER,
  },
  {
    email: "recruiter@saludo.com",
    password: "Recruit123!",
    firstName: "Emma",
    lastName: "Wilson",
    title: "Senior Recruiter",
    role: UserRole.RECRUITER,
  },
  {
    email: "interviewer@saludo.com",
    password: "Interview123!",
    firstName: "David",
    lastName: "Martinez",
    title: "Technical Interviewer",
    role: UserRole.INTERVIEWER,
  },
];

async function seedUsers() {
  try {
    console.log("\n=== SaLuDo User Seeding ===\n");

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
      const passwordHash = await bcrypt.hash(userData.password, 10);

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
        mustChangePassword: false,
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
      console.log("Login credentials:\n");
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
