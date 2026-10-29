// =======================
// AUTHENTICATION MIDDLEWARE
// =======================
// Purpose: JWT authentication and user context for protected routes
// Related: UserService, User model
// =======================

import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '../../repositories/UserRepository';
import { UserService } from '../../services/UserService';
import { TokenBlacklistRepository } from '../../repositories/TokenBlacklistRepository';
import { connectDB } from '../../mongo_db';
import { User, UserRole } from '../../Models/User';
import { PasswordUtils } from './passwordUtils';

// Extend Request type to include user context
export interface AuthenticatedRequest extends Request {
  user?: User;
  userId?: string;
}

export class AuthMiddleware {
  private static userService: UserService | null = null;
  private static tokenBlacklistRepository: TokenBlacklistRepository | null = null;

  // Initialize service (called once at startup)
  static async initialize(): Promise<void> {
    const db = await connectDB();
    const userRepository = new UserRepository(db);
    this.tokenBlacklistRepository = new TokenBlacklistRepository(db);
    this.userService = new UserService(userRepository);
  }

  // Extract a Bearer token from the Authorization header
  static extractBearerToken(req: Request): string | undefined {
    const header = req.header('Authorization');
    if (!header || !header.startsWith('Bearer ')) return undefined;
    const token = header.slice('Bearer '.length).trim();
    return token || undefined;
  }

  // Verify an access token and load its active user (shared with WebSocket auth)
  static resolveUserFromToken = async (token: string): Promise<User | null> => {
    if (!this.userService || !this.tokenBlacklistRepository) {
      await this.initialize();
    }

    const decoded = PasswordUtils.verifyAccessToken(token);
    if (!decoded) return null;

    const isBlacklisted = await this.tokenBlacklistRepository!.isTokenBlacklisted(token);
    if (isBlacklisted) return null;

    const user = await this.userService!.getUserProfile(decoded.userId);
    if (!user || !user.isActive || user.isDeleted) return null;

    return user;
  };

  // Authenticate JWT token and attach user to request
  static authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    // Already authenticated by a router-level middleware earlier in the chain
    if (req.user) {
      next();
      return;
    }

    try {
      const token = this.extractBearerToken(req);

      if (!token) {
        res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
        return;
      }

      const user = await this.resolveUserFromToken(token);
      if (!user) {
        res.status(401).json({ success: false, message: 'Invalid or expired token.' });
        return;
      }

      req.user = user;
      req.userId = user.userId;
      next();
    } catch (error) {
      res.status(401).json({ success: false, message: 'Invalid token.' });
    }
  };

  // Require one of several roles (exact match, not hierarchy)
  static requireAnyRole = (...roles: UserRole[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Authentication required.' });
        return;
      }

      if (!roles.includes(req.user.role)) {
        res.status(403).json({ success: false, message: 'Insufficient permissions.' });
        return;
      }

      next();
    };
  };

  // Blacklist a token (for logout)
  static blacklistToken = async (token: string, userId: string, expiresAt: Date): Promise<void> => {
    await this.tokenBlacklistRepository!.blacklistToken(token, userId, expiresAt);
  };

  // Check if user has required role
  static requireRole = (requiredRole: UserRole) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Authentication required.' });
        return;
      }

      if (!req.user.hasPermission(requiredRole)) {
        res.status(403).json({ success: false, message: 'Insufficient permissions.' });
        return;
      }

      next();
    };
  };

  // Check if user can access resource (self or admin)
  static requireOwnershipOrAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const targetUserId = req.params.userId;
    const isOwner = req.user.userId === targetUserId;
    const isAdmin = req.user.isAdmin();

    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, message: 'Access denied. Can only access own resources or admin required.' });
      return;
    }

    next();
  };

  // Require admin access
  static requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!req.user.isAdmin()) {
      res.status(403).json({ success: false, message: 'Admin access required.' });
      return;
    }

    next();
  };
}