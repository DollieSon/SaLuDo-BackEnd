// =======================
// PASSWORD UTILITIES
// =======================
// Purpose: Password hashing and validation utilities using bcrypt
// Related: UserService, auth middleware
// =======================

import crypto from "crypto";
import bcrypt from "bcrypt";

export class PasswordUtils {
  // Generate a secure random password for new accounts
  static generateTemporaryPassword(length: number = 12): string {
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";

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
  static async verifyPassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      return false;
    }
  }

  // Alias for verifyPassword (for consistency with usage)
  static async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return await this.verifyPassword(password, hashedPassword);
  }

  // Generate JWT access token (short-lived)
  static generateAccessToken(userId: string): string {
    const jwt = require("jsonwebtoken");
    const JWT_SECRET =
      process.env.JWT_SECRET || "your-jwt-secret-change-in-production";

    // Security warning for default JWT secret
    if (
      !process.env.JWT_SECRET ||
      JWT_SECRET === "your-jwt-secret-change-in-production"
    ) {
      console.warn(
        "SECURITY WARNING: Using default JWT secret! Set JWT_SECRET environment variable."
      );
    }

    return jwt.sign(
      {
        userId,
        type: "access",
        iat: Math.floor(Date.now() / 1000),
      },
      JWT_SECRET,
      { expiresIn: "8h" } // 8 hours for access tokens
    );
  }

  // Generate JWT refresh token (long-lived)
  static generateRefreshToken(userId: string): string {
    const jwt = require("jsonwebtoken");
    const JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ||
      process.env.JWT_SECRET ||
      "your-jwt-refresh-secret-change-in-production";

    // Security warning for default secrets
    if (
      !process.env.JWT_REFRESH_SECRET ||
      JWT_REFRESH_SECRET === "your-jwt-refresh-secret-change-in-production"
    ) {
      console.warn(
        "SECURITY WARNING: Using default JWT refresh secret! Set JWT_REFRESH_SECRET environment variable."
      );
    }

    return jwt.sign(
      {
        userId,
        type: "refresh",
        iat: Math.floor(Date.now() / 1000),
        jti: crypto.randomUUID(), // Unique token ID for tracking
      },
      JWT_REFRESH_SECRET,
      { expiresIn: "7d" } // 7 days for refresh tokens
    );
  }

  // Legacy method - now generates access token for backward compatibility
  static generateToken(userId: string): string {
    return this.generateAccessToken(userId);
  }

  // Verify JWT access token
  static verifyAccessToken(
    token: string
  ): { userId: string; type: string; iat: number } | null {
    try {
      const jwt = require("jsonwebtoken");
      const JWT_SECRET =
        process.env.JWT_SECRET || "your-jwt-secret-change-in-production";

      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        type: string;
        iat: number;
      };

      // Ensure this is an access token
      if (decoded.type !== "access") {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  // Verify JWT refresh token
  static verifyRefreshToken(
    token: string
  ): { userId: string; type: string; iat: number; jti: string } | null {
    try {
      const jwt = require("jsonwebtoken");
      const JWT_REFRESH_SECRET =
        process.env.JWT_REFRESH_SECRET ||
        process.env.JWT_SECRET ||
        "your-jwt-refresh-secret-change-in-production";

      const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as {
        userId: string;
        type: string;
        iat: number;
        jti: string;
      };

      // Ensure this is a refresh token
      if (decoded.type !== "refresh") {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  // Legacy method - now verifies access token for backward compatibility
  static verifyToken(token: string): { userId: string } | null {
    const result = this.verifyAccessToken(token);
    return result ? { userId: result.userId } : null;
  }
}
