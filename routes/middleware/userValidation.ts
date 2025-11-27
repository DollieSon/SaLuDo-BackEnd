// =======================
// USER VALIDATION SCHEMAS
// =======================
// Purpose: Input validation and sanitization for user-related endpoints
// Related: UserService, validation middleware
// =======================

import { Request, Response, NextFunction } from 'express';
import { validation } from './validation';
import { UserRole } from '../../Models/User';

export class UserValidation {
  
  // Validate user creation data
  static validateCreateUser = (req: Request, res: Response, next: NextFunction): void => {
    const { email, password, firstName, lastName, title, role } = req.body;
    
    const missingFields = [];
    if (!email) missingFields.push('email');
    if (!password) missingFields.push('password');
    if (!firstName) missingFields.push('firstName');
    if (!lastName) missingFields.push('lastName');
    if (!title) missingFields.push('title');
    if (!role) missingFields.push('role');
    
    if (missingFields.length > 0) {
      res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
      return;
    }

    // Validate email format
    if (!validation.validateEmail(email)) {
      res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
      return;
    }

    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
      return;
    }

    // Validate password strength (basic check)
    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
      return;
    }

    next();
  };

  // Validate user profile update data
  static validateUpdateProfile = (req: Request, res: Response, next: NextFunction): void => {
    const { 
      email, firstName, lastName, title, middleName,
      phoneNumber, location, timezone, linkedInUrl, bio,
      availability, roleSpecificData
    } = req.body;
    
    // At least one field must be provided
    if (!email && !firstName && !lastName && !title && !middleName &&
        !phoneNumber && !location && !timezone && !linkedInUrl && !bio &&
        !availability && !roleSpecificData) {
      res.status(400).json({
        success: false,
        message: 'At least one field must be provided for update'
      });
      return;
    }

    // Validate email if provided
    if (email && !validation.validateEmail(email)) {
      res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
      return;
    }

    // Validate phone number if provided (basic international format)
    if (phoneNumber && !validation.validatePhoneNumber(phoneNumber)) {
      res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use format: +1234567890 or (123) 456-7890'
      });
      return;
    }

    // Validate LinkedIn URL if provided
    if (linkedInUrl && !validation.validateLinkedInUrl(linkedInUrl)) {
      res.status(400).json({
        success: false,
        message: 'Invalid LinkedIn URL format'
      });
      return;
    }

    // Validate bio length if provided
    if (bio && bio.length > 1000) {
      res.status(400).json({
        success: false,
        message: 'Bio must be 1000 characters or less'
      });
      return;
    }

    // Validate timezone if provided
    if (timezone && !validation.validateTimezone(timezone)) {
      res.status(400).json({
        success: false,
        message: 'Invalid timezone format. Use IANA timezone format (e.g., America/New_York)'
      });
      return;
    }

    // Validate availability if provided
    if (availability) {
      const validationError = validation.validateAvailability(availability);
      if (validationError) {
        res.status(400).json({
          success: false,
          message: validationError
        });
        return;
      }
    }

    next();
  };

  // Validate password reset data
  static validatePasswordReset = (req: Request, res: Response, next: NextFunction): void => {
    const { newPassword } = req.body;
    
    if (!newPassword) {
      res.status(400).json({
        success: false,
        message: 'New password is required'
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
      return;
    }

    next();
  };

  // Validate password change data
  static validatePasswordChange = (req: Request, res: Response, next: NextFunction): void => {
    const { currentPassword, newPassword } = req.body;
    
    const missingFields = [];
    if (!currentPassword) missingFields.push('currentPassword');
    if (!newPassword) missingFields.push('newPassword');
    
    if (missingFields.length > 0) {
      res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
      return;
    }

    // Validate new password strength
    if (!validation.validatePasswordStrength(newPassword)) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      });
      return;
    }

    // Ensure passwords are strings
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Passwords must be strings'
      });
      return;
    }

    next();
  };

  // Validate user ID parameter
  static validateUserId = (req: Request, res: Response, next: NextFunction): void => {
    const { userId } = req.params;
    
    if (!userId || userId.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'Valid user ID is required'
      });
      return;
    }

    next();
  };
}