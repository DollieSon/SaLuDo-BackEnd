import { Db } from 'mongodb';
import { BaseRepository } from './BaseRepository';
import { UserData, CreateUserData, UpdateUserData, UserRole, User } from '../Models/User';

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
      email: data.email,
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
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
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

  async updateRefreshToken(userId: string, refreshToken: string | undefined): Promise<void> {
    await this.getCollection().updateOne(
      { userId },
      { $set: { refreshToken, updatedAt: new Date() } }
    );
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.getCollection().updateOne(
      { userId },
      { $set: { lastLogin: new Date(), updatedAt: new Date() } }
    );
  }

  async setPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.getCollection().updateOne(
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
    await this.getCollection().updateOne(
      { userId },
      { 
        $unset: { passwordResetToken: '', passwordResetExpires: '' },
        $set: { updatedAt: new Date() }
      }
    );
  }

  async findByPasswordResetToken(token: string): Promise<UserData | null> {
    const result = await this.getCollection().findOne({
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

    await this.getCollection().updateOne(
      { userId },
      { $set: updateFields }
    );
  }

  async incrementFailedLoginAttempts(userId: string): Promise<void> {
    await this.getCollection().updateOne(
      { userId },
      { 
        $inc: { failedLoginAttempts: 1 },
        $set: { updatedAt: new Date() }
      }
    );
  }

  async lockAccount(userId: string, lockUntil: Date): Promise<void> {
    await this.getCollection().updateOne(
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
    await this.getCollection().updateOne(
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
    await this.getCollection().updateOne(
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
    const results = await this.getCollection()
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
    await this.getCollection().updateOne(
      { userId },
      { $set: { isActive: true, updatedAt: new Date() } }
    );
  }

  async deactivate(userId: string): Promise<void> {
    await this.getCollection().updateOne(
      { userId },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
  }

  async verify(userId: string): Promise<void> {
    await this.getCollection().updateOne(
      { userId },
      { $set: { isVerified: true, updatedAt: new Date() } }
    );
  }

  // =======================
  // QUERY METHODS
  // =======================

  async findByRole(role: UserRole): Promise<UserData[]> {
    const results = await this.getCollection()
      .find({ role, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .toArray();
    return results as unknown as UserData[];
  }

  async findActiveUsers(): Promise<UserData[]> {
    const results = await this.getCollection()
      .find({ isActive: true, isDeleted: { $ne: true } })
      .sort({ lastLogin: -1 })
      .toArray();
    return results as unknown as UserData[];
  }

  async findInactiveUsers(): Promise<UserData[]> {
    const results = await this.getCollection()
      .find({ isActive: false, isDeleted: { $ne: true } })
      .sort({ updatedAt: -1 })
      .toArray();
    return results as unknown as UserData[];
  }

  async findUnverifiedUsers(): Promise<UserData[]> {
    const results = await this.getCollection()
      .find({ isVerified: false, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .toArray();
    return results as unknown as UserData[];
  }

  async countUsers(): Promise<number> {
    return await this.getCollection().countDocuments({ isDeleted: { $ne: true } });
  }

  async countByRole(role: UserRole): Promise<number> {
    return await this.getCollection().countDocuments({ 
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

    const count = await this.getCollection().countDocuments(query);
    return count > 0;
  }

  async getUserWithRefreshToken(refreshToken: string): Promise<UserData | null> {
    const result = await this.getCollection().findOne({
      refreshToken,
      isActive: true,
      isDeleted: { $ne: true }
    });
    return result as UserData | null;
  }
}
