// =======================
// PASSWORD UTILITIES
// =======================
// Purpose: Password hashing and validation utilities using bcrypt
// Related: UserService, auth middleware
// =======================

import crypto from 'crypto';
import bcrypt from 'bcrypt';

export class PasswordUtils {
  
  // Generate a secure random password for new accounts
  static generateTemporaryPassword(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }

  // Hash password using bcrypt (industry standard)
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12; // Industry standard for security vs performance balance
    return await bcrypt.hash(password, saltRounds);
  }

  // Verify password against bcrypt hash
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      return false;
    }
  }

  // Alias for verifyPassword (for consistency with usage)
  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return await this.verifyPassword(password, hashedPassword);
  }

  // Generate JWT token
  static generateToken(userId: string): string {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
    
    // Security warning for default JWT secret
    if (!process.env.JWT_SECRET || JWT_SECRET === 'your-jwt-secret-change-in-production') {
      console.warn('SECURITY WARNING: Using default JWT secret! Set JWT_SECRET environment variable.');
    }
    
    return jwt.sign(
      { userId }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
  }

  // Verify JWT token
  static verifyToken(token: string): { userId: string } | null {
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
      
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      return { userId: decoded.userId };
    } catch (error) {
      return null;
    }
  }
}