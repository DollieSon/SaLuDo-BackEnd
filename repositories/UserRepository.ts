import crypto from 'crypto';
import { Collection, Db } from 'mongodb';
import { escapeRegex } from '../utils/escapeRegex';
import { BaseRepository } from './BaseRepository';
import { UserData, CreateUserData, UpdateUserData, UserRole, User } from '../Models/User';

// Oldest sessions are dropped beyond this many signed-in browsers/devices
export const MAX_REFRESH_SESSIONS = 10;

const hashRefreshToken = (refreshToken: string): string =>
  crypto.createHash('sha256').update(refreshToken).digest('hex');

export class UserRepository extends BaseRepository<UserData, CreateUserData, UpdateUserData> {
  constructor(db: Db) {
    super(db, 'users');
    this.ensureIndexes();
  }
  // Service layer compatibility wrappers
  async createUser(data: CreateUserData): Promise<UserData> {
    return await this.create(data);
  }

  async updateUser(userId: string, data: Partial<UpdateUserData>): Promise<void> {
    await this.update(userId, data);
  }

  async getUserById(userId: string): Promise<UserData | null> {
    return await this.findById(userId);
  }

  async getUserByEmail(email: string): Promise<UserData | null> {
    return await this.findByEmail(email);
  }

  // Create indexes for performance and uniqueness
  private async ensureIndexes(): Promise<void> {
    try {
      // Unique email index
      await this.getCollection().createIndex({ email: 1 }, { unique: true });
      
      // Index for active users lookup
      await this.getCollection().createIndex({ isActive: 1, isDeleted: 1 });
      
      // Index for role-based queries
      await this.getCollection().createIndex({ role: 1 });
      
      // Index for password reset token lookup
      await this.getCollection().createIndex({ passwordResetToken: 1 });

      // Index for refresh session lookup
      await this.getCollection().createIndex({ 'refreshSessions.tokenHash': 1 });
    } catch (error) {
      console.error('Failed to create user indexes:', error);
    }
  }

  async create(data: CreateUserData): Promise<UserData> {
    // Note: Password should already be hashed by the service layer
    // This repository should NOT handle password hashing
    const userId = `usr_${this.generateId()}`;
    const now = new Date();

    const userData: UserData = {
      userId,
      email: data.email.toLowerCase(), // Normalize email to lowercase for consistency
      passwordHash: data.password, // Assumed to be already hashed
      firstName: data.firstName,
      middleName: data.middleName,
      lastName: data.lastName,
      title: data.title,
      role: data.role,
      isActive: true,
      isVerified: false,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      // Security fields
      failedLoginAttempts: 0,
    };

    await this.getCollection().insertOne(userData);
    return userData;
  }

  async findById(userId: string): Promise<UserData | null> {
    const result = await this.getCollection().findOne({ userId, isDeleted: { $ne: true } });
    return result as UserData | null;
  }

  async findByEmail(email: string): Promise<UserData | null> {
    const result = await this.getCollection().findOne({ 
      email: email.toLowerCase(), 
      isDeleted: { $ne: true } 
    });
    return result as UserData | null;
  }

  async update(userId: string, data: Partial<UpdateUserData>): Promise<void> {
    await this.getCollection().updateOne(
      { userId },
      { $set: { ...data, updatedAt: new Date() } }
    );
  }

  async delete(userId: string): Promise<void> {
    // Soft delete - set isDeleted flag
    await this.getCollection().updateOne(
      { userId },
      { $set: { isDeleted: true, isActive: false, updatedAt: new Date() } }
    );
  }

  async findAll(): Promise<UserData[]> {
    const results = await this.getCollection()
      .find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .toArray();
    return results as unknown as UserData[];
  }

  async findAllPaginated(options: {
    page?: number;
    limit?: number;
    role?: UserRole;
    isActive?: boolean;
    search?: string;
  } = {}): Promise<{
    users: UserData[];
    totalCount: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, role, isActive, search } = options;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter: any = { isDeleted: { $ne: true } };
    
    if (role !== undefined) {
      filter.role = role;
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive;
    }
    
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { firstName: { $regex: safeSearch, $options: 'i' } },
        { lastName: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { title: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const totalCount = await this.getCollection().countDocuments(filter);
    
    // Get paginated results
    const results = await this.getCollection()
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalPages = Math.ceil(totalCount / limit);

    return {
      users: results as unknown as UserData[],
      totalCount,
      page,
      totalPages
    };
  }

  // =======================
  // AUTHENTICATION METHODS
  // =======================

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.getCollection().updateOne(
      { userId },
      { $set: { passwordHash, updatedAt: new Date() } }
    );
  }

  // =======================
  // REFRESH SESSIONS
  // =======================
  // Each signed-in browser/device has its own refresh session, so signing in
  // on one device doesn't sign out another. Only SHA-256 hashes are stored.

  private getSessionCollection(): Collection<UserData> {
    return this.getCollection() as unknown as Collection<UserData>;
  }

  async addRefreshSession(userId: string, refreshToken: string, expiresAt: Date): Promise<void> {
    const now = new Date();
    await this.getSessionCollection().updateOne(
      { userId },
      { $pull: { refreshSessions: { expiresAt: { $lt: now } } } }
    );
    await this.getSessionCollection().updateOne(
      { userId },
      {
        $push: {
          refreshSessions: {
            $each: [{ tokenHash: hashRefreshToken(refreshToken), createdAt: now, expiresAt }],
            $slice: -MAX_REFRESH_SESSIONS,
          },
        },
        $set: { updatedAt: now },
      }
    );
  }

  /**
   * Swap a presented refresh token for its replacement in one atomic update.
   * Returns false if the old token is not a current session (already rotated,
   * revoked or unknown), so a reused token can't mint new sessions.
   */
  async rotateRefreshSession(
    userId: string,
    oldRefreshToken: string,
    newRefreshToken: string,
    expiresAt: Date
  ): Promise<boolean> {
    const now = new Date();
    const result = await this.getSessionCollection().updateOne(
      { userId, 'refreshSessions.tokenHash': hashRefreshToken(oldRefreshToken) },
      {
        $set: {
          'refreshSessions.$': { tokenHash: hashRefreshToken(newRefreshToken), createdAt: now, expiresAt },
          updatedAt: now,
        },
      }
    );
    if (result.modifiedCount === 1) {
      return true;
    }

    // Sessions from before refreshSessions existed kept one raw token
    const legacy = await this.getSessionCollection().updateOne(
      { userId, refreshToken: oldRefreshToken },
      { $unset: { refreshToken: '' } }
    );
    if (legacy.modifiedCount !== 1) {
      return false;
    }
    await this.addRefreshSession(userId, newRefreshToken, expiresAt);
    return true;
  }

  async removeRefreshSession(userId: string, refreshToken: string): Promise<void> {
    await this.getSessionCollection().updateOne(
      { userId },
      {
        $pull: { refreshSessions: { tokenHash: hashRefreshToken(refreshToken) } },
        $set: { updatedAt: new Date() },
      }
    );
    await this.getSessionCollection().updateOne(
      { userId, refreshToken },
      { $unset: { refreshToken: '' } }
    );
  }

  async clearRefreshSessions(userId: string): Promise<void> {
    await this.getSessionCollection().updateOne(
      { userId },
      { $set: { refreshSessions: [], updatedAt: new Date() }, $unset: { refreshToken: '' } }
    );
  }

  async clearLegacyRefreshToken(userId: string): Promise<void> {
    await this.getSessionCollection().updateOne({ userId }, { $unset: { refreshToken: '' } });
  }

  /**
   * Drop expired sessions from every user. Returns the number of users changed.
   */
  async pruneExpiredRefreshSessions(): Promise<number> {
    const now = new Date();
    const result = await this.getSessionCollection().updateMany(
      { 'refreshSessions.expiresAt': { $lt: now } },
      { $pull: { refreshSessions: { expiresAt: { $lt: now } } } }
    );
    return result.modifiedCount;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.getSessionCollection().updateOne(
      { userId },
      { $set: { lastLogin: new Date(), updatedAt: new Date() } }
    );
  }

  async setPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.getSessionCollection().updateOne(
      { userId },
      { 
        $set: { 
          passwordResetToken: token,
          passwordResetExpires: expiresAt,
          updatedAt: new Date() 
        } 
      }
    );
  }

  async clearPasswordResetToken(userId: string): Promise<void> {
    await this.getSessionCollection().updateOne(
      { userId },
      { 
        $unset: { passwordResetToken: '', passwordResetExpires: '' },
        $set: { updatedAt: new Date() }
      }
    );
  }

  async findByPasswordResetToken(token: string): Promise<UserData | null> {
    const result = await this.getSessionCollection().findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
      isDeleted: { $ne: true }
    });
    return result as UserData | null;
  }

  // =======================
  // SECURITY MANAGEMENT METHODS
  // =======================

  async recordPasswordChange(userId: string, newPasswordHash: string, passwordHistory?: string[]): Promise<void> {
    const updateFields: any = {
      passwordHash: newPasswordHash,
      passwordChangedAt: new Date(),
      updatedAt: new Date()
    };

    if (passwordHistory) {
      updateFields.passwordHistory = passwordHistory;
    }

    await this.getSessionCollection().updateOne(
      { userId },
      { $set: updateFields }
    );
  }

  async incrementFailedLoginAttempts(userId: string): Promise<void> {
    await this.getSessionCollection().updateOne(
      { userId },
      { 
        $inc: { failedLoginAttempts: 1 },
        $set: { updatedAt: new Date() }
      }
    );
  }

  async lockAccount(userId: string, lockUntil: Date): Promise<void> {
    await this.getSessionCollection().updateOne(
      { userId },
      { 
        $set: { 
          accountLockedUntil: lockUntil,
          isActive: false,
          updatedAt: new Date()
        }
      }
    );
  }

  async unlockAccount(userId: string): Promise<void> {
    await this.getSessionCollection().updateOne(
      { userId },
      { 
        $set: { 
          isActive: true,
          failedLoginAttempts: 0,
          updatedAt: new Date()
        },
        $unset: { accountLockedUntil: '' }
      }
    );
  }

  async resetFailedLoginAttempts(userId: string): Promise<void> {
    await this.getSessionCollection().updateOne(
      { userId },
      { 
        $set: { 
          failedLoginAttempts: 0,
          updatedAt: new Date()
        },
        $unset: { accountLockedUntil: '' }
      }
    );
  }

  async findLockedAccounts(): Promise<UserData[]> {
    const now = new Date();
    const results = await this.getSessionCollection()
      .find({
        accountLockedUntil: { $exists: true, $gt: now },
        isDeleted: { $ne: true }
      })
      .toArray();
    return results as unknown as UserData[];
  }

  // =======================
  // ACCOUNT STATUS METHODS
  // =======================

  async activate(userId: string): Promise<void> {
    await this.getSessionCollection().updateOne(
      { userId },
      { $set: { isActive: true, updatedAt: new Date() } }
    );
  }

  async deactivate(userId: string): Promise<void> {
    await this.getSessionCollection().updateOne(
      { userId },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
  }

  async verify(userId: string): Promise<void> {
    await this.getSessionCollection().updateOne(
      { userId },
      { $set: { isVerified: true, updatedAt: new Date() } }
    );
  }

  // =======================
  // QUERY METHODS
  // =======================

  async findByRole(role: UserRole): Promise<UserData[]> {
    const results = await this.getSessionCollection()
      .find({ role, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .toArray();
    return results as unknown as UserData[];
  }

  async findActiveUsers(): Promise<UserData[]> {
    const results = await this.getSessionCollection()
      .find({ isActive: true, isDeleted: { $ne: true } })
      .sort({ lastLogin: -1 })
      .toArray();
    return results as unknown as UserData[];
  }

  async findInactiveUsers(): Promise<UserData[]> {
    const results = await this.getSessionCollection()
      .find({ isActive: false, isDeleted: { $ne: true } })
      .sort({ updatedAt: -1 })
      .toArray();
    return results as unknown as UserData[];
  }

  async findUnverifiedUsers(): Promise<UserData[]> {
    const results = await this.getSessionCollection()
      .find({ isVerified: false, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .toArray();
    return results as unknown as UserData[];
  }

  async countUsers(): Promise<number> {
    return await this.getSessionCollection().countDocuments({ isDeleted: { $ne: true } });
  }

  async countByRole(role: UserRole): Promise<number> {
    return await this.getSessionCollection().countDocuments({ 
      role, 
      isDeleted: { $ne: true } 
    });
  }

  // =======================
  // UTILITY METHODS
  // =======================

  async emailExists(email: string, excludeUserId?: string): Promise<boolean> {
    const query: any = { 
      email: email.toLowerCase(), 
      isDeleted: { $ne: true } 
    };
    
    if (excludeUserId) {
      query.userId = { $ne: excludeUserId };
    }

    const count = await this.getSessionCollection().countDocuments(query);
    return count > 0;
  }

  async getUserWithRefreshToken(refreshToken: string): Promise<UserData | null> {
    const result = await this.getCollection().findOne({
      $or: [{ 'refreshSessions.tokenHash': hashRefreshToken(refreshToken) }, { refreshToken }],
      isActive: true,
      isDeleted: { $ne: true }
    });
    return result as UserData | null;
  }
}
