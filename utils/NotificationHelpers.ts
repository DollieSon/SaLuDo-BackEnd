/**
 * Notification Helper Utilities
 * Helper functions to determine who should receive notifications
 */

import { UserRepository } from '../repositories/UserRepository';
import { UserRole } from '../Models/enums/UserRole';
import { connectDB } from '../mongo_db';

/**
 * Get all HR users (HR_USER, HR_MANAGER, RECRUITER, INTERVIEWER)
 */
export async function getAllHRUsers(): Promise<Array<{ userId: string; email: string; name: string }>> {
  const db = await connectDB();
  const userRepo = new UserRepository(db);
  
  const hrRoles = [
    UserRole.HR_USER,
    UserRole.HR_MANAGER,
    UserRole.RECRUITER,
    UserRole.INTERVIEWER,
    UserRole.ADMIN
  ];
  
  // Get users for each role and combine
  const allUsers = await Promise.all(
    hrRoles.map(role => userRepo.findByRole(role))
  );
  
  const flattenedUsers = allUsers.flat();
  
  return flattenedUsers
    .filter((user: any) => user.isActive && !user.isDeleted)
    .map((user: any) => ({
      userId: user.userId,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`
    }));
}

/**
 * Get assigned HR users for a candidate
 */
export async function getAssignedHRUsers(
  candidateId: string
): Promise<Array<{ userId: string; email: string; name: string }>> {
  const db = await connectDB();
  const candidatesCollection = db.collection('candidates');
  
  const candidate = await candidatesCollection.findOne({ candidateId });
  
  if (!candidate || !candidate.assignedHRUserIds || candidate.assignedHRUserIds.length === 0) {
    // If no HR assigned, return all HR users as fallback
    return getAllHRUsers();
  }
  
  const userRepo = new UserRepository(db);
  const assignedUsers = await Promise.all(
    candidate.assignedHRUserIds.map(async (userId: string) => {
      const user = await userRepo.findById(userId);
      if (user && user.isActive && !user.isDeleted) {
        return {
          userId: user.userId,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`
        };
      }
      return null;
    })
  );
  
  return assignedUsers.filter((user): user is { userId: string; email: string; name: string } => user !== null);
}

/**
 * Get all admin users
 */
export async function getAdminUsers(): Promise<Array<{ userId: string; email: string; name: string }>> {
  const db = await connectDB();
  const userRepo = new UserRepository(db);
  
  const users = await userRepo.findByRole(UserRole.ADMIN);
  
  return users
    .filter((user: any) => user.isActive && !user.isDeleted)
    .map((user: any) => ({
      userId: user.userId,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`
    }));
}

/**
 * Get user details by ID
 */
export async function getUserDetails(
  userId: string
): Promise<{ userId: string; email: string; name: string } | null> {
  const db = await connectDB();
  const userRepo = new UserRepository(db);
  
  const user = await userRepo.findById(userId);
  
  if (!user || !user.isActive || user.isDeleted) {
    return null;
  }
  
  return {
    userId: user.userId,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`
  };
}
