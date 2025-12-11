// =======================
// USER INTERFACES & TYPES
// =======================
// Purpose: Type definitions for User model
// =======================

import { UserRole } from '../enums/UserRole';
import { ProfilePhotoMetadata, Availability, RoleSpecificData } from './ProfileInterfaces';

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
  failedLoginAttempts: number;        // Track consecutive failed login attempts
  accountLockedUntil?: Date;          // Temporary account lock timestamp
  passwordChangedAt?: Date;           // Last password change timestamp
  passwordHistory?: string[];         // Store last N password hashes to prevent reuse
  // Extended profile fields
  photoMetadata?: ProfilePhotoMetadata; // Profile photo information
  phoneNumber?: string;                 // Contact phone number
  location?: string;                    // Location/office (e.g., "New York, NY")
  timezone?: string;                    // Timezone (e.g., "America/New_York")
  linkedInUrl?: string;                 // LinkedIn profile URL
  bio?: string;                         // Professional bio/about section
  availability?: Availability;          // Scheduling availability
  roleSpecificData?: RoleSpecificData;  // Role-based additional data
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
  passwordHash?: string; // For password updates
  passwordChangedAt?: Date; // For recording password change timestamp
  failedLoginAttempts?: number; // For tracking login attempts
  accountLockedUntil?: Date; // For account lockout
  lastLogin?: Date; // For recording login timestamp
  // Extended profile fields
  photoMetadata?: ProfilePhotoMetadata; // Profile photo information
  phoneNumber?: string; // Contact phone number
  location?: string; // Location/office
  timezone?: string; // Timezone
  linkedInUrl?: string; // LinkedIn profile URL
  bio?: string; // Professional bio
  availability?: Availability; // Scheduling availability
  roleSpecificData?: RoleSpecificData; // Role-based data
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
  // Extended profile fields
  photoMetadata?: ProfilePhotoMetadata; // Profile photo information
  phoneNumber?: string; // Contact phone number
  location?: string; // Location/office
  timezone?: string; // Timezone
  linkedInUrl?: string; // LinkedIn profile URL
  bio?: string; // Professional bio
  availability?: Availability; // Scheduling availability
  roleSpecificData?: RoleSpecificData; // Role-based data
}
