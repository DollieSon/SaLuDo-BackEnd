// =======================
// AUTHENTICATION TYPES
// =======================
// Purpose: Common interfaces and types for authentication and session management
// Related: RefreshTokenService, AuditLogService, TokenCleanupService
// =======================

import { UserRole } from '../../Models/User';
import { AuditEventType, AuditSeverity } from '../../repositories/AuditLogRepository';

/**
 * Token pair containing access and refresh tokens with expiry information
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: Date;
  refreshTokenExpiry: Date;
}

/**
 * Result of refresh token validation
 */
export interface RefreshTokenValidation {
  isValid: boolean;
  userId?: string;
  tokenId?: string;
  reason?: string;
}

/**
 * Session information for tracking user sessions
 */
export interface SessionInfo {
  userId: string;
  tokenId: string;
  createdAt: Date;
  lastUsed: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit context for tracking user actions and security events
 */
export interface AuditContext {
  userId?: string;
  userEmail?: string;
  userRole?: UserRole;
  sessionId?: string;
  ipAddress: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Security alert for suspicious activity detection
 */
export interface SecurityAlert {
  id: string;
  type: AuditEventType;
  severity: AuditSeverity;
  message: string;
  timestamp: Date;
  userId?: string;
  ipAddress: string;
  details: any;
}

/**
 * Token cleanup service results
 */
export interface CleanupResults {
  refreshTokensRemoved: number;
  blacklistedTokensRemoved: number;
}

/**
 * Token cleanup service status
 */
export interface CleanupServiceStatus {
  isRunning: boolean;
  cleanupInterval: number;
  retentionDays: number;
  nextCleanup?: Date;
}