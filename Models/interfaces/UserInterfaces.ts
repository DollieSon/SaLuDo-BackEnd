// =======================
// USER INTERFACES & TYPES
// =======================
// Purpose: Type definitions for User model
// =======================

import { UserRole } from '../enums/UserRole';

// =======================
// DATA INTERFACES
// =======================

export interface UserData {
  userId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  title: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  refreshToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  // Security fields for admin-created accounts
  mustChangePassword: boolean;        // Force password change on first/next login
  failedLoginAttempts: number;        // Track consecutive failed login attempts
  accountLockedUntil?: Date;          // Temporary account lock timestamp
  passwordChangedAt?: Date;           // Last password change timestamp
  passwordHistory?: string[];         // Store last N password hashes to prevent reuse
}

// =======================
// CREATE & UPDATE TYPES
// =======================

export interface CreateUserData {
  email: string;
  password: string; // Plain text - will be hashed by service
  firstName: string;
  middleName?: string;
  lastName: string;
  title: string;
  role: UserRole;
}

export interface UpdateUserData {
  email?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  title?: string;
  role?: UserRole;
  isActive?: boolean;
  isVerified?: boolean;
}

// =======================
// AUTHENTICATION TYPES
// =======================

export interface UserLoginData {
  email: string;
  password: string;
}

export interface UserAuthTokens {
  accessToken: string;
  refreshToken: string;
}

// =======================
// PROFILE TYPES
// =======================

export interface UserProfile {
  userId: string;
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;
  title: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  lastLogin?: Date;
}
