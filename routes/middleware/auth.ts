// =======================
// AUTHENTICATION MIDDLEWARE
// =======================
// Purpose: JWT authentication and user context for protected routes
// Related: UserService, User model
// =======================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../../repositories/UserRepository';
import { UserService } from '../../services/UserService';
import { TokenBlacklistRepository } from '../../repositories/TokenBlacklistRepository';
import { connectDB } from '../../mongo_db';
import { User, UserRole } from '../../Models/User';

// Extend Request type to include user context
export interface AuthenticatedRequest extends Request {
  user?: User;
  userId?: string;
}

// JWT secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';

// Security warning for default JWT secret
if (!process.env.JWT_SECRET || JWT_SECRET === 'your-jwt-secret-change-in-production') {
  console.warn('SECURITY WARNING: Using default JWT secret! Set JWT_SECRET environment variable in production.');
  console.warn('   Generate a secure secret: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
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

  // Authenticate JWT token and attach user to request
  static authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
        return;
      }

      // Check if token is blacklisted
      const isBlacklisted = await this.tokenBlacklistRepository!.isTokenBlacklisted(token);
      if (isBlacklisted) {
        res.status(401).json({ success: false, message: 'Token has been revoked.' });
        return;
      }

      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await this.userService!.getUserProfile(decoded.userId);
      
      if (!user || !user.isActive || user.isDeleted) {
        res.status(401).json({ success: false, message: 'Invalid or inactive user.' });
        return;
      }

      req.user = user;
      req.userId = user.userId;
      next();
    } catch (error) {
      res.status(401).json({ success: false, message: 'Invalid token.' });
    }
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