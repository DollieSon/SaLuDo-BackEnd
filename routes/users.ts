// =======================
// USER ROUTES
// =======================
// Purpose: User management endpoints - admin account creation, authentication, profile management
// Related: UserService, auth middleware, user validation
// =======================

import { Router, Request, Response } from "express";
import { UserService } from "../services/UserService";
import { UserRepository } from "../repositories/UserRepository";
import { AuditLogService } from "../services/AuditLogService";
import {
  AuditLogRepository,
  AuditEventType,
} from "../repositories/AuditLogRepository";
import { TokenBlacklistRepository } from "../repositories/TokenBlacklistRepository";
import { connectDB } from "../mongo_db";
import { asyncHandler, errorHandler } from "./middleware/errorHandler";
import { AuthMiddleware, AuthenticatedRequest } from "./middleware/auth";
import { UserValidation } from "./middleware/userValidation";
import { 
  OK, 
  CREATED, 
  BAD_REQUEST, 
  UNAUTHORIZED, 
  NOT_FOUND, 
  CONFLICT, 
  INTERNAL_SERVER_ERROR 
} from "../constants/HttpStatusCodes";
import { PasswordUtils } from "./middleware/passwordUtils";
import {
  authRateLimit,
  userOperationRateLimit,
  passwordChangeRateLimit,
  accountCreationRateLimit,
} from "./middleware/rateLimiter";
import { UserRole, User } from "../Models/User";
import multer from "multer";
import { validation } from "./middleware/validation";
import ProfileService from "../services/ProfileService";

const router = Router();
let userService: UserService;
let auditLogService: AuditLogService;

// Multer configuration for profile photo uploads
const photoUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Initialize services
const initializeService = async () => {
  const db = await connectDB();
  const userRepository = new UserRepository(db);
  const auditLogRepository = new AuditLogRepository(db);
  userService = new UserService(userRepository);
  auditLogService = new AuditLogService(auditLogRepository);
  await AuthMiddleware.initialize();
};

// Call initialization
initializeService().catch(console.error);

// ====================
// AUTHENTICATION ENDPOINTS
// ====================

// User login
router.post(
  "/auth/login",
  authRateLimit, // Apply strict rate limiting to login attempts
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(BAD_REQUEST).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    // Find user by email
    const db = await connectDB();
    const userRepository = new UserRepository(db);
    const userData = await userRepository.getUserByEmail(email);

    if (!userData) {
      res.status(UNAUTHORIZED).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const user = User.fromObject(userData);

    // Check if account is locked
    if (user.isAccountLocked()) {
      res.status(423).json({
        success: false,
        message: "Account is temporarily locked due to failed login attempts",
      });
      return;
    }

    // Check if account is active
    if (!user.isActive || user.isDeleted) {
      res.status(UNAUTHORIZED).json({
        success: false,
        message: "Account is inactive or deleted",
      });
      return;
    }

    // Verify password
    const isValidPassword = await PasswordUtils.verifyPassword(
      password,
      user.passwordHash
    );

    if (!isValidPassword) {
      // Increment failed login attempts
      user.incrementFailedLoginAttempts();
      await userRepository.updateUser(user.userId, {
        failedLoginAttempts: user.failedLoginAttempts,
        accountLockedUntil: user.accountLockedUntil,
        isActive: user.isActive,
      });

      // Log failed login attempt
      const auditContext = AuditLogService.createAuditContext(req, undefined);
      await auditLogService.logAuthenticationEvent(
        AuditEventType.LOGIN_FAILURE,
        { ...auditContext, userEmail: email, userId: user.userId },
        {
          action: "Failed login attempt",
          error: "Invalid password",
          metadata: {
            email,
            attemptedAt: new Date().toISOString(),
            failedAttempts: user.failedLoginAttempts,
          },
        }
      );

      res.status(UNAUTHORIZED).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    // Reset failed login attempts on successful login
    if (user.failedLoginAttempts > 0) {
      user.resetFailedLoginAttempts();
      await userRepository.updateUser(user.userId, {
        failedLoginAttempts: 0,
        accountLockedUntil: undefined,
      });
    }

    // Record login
    user.recordLogin();
    await userRepository.updateUser(user.userId, {
      lastLogin: user.lastLogin,
    });

    // Generate access and refresh tokens
    const accessToken = PasswordUtils.generateAccessToken(user.userId);
    const refreshToken = PasswordUtils.generateRefreshToken(user.userId);

    // Store refresh token in database
    await userRepository.updateRefreshToken(user.userId, refreshToken);

    // Calculate expiry times (must match JWT expiry in passwordUtils.ts)
    const accessTokenExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
    const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Log successful login
    const auditContext = AuditLogService.createAuditContext(req, user);
    await auditLogService.logAuthenticationEvent(
      AuditEventType.LOGIN_SUCCESS,
      auditContext,
      {
        action: "Successful login",
        metadata: {
          loginAt: new Date().toISOString(),
          resetFailedAttempts: user.failedLoginAttempts > 0,
          accessTokenExpiry: accessTokenExpiry.toISOString(),
          refreshTokenExpiry: refreshTokenExpiry.toISOString(),
        },
      }
    );

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: user.getProfile(),
        accessToken,
        refreshToken,
        accessTokenExpiry,
        refreshTokenExpiry,
        mustChangePassword: user.mustChangePassword,
        // Legacy field for backward compatibility
        token: accessToken,
      },
    });
  })
);

// Token refresh endpoint
router.post(
  "/auth/refresh",
  authRateLimit, // Apply rate limiting for security
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(BAD_REQUEST).json({
        success: false,
        message: "Refresh token is required",
      });
      return;
    }

    try {
      // Initialize RefreshTokenService
      const db = await connectDB();
      const userRepository = new UserRepository(db);
      const auditLogRepository = new AuditLogRepository(db);
      const tokenBlacklistRepository = new TokenBlacklistRepository(db);
      const auditLogService = new AuditLogService(auditLogRepository);
      const { RefreshTokenService } = await import(
        "../services/RefreshTokenService"
      );

      const refreshTokenService = new RefreshTokenService(
        userRepository,
        auditLogService,
        tokenBlacklistRepository
      );

      // Refresh the access token
      const sessionContext = {
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      };

      const newTokenPair = await refreshTokenService.refreshAccessToken(
        refreshToken,
        sessionContext
      );

      if (!newTokenPair) {
        res.status(UNAUTHORIZED).json({
          success: false,
          message: "Invalid or expired refresh token",
        });
        return;
      }

      res.json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          accessToken: newTokenPair.accessToken,
          refreshToken: newTokenPair.refreshToken,
          accessTokenExpiry: newTokenPair.accessTokenExpiry,
          refreshTokenExpiry: newTokenPair.refreshTokenExpiry,
        },
      });
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to refresh token",
      });
    }
  })
);

// ====================
// ADMIN-ONLY ENDPOINTS
// ====================

// Create new user (Admin only)
router.post(
  "/",
  accountCreationRateLimit, // Prevent excessive account creation
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.ADMIN),
  UserValidation.validateCreateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email, password, firstName, lastName, title, role, middleName } =
      req.body;

    // Hash password for storage using bcrypt
    const hashedPassword = await PasswordUtils.hashPassword(password);

    const newUser = await userService.createUserAsAdmin({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      title,
      role,
      middleName,
    });

    // Generate temporary token for immediate use (if needed)
    const token = PasswordUtils.generateToken(newUser.userId);

    res.status(CREATED).json({
      success: true,
      message:
        "User created successfully. Password change required on first login.",
      data: {
        userId: newUser.userId,
        email: newUser.email,
        fullName: newUser.getFullName(),
        role: newUser.role,
        mustChangePassword: newUser.mustChangePassword,
      },
    });
  })
);

// Reset user password (Admin only)
router.put(
  "/:userId/reset-password",
  passwordChangeRateLimit, // Apply password change rate limiting
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.ADMIN),
  UserValidation.validateUserId,
  UserValidation.validatePasswordReset,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    const hashedPassword = await PasswordUtils.hashPassword(newPassword);
    await userService.resetUserPassword(userId, hashedPassword);

    res.json({
      success: true,
      message:
        "Password reset successfully. User must change password on next login.",
    });
  })
);

// Get all users (Admin and HR Manager)
router.get(
  "/",
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.HR_MANAGER),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page = "1", limit = "10", role, isActive, search } = req.query;

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      role: role as UserRole,
      isActive:
        isActive === "true" ? true : isActive === "false" ? false : undefined,
      search: search as string,
    };

    // Validate pagination parameters
    if (options.page < 1) options.page = 1;
    if (options.limit < 1 || options.limit > 100) options.limit = 10;

    const result = await userService.getAllUsers(options);

    res.json({
      success: true,
      data: result.users.map((user) => user.getProfile()),
      pagination: {
        page: result.page,
        limit: options.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        hasNext: result.page < result.totalPages,
        hasPrev: result.page > 1,
      },
    });
  })
);

// ====================
// USER PROFILE ENDPOINTS
// ====================

// Get user profile (Self or Admin)
router.get(
  "/:userId",
  AuthMiddleware.authenticate,
  UserValidation.validateUserId,
  AuthMiddleware.requireOwnershipOrAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const user = await userService.getUserProfile(userId);

    if (!user) {
      res.status(NOT_FOUND).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.json({
      success: true,
      data: user.getProfile(),
    });
  })
);

// Update user profile (Self or Admin)
router.put(
  "/:userId/profile",
  userOperationRateLimit, // Rate limit profile updates
  AuthMiddleware.authenticate,
  UserValidation.validateUserId,
  UserValidation.validateUpdateProfile,
  AuthMiddleware.requireOwnershipOrAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { 
      email, firstName, lastName, middleName, title,
      phoneNumber, location, timezone, linkedInUrl, bio,
      availability, roleSpecificData
    } = req.body;

    // Check if user exists
    const existingUser = await userService.getUserProfile(userId);
    if (!existingUser) {
      res.status(NOT_FOUND).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Check email uniqueness if email is being changed
    if (email && email.toLowerCase() !== existingUser.email.toLowerCase()) {
      const db = await connectDB();
      const userRepository = new UserRepository(db);
      const emailExists = await userRepository.emailExists(email, userId);

      if (emailExists) {
        res.status(CONFLICT).json({
          success: false,
          message: "Email address is already in use",
        });
        return;
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (email) updateData.email = email.toLowerCase();
    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();
    if (middleName !== undefined) updateData.middleName = middleName?.trim();
    if (title) updateData.title = title.trim();
    
    // Extended profile fields
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (location !== undefined) updateData.location = location;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (linkedInUrl !== undefined) updateData.linkedInUrl = linkedInUrl;
    if (bio !== undefined) updateData.bio = validation.sanitizeText(bio); // Sanitize to prevent XSS
    if (availability !== undefined) updateData.availability = availability;
    if (roleSpecificData !== undefined) updateData.roleSpecificData = roleSpecificData;

    // Update user with audit trail
    const performedBy = req.user!;
    await userService.updateProfileWithAudit(userId, updateData, {
      performedBy: performedBy.userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Get updated user profile
    const updatedUser = await userService.getUserProfile(userId);

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser!.getProfile(),
    });
  })
);

// Upload profile photo
router.post(
  "/:userId/profile/photo",
  userOperationRateLimit, // Rate limit photo uploads
  AuthMiddleware.authenticate,
  UserValidation.validateUserId,
  AuthMiddleware.requireOwnershipOrAdmin,
  photoUpload.single('photo'),
  validation.validateProfilePhoto,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(BAD_REQUEST).json({
        success: false,
        message: "No photo file provided",
      });
      return;
    }

    // Check if user exists
    const user = await userService.getUserProfile(userId);
    if (!user) {
      res.status(NOT_FOUND).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Delete old photo if exists
    if (user.photoMetadata?.fileId) {
      try {
        await ProfileService.deleteProfilePhoto(user.photoMetadata.fileId);
      } catch (error) {
        console.warn('Failed to delete old profile photo:', error);
      }
    }

    // Upload new photo
    const photoMetadata = await ProfileService.uploadProfilePhoto(userId, file);

    // Update user with new photo metadata
    const db = await connectDB();
    const userRepository = new UserRepository(db);
    await userRepository.updateUser(userId, { photoMetadata });

    // Log the photo upload
    const performedBy = req.user!;
    await auditLogService.logUserManagementEvent(
      'USER_UPDATE' as AuditEventType,
      {
        userId: performedBy.userId,
        userEmail: performedBy.email,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      },
      userId,
      {
        action: 'profile_photo_uploaded',
        resource: 'photo',
        metadata: { fileId: photoMetadata.fileId }
      }
    );

    res.status(CREATED).json({
      success: true,
      message: "Profile photo uploaded successfully",
      data: photoMetadata,
    });
  })
);

// Get profile photo
router.get(
  "/:userId/profile/photo",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { thumbnail } = req.query;

    // Get user
    const db = await connectDB();
    const userRepository = new UserRepository(db);
    const userData = await userRepository.getUserById(userId);

    if (!userData || !userData.photoMetadata) {
      res.status(NOT_FOUND).json({
        success: false,
        message: "Profile photo not found",
      });
      return;
    }

    // Get photo from GridFS
    const fileId = thumbnail === 'true' && userData.photoMetadata.thumbnailFileId
      ? userData.photoMetadata.thumbnailFileId
      : userData.photoMetadata.fileId;

    const { stream, metadata } = await ProfileService.getProfilePhoto(fileId);

    // Set content type header
    res.set('Content-Type', metadata.contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

    // Pipe the stream to response
    stream.pipe(res);
  })
);

// Delete profile photo
router.delete(
  "/:userId/profile/photo",
  userOperationRateLimit,
  AuthMiddleware.authenticate,
  UserValidation.validateUserId,
  AuthMiddleware.requireOwnershipOrAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;

    // Check if user exists
    const user = await userService.getUserProfile(userId);
    if (!user) {
      res.status(NOT_FOUND).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (!user.photoMetadata?.fileId) {
      res.status(NOT_FOUND).json({
        success: false,
        message: "No profile photo to delete",
      });
      return;
    }

    // Delete photo from GridFS
    await ProfileService.deleteProfilePhoto(user.photoMetadata.fileId);

    // Update user to remove photo metadata
    const db = await connectDB();
    const userRepository = new UserRepository(db);
    await userRepository.updateUser(userId, { photoMetadata: undefined });

    // Log the photo deletion
    const performedBy = req.user!;
    await auditLogService.logUserManagementEvent(
      'USER_UPDATE' as AuditEventType,
      {
        userId: performedBy.userId,
        userEmail: performedBy.email,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      },
      userId,
      {
        action: 'profile_photo_deleted',
        resource: 'photo'
      }
    );

    res.json({
      success: true,
      message: "Profile photo deleted successfully",
    });
  })
);

// Get user profile stats
router.get(
  "/:userId/profile/stats",
  AuthMiddleware.authenticate,
  UserValidation.validateUserId,
  AuthMiddleware.requireOwnershipOrAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;

    // Check if user exists
    const user = await userService.getUserProfile(userId);
    if (!user) {
      res.status(NOT_FOUND).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Get stats
    const stats = await userService.getUserStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  })
);

// Get user profile activity
router.get(
  "/:userId/profile/activity",
  AuthMiddleware.authenticate,
  UserValidation.validateUserId,
  AuthMiddleware.requireOwnershipOrAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    // Check if user exists
    const user = await userService.getUserProfile(userId);
    if (!user) {
      res.status(NOT_FOUND).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Get activity
    const activity = await userService.getProfileActivity(userId, limit);

    res.json({
      success: true,
      data: activity,
      count: activity.length,
    });
  })
);

// ====================
// ADMIN MANAGEMENT ENDPOINTS
// ====================

// Set user active status (Admin only)
router.put(
  "/:userId/status",
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.ADMIN),
  UserValidation.validateUserId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      res.status(BAD_REQUEST).json({
        success: false,
        message: "isActive must be a boolean value",
      });
      return;
    }

    await userService.setUserActiveStatus(userId, isActive);

    res.json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
    });
  })
);

// Soft delete user (Admin only)
router.delete(
  "/:userId",
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.ADMIN),
  UserValidation.validateUserId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;

    // Prevent admin from deleting themselves
    if (req.user!.userId === userId) {
      res.status(BAD_REQUEST).json({
        success: false,
        message: "Cannot delete your own account",
      });
      return;
    }

    await userService.softDeleteUser(userId);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  })
);

// Logout (blacklist current token and revoke refresh tokens)
router.post(
  "/auth/logout",
  authRateLimit, // Prevent logout abuse
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    const { refreshToken, revokeAllSessions = false } = req.body;
    const userId = req.userId!;

    if (!token) {
      res.status(BAD_REQUEST).json({
        success: false,
        message: "No token provided",
      });
      return;
    }

    // Decode token to get expiration
    const jwt = require("jsonwebtoken");

    try {
      const decoded = jwt.decode(token) as { userId: string; exp: number };
      const expiresAt = new Date(decoded.exp * 1000); // Convert Unix timestamp to Date

      // Blacklist the access token
      await AuthMiddleware.blacklistToken(token, userId, expiresAt);

      // Handle refresh token revocation
      const auditContext = AuditLogService.createAuditContext(req, req.user);

      if (revokeAllSessions) {
        // Revoke all refresh tokens for this user (logout from all devices)
        const db = await connectDB();
        const userRepository = new UserRepository(db);
        const auditLogRepository = new AuditLogRepository(db);
        const tokenBlacklistRepository = new TokenBlacklistRepository(db);
        const auditLogService = new AuditLogService(auditLogRepository);
        const { RefreshTokenService } = await import(
          "../services/RefreshTokenService"
        );

        const refreshTokenService = new RefreshTokenService(
          userRepository,
          auditLogService,
          tokenBlacklistRepository
        );

        await refreshTokenService.revokeAllUserTokens(
          userId,
          "User logout from all devices"
        );
      } else if (refreshToken) {
        // Revoke the specific refresh token if provided
        try {
          const db = await connectDB();
          const userRepository = new UserRepository(db);
          const auditLogRepository = new AuditLogRepository(db);
          const tokenBlacklistRepository = new TokenBlacklistRepository(db);
          const auditLogService = new AuditLogService(auditLogRepository);
          const { RefreshTokenService } = await import(
            "../services/RefreshTokenService"
          );

          const refreshTokenService = new RefreshTokenService(
            userRepository,
            auditLogService,
            tokenBlacklistRepository
          );

          await refreshTokenService.revokeRefreshToken(
            refreshToken,
            "User logout"
          );
        } catch (refreshError) {
          // Don't fail logout if refresh token revocation fails
          console.warn(
            "Failed to revoke refresh token during logout:",
            refreshError
          );
        }
      }

      // Log logout event
      await auditLogService.logAuthenticationEvent(
        AuditEventType.LOGOUT,
        auditContext,
        {
          action: "User logout",
          metadata: {
            logoutAt: new Date().toISOString(),
            tokenExpiry: expiresAt.toISOString(),
            revokeAllSessions,
            refreshTokenProvided: !!refreshToken,
          },
        }
      );

      res.json({
        success: true,
        message: revokeAllSessions
          ? "Logged out from all devices successfully"
          : "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout error:", error);

      // Log failed logout attempt
      try {
        const auditContext = AuditLogService.createAuditContext(req, req.user);
        await auditLogService.logAuthenticationEvent(
          AuditEventType.LOGOUT,
          auditContext,
          {
            action: "User logout failed",
            metadata: {
              error: error instanceof Error ? error.message : "Unknown error",
              logoutAt: new Date().toISOString(),
            },
          }
        );
      } catch (auditError) {
        console.error("Failed to log failed logout:", auditError);
      }

      res.status(INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to logout",
      });
    }
  })
);

// Change password (authenticated users)
router.post(
  "/auth/change-password",
  passwordChangeRateLimit, // Strict rate limiting for password changes
  AuthMiddleware.authenticate,
  UserValidation.validatePasswordChange,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    // Get user from database to verify current password
    const db = await connectDB();
    const userRepository = new UserRepository(db);
    const user = await userRepository.getUserById(userId);

    if (!user) {
      res.status(NOT_FOUND).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await PasswordUtils.comparePassword(
      currentPassword,
      user.passwordHash
    );
    if (!isCurrentPasswordValid) {
      res.status(BAD_REQUEST).json({
        success: false,
        message: "Current password is incorrect",
      });
      return;
    }

    // Check if new password is different from current
    const isSamePassword = await PasswordUtils.comparePassword(
      newPassword,
      user.passwordHash
    );
    if (isSamePassword) {
      res.status(BAD_REQUEST).json({
        success: false,
        message: "New password must be different from current password",
      });
      return;
    }

    // Hash new password
    const newPasswordHash = await PasswordUtils.hashPassword(newPassword);

    // Update password in database
    await userRepository.updateUser(userId, {
      passwordHash: newPasswordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0, // Reset failed attempts on successful password change
    });

    // Log password change event
    const auditContext = AuditLogService.createAuditContext(req, req.user);
    await auditLogService.logPasswordEvent(
      AuditEventType.PASSWORD_CHANGED,
      auditContext,
      true,
      {
        action: "Password changed by user",
        metadata: {
          changedAt: new Date().toISOString(),
          resetFailedAttempts: true,
        },
      }
    );

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  })
);

// Token cleanup management endpoints (admin only)
router.get(
  "/auth/cleanup/status",
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { TokenCleanupService } = await import(
      "../services/TokenCleanupService"
    );
    const status = TokenCleanupService.getServiceStatus();

    res.json({
      success: true,
      data: status,
    });
  })
);

router.post(
  "/auth/cleanup/force",
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { TokenCleanupService } = await import(
      "../services/TokenCleanupService"
    );

    try {
      const results = await TokenCleanupService.forceCleanup();

      // Log admin action
      const auditContext = AuditLogService.createAuditContext(req, req.user);
      await auditLogService.logSecurityEvent(
        "ADMIN_ACTION" as AuditEventType,
        auditContext,
        {
          action: "Force token cleanup executed",
          metadata: {
            refreshTokensRemoved: results.refreshTokensRemoved,
            blacklistedTokensRemoved: results.blacklistedTokensRemoved,
          },
        }
      );

      res.json({
        success: true,
        message: "Token cleanup completed successfully",
        data: results,
      });
    } catch (error) {
      console.error("Force cleanup error:", error);
      res.status(INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to execute token cleanup",
      });
    }
  })
);

export default router;
