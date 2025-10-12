// =======================
// TOKEN BLACKLIST REPOSITORY
// =======================
// Purpose: Manage JWT token blacklist for logout functionality
// Related: AuthMiddleware, logout endpoint
// =======================

import { Db, Collection } from 'mongodb';

export interface BlacklistedToken {
  token: string;
  userId: string;
  blacklistedAt: Date;
  expiresAt: Date;
}

export class TokenBlacklistRepository {
  private db: Db;
  private collection: Collection<BlacklistedToken>;

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection('token_blacklist');
    this.ensureIndexes();
  }

  // Create indexes for performance
  private async ensureIndexes(): Promise<void> {
    try {
      // Index for token lookup (most common query)
      await this.collection.createIndex({ token: 1 }, { unique: true });
      
      // Index for user-based queries
      await this.collection.createIndex({ userId: 1 });
      
      // TTL index for automatic cleanup of expired tokens
      await this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      
      console.log('Token blacklist indexes created successfully');
    } catch (error) {
      console.error('Failed to create token blacklist indexes:', error);
    }
  }

  // Add token to blacklist
  async blacklistToken(token: string, userId: string, expiresAt: Date): Promise<void> {
    const blacklistedToken: BlacklistedToken = {
      token,
      userId,
      blacklistedAt: new Date(),
      expiresAt
    };

    try {
      await this.collection.insertOne(blacklistedToken);
    } catch (error) {
      // Handle duplicate token error (token already blacklisted)
      if ((error as any).code === 11000) {
        console.warn(`Token already blacklisted: ${token.substring(0, 20)}...`);
        return;
      }
      throw error;
    }
  }

  // Check if token is blacklisted
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await this.collection.findOne({ token });
    return result !== null;
  }

  // Blacklist all tokens for a user (useful for "logout from all devices")
  async blacklistAllUserTokens(userId: string, expiresAt: Date): Promise<number> {
    // This is a placeholder - in a real implementation, we'd need to track active tokens
    // For now, we'll create a special entry that blocks all tokens for this user
    const userBlacklistEntry: BlacklistedToken = {
      token: `USER_ALL_TOKENS_${userId}`,
      userId,
      blacklistedAt: new Date(),
      expiresAt
    };

    await this.collection.insertOne(userBlacklistEntry);
    return 1; // Return number of tokens blacklisted
  }

  // Check if all user tokens are blacklisted
  async areAllUserTokensBlacklisted(userId: string): Promise<boolean> {
    const result = await this.collection.findOne({ 
      token: `USER_ALL_TOKENS_${userId}` 
    });
    return result !== null;
  }

  // Get blacklisted tokens for a user (for admin purposes)
  async getUserBlacklistedTokens(userId: string): Promise<BlacklistedToken[]> {
    const results = await this.collection
      .find({ userId })
      .sort({ blacklistedAt: -1 })
      .toArray();
    return results;
  }

  // Cleanup expired tokens (manual cleanup if TTL index isn't working)
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.collection.deleteMany({
      expiresAt: { $lte: new Date() }
    });
    return result.deletedCount;
  }

  // Get blacklist statistics (for monitoring)
  async getBlacklistStats(): Promise<{
    totalBlacklisted: number;
    expiredTokens: number;
    activeBlacklisted: number;
  }> {
    const now = new Date();
    
    const [total, expired] = await Promise.all([
      this.collection.countDocuments({}),
      this.collection.countDocuments({ expiresAt: { $lte: now } })
    ]);

    return {
      totalBlacklisted: total,
      expiredTokens: expired,
      activeBlacklisted: total - expired
    };
  }
}