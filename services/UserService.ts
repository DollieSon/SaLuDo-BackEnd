// =======================
// USER SERVICE
// =======================
// Purpose: Business logic for user management, admin account creation, and security enforcement
// Related: User model, UserRepository
// =======================

import { User, UserRole } from '../Models/User';
import { UserRepository } from '../repositories/UserRepository';
import { ProfileStats, ProfileActivity, ProfileActivityType } from '../Models/interfaces/ProfileInterfaces';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { connectDB } from '../mongo_db';
import { PersonalInfoRepository } from '../repositories/CandidateRepository';
import { CandidateStatus } from '../Models/Candidate';

export class UserService {
  private userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  // Admin-only: Create a new user account
  async createUserAsAdmin(userData: {
    email: string;
    password: string; // hashed password
    firstName: string;
    lastName: string;
    title: string;
    role: UserRole;
    middleName?: string;
  }): Promise<User> {
    if (!userData.role) {
      throw new Error('Role is required for new user');
    }
    // Create user data - repository will handle setting default security fields
    const createData = {
      ...userData,
    };
    const userObj = await this.userRepository.createUser(createData);
    return User.fromObject(userObj);
  }

  // Admin-only: Reset user password and require change on next login
  async resetUserPassword(userId: string, newPassword: string): Promise<void> {
    await this.userRepository.updateUser(userId, {
      passwordHash: newPassword, // hashed password
      mustChangePassword: true,
      passwordChangedAt: new Date(),
    });
  }

  // Get user profile
  async getUserProfile(userId: string): Promise<User | null> {
    const userObj = await this.userRepository.getUserById(userId);
    return userObj ? User.fromObject(userObj) : null;
  }

  // Get all users with pagination and filtering (Admin only)
  async getAllUsers(options: {
    page?: number;
    limit?: number;
    role?: any;
    isActive?: boolean;
    search?: string;
  } = {}): Promise<{
    users: User[];
    totalCount: number;
    page: number;
    totalPages: number;
  }> {
    const result = await this.userRepository.findAllPaginated(options);
    return {
      ...result,
      users: result.users.map(userData => User.fromObject(userData))
    };
  }

  // Activate/deactivate user
  async setUserActiveStatus(userId: string, isActive: boolean): Promise<void> {
    await this.userRepository.updateUser(userId, { isActive });
  }

  // Soft delete user
  async softDeleteUser(userId: string): Promise<void> {
    await this.userRepository.delete(userId);
  }

  // =======================
  // PROFILE STATS & ACTIVITY
  // =======================

  /**
   * Get user profile statistics
   * @param userId - User ID
   * @returns ProfileStats object with candidate assignment counts and activity
   */
  async getUserStats(userId: string): Promise<ProfileStats> {
    const user = await this.userRepository.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get all candidates to calculate stats
    const db = await connectDB();
    const personalInfoRepo = new PersonalInfoRepository(db);
    const allCandidates = await personalInfoRepo.findAll();

    // Filter candidates assigned to this user
    const assignedCandidates = allCandidates.filter(c => 
      c.assignedHRUserIds && c.assignedHRUserIds.includes(userId)
    );

    // Count by status
    const activeCandidates = assignedCandidates.filter(c => 
      c.status === CandidateStatus.SCREENING || 
      c.status === CandidateStatus.INTERVIEWING ||
      c.status === CandidateStatus.OFFER_MADE
    );

    const hiredCandidates = assignedCandidates.filter(c => 
      c.status === CandidateStatus.HIRED
    );

    const rejectedCandidates = assignedCandidates.filter(c => 
      c.status === CandidateStatus.REJECTED
    );

    // Calculate account age in days
    const accountAge = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const stats: ProfileStats = {
      userId: user.userId,
      totalCandidatesAssigned: assignedCandidates.length,
      activeCandidatesCount: activeCandidates.length,
      candidatesHired: hiredCandidates.length,
      candidatesRejected: rejectedCandidates.length,
      lastActivityDate: user.lastLogin || user.updatedAt,
      accountAge
    };

    return stats;
  }

  /**
   * Get user profile activity (recent changes)
   * @param userId - User ID
   * @param limit - Number of activities to return (default: 10)
   * @returns Array of profile activities
   */
  async getProfileActivity(userId: string, limit: number = 10): Promise<ProfileActivity[]> {
    const db = await connectDB();
    const auditLogRepo = new AuditLogRepository(db);

    // Get recent audit logs for this user
    const logs = await auditLogRepo.getUserAuditLogs(userId, limit);

    // Transform audit logs to profile activities
    const activities: ProfileActivity[] = logs
      .filter(log => this.isProfileRelatedEvent(log.eventType))
      .map(log => ({
        activityId: log._id || '',
        userId: log.userId || userId,
        activityType: this.mapEventTypeToActivityType(log.eventType),
        fieldChanged: log.details?.resource,
        oldValue: log.details?.oldValue,
        newValue: log.details?.newValue,
        timestamp: log.timestamp,
        ipAddress: log.ipAddress
      }));

    return activities.slice(0, limit);
  }

  /**
   * Update user profile and create audit trail
   * @param userId - User ID
   * @param updateData - Data to update
   * @param context - Audit context (user, IP, etc.)
   */
  async updateProfileWithAudit(
    userId: string,
    updateData: any,
    context: { performedBy: string; ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    const existingUser = await this.userRepository.getUserById(userId);
    if (!existingUser) {
      throw new Error('User not found');
    }

    // Track what fields changed
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

    const fieldsToTrack = ['phoneNumber', 'location', 'timezone', 'linkedInUrl', 'bio', 'availability', 'roleSpecificData'];
    
    for (const field of fieldsToTrack) {
      if (updateData[field] !== undefined && updateData[field] !== (existingUser as any)[field]) {
        changes.push({
          field,
          oldValue: (existingUser as any)[field],
          newValue: updateData[field]
        });
      }
    }

    // Update the user
    await this.userRepository.updateUser(userId, updateData);

    // Create audit log entries for each change
    if (changes.length > 0) {
      const db = await connectDB();
      const auditLogRepo = new AuditLogRepository(db);

      for (const change of changes) {
        await auditLogRepo.logEvent({
          eventType: 'PROFILE_UPDATE' as any,
          severity: 'LOW' as any,
          userId: context.performedBy,
          targetUserId: userId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          details: {
            action: 'profile_field_updated',
            resource: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue
          },
          success: true
        });
      }
    }
  }

  // Helper methods
  private isProfileRelatedEvent(eventType: string): boolean {
    const profileEvents = [
      'PROFILE_UPDATE',
      'USER_UPDATE',
      'PASSWORD_CHANGE',
      'ACCOUNT_LOCKED',
      'ACCOUNT_UNLOCKED'
    ];
    return profileEvents.includes(eventType);
  }

  private mapEventTypeToActivityType(eventType: string): ProfileActivityType {
    const mapping: Record<string, ProfileActivityType> = {
      'PROFILE_UPDATE': 'profile_updated',
      'USER_UPDATE': 'profile_updated',
      'PASSWORD_CHANGE': 'profile_updated',
      'PHOTO_UPLOAD': 'photo_uploaded',
      'PHOTO_DELETE': 'photo_deleted'
    };
    return mapping[eventType] || 'profile_updated';
  }
}
