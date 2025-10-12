// =======================
// USER ROUTES
// =======================
// Purpose: User management endpoints - admin account creation, authentication, profile management
// Related: UserService, auth middleware, user validation
// =======================

import { Router, Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { UserRepository } from '../repositories/UserRepository';
import { connectDB } from '../mongo_db';
import { asyncHandler, errorHandler } from './middleware/errorHandler';
import { AuthMiddleware, AuthenticatedRequest } from './middleware/auth';
import { UserValidation } from './middleware/userValidation';
import { PasswordUtils } from './middleware/passwordUtils';
import { UserRole, User } from '../Models/User';

const router = Router();
let userService: UserService;

// Initialize service
const initializeService = async () => {
  const db = await connectDB();
  const userRepository = new UserRepository(db);
  userService = new UserService(userRepository);
  await AuthMiddleware.initialize();
};

// Call initialization
initializeService().catch(console.error);

// ====================
// AUTHENTICATION ENDPOINTS  
// ====================

// User login
router.post('/auth/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }

    // Find user by email
    const db = await connectDB();
    const userRepository = new UserRepository(db);
    const userData = await userRepository.getUserByEmail(email);
    
    if (!userData) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    const user = User.fromObject(userData);

    // Check if account is locked
    if (user.isAccountLocked()) {
      res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to failed login attempts'
      });
      return;
    }

    // Check if account is active
    if (!user.isActive || user.isDeleted) {
      res.status(401).json({
        success: false,
        message: 'Account is inactive or deleted'
      });
      return;
    }

    // Verify password
    const isValidPassword = await PasswordUtils.verifyPassword(password, user.passwordHash);
    
    if (!isValidPassword) {
      // Increment failed login attempts
      user.incrementFailedLoginAttempts();
      await userRepository.updateUser(user.userId, {
        failedLoginAttempts: user.failedLoginAttempts,
        accountLockedUntil: user.accountLockedUntil,
        isActive: user.isActive
      });

      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Reset failed login attempts on successful login
    if (user.failedLoginAttempts > 0) {
      user.resetFailedLoginAttempts();
      await userRepository.updateUser(user.userId, {
        failedLoginAttempts: 0,
        accountLockedUntil: undefined
      });
    }

    // Record login
    user.recordLogin();
    await userRepository.updateUser(user.userId, {
      lastLogin: user.lastLogin
    });

    // Generate JWT token
    const token = PasswordUtils.generateToken(user.userId);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.getProfile(),
        token,
        mustChangePassword: user.mustChangePassword
      }
    });
  })
);

// ====================
// ADMIN-ONLY ENDPOINTS
// ====================

// Create new user (Admin only)
router.post('/',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.ADMIN),
  UserValidation.validateCreateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email, password, firstName, lastName, title, role, middleName } = req.body;
    
    // Hash password for storage using bcrypt
    const hashedPassword = await PasswordUtils.hashPassword(password);
    
    const newUser = await userService.createUserAsAdmin({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      title,
      role,
      middleName
    });

    // Generate temporary token for immediate use (if needed)
    const token = PasswordUtils.generateToken(newUser.userId);

    res.status(201).json({
      success: true,
      message: 'User created successfully. Password change required on first login.',
      data: {
        userId: newUser.userId,
        email: newUser.email,
        fullName: newUser.getFullName(),
        role: newUser.role,
        mustChangePassword: newUser.mustChangePassword
      }
    });
  })
);

// Reset user password (Admin only)
router.put('/:userId/reset-password',
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
      message: 'Password reset successfully. User must change password on next login.'
    });
  })
);

// Get all users (Admin only)
router.get('/',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.ADMIN),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { 
      page = '1', 
      limit = '10', 
      role, 
      isActive, 
      search 
    } = req.query;

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      role: role as UserRole,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search: search as string
    };

    // Validate pagination parameters
    if (options.page < 1) options.page = 1;
    if (options.limit < 1 || options.limit > 100) options.limit = 10;

    const result = await userService.getAllUsers(options);

    res.json({
      success: true,
      data: result.users.map(user => user.getProfile()),
      pagination: {
        page: result.page,
        limit: options.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        hasNext: result.page < result.totalPages,
        hasPrev: result.page > 1
      }
    });
  })
);

// ====================
// USER PROFILE ENDPOINTS
// ====================

// Get user profile (Self or Admin)
router.get('/:userId',
  AuthMiddleware.authenticate,
  UserValidation.validateUserId,
  AuthMiddleware.requireOwnershipOrAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const user = await userService.getUserProfile(userId);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: user.getProfile()
    });
  })
);

// Update user profile (Self or Admin)
router.put('/:userId/profile',
  AuthMiddleware.authenticate,
  UserValidation.validateUserId,
  UserValidation.validateUpdateProfile,
  AuthMiddleware.requireOwnershipOrAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { email, firstName, lastName, middleName, title } = req.body;

    // Check if user exists
    const existingUser = await userService.getUserProfile(userId);
    if (!existingUser) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Check email uniqueness if email is being changed
    if (email && email.toLowerCase() !== existingUser.email.toLowerCase()) {
      const db = await connectDB();
      const userRepository = new UserRepository(db);
      const emailExists = await userRepository.emailExists(email, userId);
      
      if (emailExists) {
        res.status(409).json({
          success: false,
          message: 'Email address is already in use'
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

    // Update user
    const db = await connectDB();
    const userRepository = new UserRepository(db);
    await userRepository.updateUser(userId, updateData);

    // Get updated user profile
    const updatedUser = await userService.getUserProfile(userId);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser!.getProfile()
    });
  })
);

// ====================
// ADMIN MANAGEMENT ENDPOINTS
// ====================

// Set user active status (Admin only)
router.put('/:userId/status',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.ADMIN),
  UserValidation.validateUserId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value'
      });
      return;
    }

    await userService.setUserActiveStatus(userId, isActive);
    
    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  })
);

// Soft delete user (Admin only)
router.delete('/:userId',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.ADMIN),
  UserValidation.validateUserId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    
    // Prevent admin from deleting themselves
    if (req.user!.userId === userId) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
      return;
    }

    await userService.softDeleteUser(userId);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  })
);

export default router;