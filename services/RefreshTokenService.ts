// =======================
// REFRESH TOKEN SERVICE
// =======================
// Purpose: Manage refresh token lifecycle, validation, rotation, and cleanup
// Related: UserRepository, PasswordUtils, AuditLogService
// =======================

import { UserRepository } from '../repositories/UserRepository';
import { AuditLogService } from './AuditLogService';
import { AuditEventType } from '../repositories/AuditLogRepository';
import { PasswordUtils } from '../routes/middleware/passwordUtils';
import { TokenBlacklistRepository } from '../repositories/TokenBlacklistRepository';
import { TokenPair, RefreshTokenValidation, SessionInfo, AuditContext } from './types/AuthenticationTypes';

export class RefreshTokenService {
  private userRepository: UserRepository;
  private auditLogService: AuditLogService;
  private tokenBlacklistRepository: TokenBlacklistRepository;

  constructor(
    userRepository: UserRepository,
    auditLogService: AuditLogService,
    tokenBlacklistRepository: TokenBlacklistRepository
  ) {
    this.userRepository = userRepository;
    this.auditLogService = auditLogService;
    this.tokenBlacklistRepository = tokenBlacklistRepository;
  }

  /**
   * Generate a new token pair (access + refresh tokens)
   */
  async generateTokenPair(userId: string, sessionContext?: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<TokenPair> {
    try {
      // Generate new tokens
      const accessToken = PasswordUtils.generateAccessToken(userId);
      const refreshToken = PasswordUtils.generateRefreshToken(userId);

      // Calculate expiry dates
      const accessTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Store refresh token in database
      await this.userRepository.updateRefreshToken(userId, refreshToken);

      // Log token generation
      await this.auditLogService.logSecurityEvent(
        AuditEventType.TOKEN_REFRESH,
        {
          ipAddress: sessionContext?.ipAddress || 'unknown',
          userAgent: sessionContext?.userAgent || 'unknown',
          userId
        },
        {
          action: 'Token pair generated',
          metadata: {
            accessTokenExpiry: accessTokenExpiry.toISOString(),
            refreshTokenExpiry: refreshTokenExpiry.toISOString(),
            generatedAt: new Date().toISOString()
          }
        },
        true // success
      );

      console.log(`Token pair generated for user ${userId}`);

      return {
        accessToken,
        refreshToken,
        accessTokenExpiry,
        refreshTokenExpiry
      };
    } catch (error) {
      console.error('Failed to generate token pair:', error);
      throw new Error('Failed to generate authentication tokens');
    }
  }

  /**
   * Validate refresh token
   */
  async validateRefreshToken(refreshToken: string): Promise<RefreshTokenValidation> {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await this.tokenBlacklistRepository.isTokenBlacklisted(refreshToken);
      if (isBlacklisted) {
        return {
          isValid: false,
          reason: 'Token has been revoked'
        };
      }

      // Verify JWT signature and structure
      const decoded = PasswordUtils.verifyRefreshToken(refreshToken);
      if (!decoded) {
        return {
          isValid: false,
          reason: 'Invalid or expired token'
        };
      }

      // Check if user exists and token matches stored token
      const userData = await this.userRepository.getUserWithRefreshToken(refreshToken);
      if (!userData) {
        return {
          isValid: false,
          reason: 'Token not found or user does not exist'
        };
      }

      // Check if user account is active
      if (!userData.isActive || userData.isDeleted) {
        return {
          isValid: false,
          reason: 'User account is inactive'
        };
      }

      return {
        isValid: true,
        userId: decoded.userId,
        tokenId: decoded.jti
      };
    } catch (error) {
      console.error('Error validating refresh token:', error);
      return {
        isValid: false,
        reason: 'Token validation failed'
      };
    }
  }

  /**
   * Refresh access token using refresh token (with rotation)
   */
  async refreshAccessToken(refreshToken: string, sessionContext?: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<TokenPair | null> {
    try {
      // Validate the refresh token
      const validation = await this.validateRefreshToken(refreshToken);
      if (!validation.isValid || !validation.userId) {
        console.warn('Refresh token validation failed:', validation.reason);
        
        // Log failed refresh attempt
        await this.auditLogService.logSecurityEvent(
          AuditEventType.FAILED_LOGIN_ATTEMPT, // Use existing event type
          {
            ipAddress: sessionContext?.ipAddress || 'unknown',
            userAgent: sessionContext?.userAgent || 'unknown',
            userId: validation.userId || 'unknown'
          },
          {
            action: 'Token refresh failed',
            error: validation.reason,
            metadata: {
              tokenPreview: refreshToken.substring(0, 20) + '...'
            }
          },
          false // failure
        );
        
        return null;
      }

      // Blacklist the old refresh token (rotation)
      const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await this.tokenBlacklistRepository.blacklistToken(refreshToken, validation.userId, refreshTokenExpiry);

      // Generate new token pair
      const newTokenPair = await this.generateTokenPair(validation.userId, sessionContext);

      // Log successful token refresh
      await this.auditLogService.logSecurityEvent(
        AuditEventType.TOKEN_REFRESH,
        {
          ipAddress: sessionContext?.ipAddress || 'unknown',
          userAgent: sessionContext?.userAgent || 'unknown',
          userId: validation.userId
        },
        {
          action: 'Access token refreshed',
          metadata: {
            oldTokenId: validation.tokenId,
            newAccessTokenExpiry: newTokenPair.accessTokenExpiry.toISOString(),
            refreshedAt: new Date().toISOString()
          }
        },
        true // success
      );

      console.log(`Access token refreshed for user ${validation.userId}`);
      return newTokenPair;
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      
      // Log the error
      await this.auditLogService?.logSecurityEvent(
        AuditEventType.FAILED_LOGIN_ATTEMPT, // Use existing event type
        {
          ipAddress: sessionContext?.ipAddress || 'unknown',
          userAgent: sessionContext?.userAgent || 'unknown',
          userId: 'unknown'
        },
        {
          action: 'Token refresh system error',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        false // failure
      ).catch(console.error);
      
      return null;
    }
  }

  /**
   * Revoke refresh token (logout)
   */
  async revokeRefreshToken(refreshToken: string, reason: string = 'User logout'): Promise<boolean> {
    try {
      const validation = await this.validateRefreshToken(refreshToken);
      
      // Blacklist the token
      const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await this.tokenBlacklistRepository.blacklistToken(refreshToken, validation.userId || 'unknown', tokenExpiry);

      // Clear from user record if valid
      if (validation.isValid && validation.userId) {
        await this.userRepository.updateRefreshToken(validation.userId, undefined);
        
        // Log token revocation
        await this.auditLogService.logAuthenticationEvent(
          AuditEventType.LOGOUT,
          {
            ipAddress: 'unknown',
            userAgent: 'unknown',
            userId: validation.userId
          },
          {
            action: 'Refresh token revoked',
            metadata: {
              reason,
              tokenId: validation.tokenId,
              revokedAt: new Date().toISOString()
            }
          }
        );
      }

      console.log(`Refresh token revoked: ${reason}`);
      return true;
    } catch (error) {
      console.error('Failed to revoke refresh token:', error);
      return false;
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string, reason: string = 'Security action'): Promise<void> {
    try {
      // Get user's current refresh token
      const userData = await this.userRepository.findById(userId);
      if (userData && userData.refreshToken) {
        const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await this.tokenBlacklistRepository.blacklistToken(userData.refreshToken, userId, tokenExpiry);
      }

      // Clear refresh token from user record
      await this.userRepository.updateRefreshToken(userId, undefined);

      // Log security action
      await this.auditLogService.logSecurityEvent(
        AuditEventType.USER_UPDATED, // Use existing event type
        {
          ipAddress: 'system',
          userAgent: 'RefreshTokenService',
          userId
        },
        {
          action: 'All refresh tokens revoked',
          resource: 'refresh_tokens',
          metadata: { reason }
        },
        true // success
      );

      console.log(`All refresh tokens revoked for user ${userId}: ${reason}`);
    } catch (error) {
      console.error('Failed to revoke all user tokens:', error);
      throw error;
    }
  }

  /**
   * Get session information for a refresh token
   */
  async getSessionInfo(refreshToken: string): Promise<SessionInfo | null> {
    try {
      const validation = await this.validateRefreshToken(refreshToken);
      if (!validation.isValid || !validation.userId) {
        return null;
      }

      const decoded = PasswordUtils.verifyRefreshToken(refreshToken);
      if (!decoded) {
        return null;
      }

      return {
        userId: validation.userId,
        tokenId: validation.tokenId!,
        createdAt: new Date(decoded.iat * 1000),
        lastUsed: new Date(), // Current time as last used
        ipAddress: undefined, // Would need to be stored separately
        userAgent: undefined  // Would need to be stored separately
      };
    } catch (error) {
      console.error('Failed to get session info:', error);
      return null;
    }
  }

  /**
   * Cleanup expired refresh tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      let cleanedCount = 0;

      // Get all users with refresh tokens
      const users = await this.userRepository.findAll();
      
      for (const user of users) {
        if (user.refreshToken) {
          const validation = await this.validateRefreshToken(user.refreshToken);
          
          // If token is invalid (expired or corrupted), clean it up
          if (!validation.isValid) {
            await this.userRepository.updateRefreshToken(user.userId, undefined);
            cleanedCount++;
          }
        }
      }

      // Also cleanup blacklisted tokens (this is handled by TokenBlacklistRepository TTL)
      const blacklistCleanedCount = await this.tokenBlacklistRepository.cleanupExpiredTokens();

      const totalCleaned = cleanedCount + blacklistCleanedCount;
      
      if (totalCleaned > 0) {
        console.log(`Cleaned up ${totalCleaned} expired tokens (${cleanedCount} user tokens, ${blacklistCleanedCount} blacklisted tokens)`);
      }

      return totalCleaned;
    } catch (error) {
      console.error('Failed to cleanup expired tokens:', error);
      return 0;
    }
  }

  /**
   * Get token expiry information
   */
  static getTokenExpiryInfo(): {
    accessTokenDuration: string;
    refreshTokenDuration: string;
    accessTokenMinutes: number;
    refreshTokenDays: number;
  } {
    return {
      accessTokenDuration: '30 minutes',
      refreshTokenDuration: '7 days',
      accessTokenMinutes: 30,
      refreshTokenDays: 7
    };
  }
}