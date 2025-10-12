/**
 * Token Cleanup Service
 * 
 * Handles periodic cleanup of expired tokens and maintenance tasks
 * for the authentication system.
 */

import { RefreshTokenService } from './RefreshTokenService';
import { TokenBlacklistRepository, BlacklistedToken } from '../repositories/TokenBlacklistRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AuditLogService } from './AuditLogService';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { connectDB } from '../mongo_db';
import { CleanupResults, CleanupServiceStatus } from './types/AuthenticationTypes';

export class TokenCleanupService {
  private static cleanupIntervalId: NodeJS.Timeout | null = null;
  private static readonly CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly BLACKLIST_RETENTION_DAYS = 7; // Keep blacklisted tokens for 7 days after expiry

  /**
   * Start the automatic token cleanup service
   */
  static startCleanupService(): void {
    if (this.cleanupIntervalId) {
      console.log('Token cleanup service is already running');
      return;
    }

    console.log('Starting token cleanup service...');
    
    // Run cleanup immediately on startup
    this.performCleanup().catch(error => {
      console.error('Initial token cleanup failed:', error);
    });

    // Schedule periodic cleanup
    this.cleanupIntervalId = setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        console.error('Scheduled token cleanup failed:', error);
      }
    }, this.CLEANUP_INTERVAL_MS);

    console.log(`Token cleanup service started - will run every ${this.CLEANUP_INTERVAL_MS / (60 * 60 * 1000)} hours`);
  }

  /**
   * Stop the automatic token cleanup service
   */
  static stopCleanupService(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      console.log('Token cleanup service stopped');
    }
  }

  /**
   * Perform a manual cleanup of expired tokens
   */
  static async performCleanup(): Promise<CleanupResults> {
    console.log('Starting token cleanup process...');
    
    const startTime = Date.now();
    let refreshTokensRemoved = 0;
    let blacklistedTokensRemoved = 0;

    try {
      // Initialize database connection and repositories
      const db = await connectDB();
      const userRepository = new UserRepository(db);
      const auditLogRepository = new AuditLogRepository(db);
      const tokenBlacklistRepository = new TokenBlacklistRepository(db);
      const auditLogService = new AuditLogService(auditLogRepository);
      
      const refreshTokenService = new RefreshTokenService(
        userRepository,
        auditLogService,
        tokenBlacklistRepository
      );

      // Clean up expired refresh tokens from user documents
      refreshTokensRemoved = await refreshTokenService.cleanupExpiredTokens();
      
      // Clean up old blacklisted tokens (keep them for a retention period after expiry)
      blacklistedTokensRemoved = await this.cleanupExpiredBlacklistedTokens(tokenBlacklistRepository);

      const duration = Date.now() - startTime;
      console.log(`Token cleanup completed in ${duration}ms:`, {
        refreshTokensRemoved,
        blacklistedTokensRemoved,
        totalRemoved: refreshTokensRemoved + blacklistedTokensRemoved
      });

      return { refreshTokensRemoved, blacklistedTokensRemoved };
    } catch (error) {
      console.error('Token cleanup process failed:', error);
      throw error;
    }
  }

  /**
   * Clean up expired blacklisted tokens that are past their retention period
   */
  private static async cleanupExpiredBlacklistedTokens(tokenBlacklistRepository: TokenBlacklistRepository): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.BLACKLIST_RETENTION_DAYS);

      // Get all blacklisted tokens that expired before the cutoff date
      const expiredTokens = await tokenBlacklistRepository.findExpiredTokens(cutoffDate);
      
      if (expiredTokens.length === 0) {
        return 0;
      }

      // Remove expired tokens from blacklist
      const tokenIds = expiredTokens.map((token: BlacklistedToken) => token._id);
      await tokenBlacklistRepository.removeExpiredTokens(tokenIds);

      console.log(`Removed ${expiredTokens.length} expired blacklisted tokens older than ${this.BLACKLIST_RETENTION_DAYS} days`);
      return expiredTokens.length;
    } catch (error) {
      console.error('Failed to cleanup expired blacklisted tokens:', error);
      throw error;
    }
  }

  /**
   * Get cleanup service status and statistics
   */
  static getServiceStatus(): CleanupServiceStatus {
    const isRunning = this.cleanupIntervalId !== null;
    const status = {
      isRunning,
      cleanupInterval: this.CLEANUP_INTERVAL_MS,
      retentionDays: this.BLACKLIST_RETENTION_DAYS
    };

    if (isRunning) {
      // Calculate approximate next cleanup time
      const nextCleanup = new Date(Date.now() + this.CLEANUP_INTERVAL_MS);
      return { ...status, nextCleanup };
    }

    return status;
  }

  /**
   * Force immediate cleanup (useful for testing or manual maintenance)
   */
  static async forceCleanup(): Promise<CleanupResults> {
    console.log('Force cleanup requested...');
    return await this.performCleanup();
  }
}

// Auto-start cleanup service in production
if (process.env.NODE_ENV === 'production') {
  TokenCleanupService.startCleanupService();
}