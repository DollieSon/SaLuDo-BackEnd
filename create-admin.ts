// =======================
// CREATE ADMIN USER SCRIPT
// =======================
// Purpose: Create an admin user for the SaLuDo application
// Usage: npx ts-node create-admin.ts
// =======================

import bcrypt from 'bcrypt';
import { connectDB } from './mongo_db';
import { UserRepository } from './repositories/UserRepository';
import { UserRole } from './Models/User';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdminUser() {
  try {
    console.log('\n=== SaLuDo Admin User Creation ===\n');

    // Connect to database
    const db = await connectDB();
    const userRepository = new UserRepository(db);

    // Gather user information
    console.log('Please provide the following information:\n');
    
    const email = await question('Email address: ');
    if (!email || !email.includes('@')) {
      console.error('❌ Invalid email address');
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await userRepository.getUserByEmail(email);
    if (existingUser) {
      console.error(`❌ User with email ${email} already exists!`);
      process.exit(1);
    }

    const firstName = await question('First Name: ');
    if (!firstName) {
      console.error('❌ First name is required');
      process.exit(1);
    }

    const middleName = await question('Middle Name (optional, press Enter to skip): ');
    
    const lastName = await question('Last Name: ');
    if (!lastName) {
      console.error('❌ Last name is required');
      process.exit(1);
    }

    const title = await question('Title (e.g., System Administrator): ');
    if (!title) {
      console.error('❌ Title is required');
      process.exit(1);
    }

    const password = await question('Password (min 8 characters): ');
    if (!password || password.length < 8) {
      console.error('❌ Password must be at least 8 characters');
      process.exit(1);
    }

    const confirmPassword = await question('Confirm Password: ');
    if (password !== confirmPassword) {
      console.error('❌ Passwords do not match');
      process.exit(1);
    }

    // Hash the password
    console.log('\n🔒 Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    console.log('👤 Creating admin user...');
    const adminUser = await userRepository.createUser({
      email: email.toLowerCase().trim(),
      password: passwordHash,
      firstName: firstName.trim(),
      middleName: middleName ? middleName.trim() : undefined,
      lastName: lastName.trim(),
      title: title.trim(),
      role: UserRole.ADMIN,
    });

    // Set the user as verified and active (admin doesn't need to verify)
    await userRepository.updateUser(adminUser.userId, {
      isVerified: true,
      mustChangePassword: false, // Admin can choose to change later
    });

    console.log('\n✅ Admin user created successfully!\n');
    console.log('User Details:');
    console.log('─────────────────────────────────');
    console.log(`User ID:    ${adminUser.userId}`);
    console.log(`Email:      ${adminUser.email}`);
    console.log(`Name:       ${firstName}${middleName ? ' ' + middleName : ''} ${lastName}`);
    console.log(`Title:      ${title}`);
    console.log(`Role:       ADMIN`);
    console.log(`Status:     Active & Verified`);
    console.log('─────────────────────────────────\n');
    console.log('You can now login with this account.\n');

  } catch (error) {
    console.error('\n❌ Error creating admin user:', error);
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Run the script
createAdminUser();
