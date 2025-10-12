// =======================
// RATE LIMITING MIDDLEWARE
// =======================
// Purpose: Prevent brute force attacks and API abuse through request rate limiting
// Related: Authentication routes, security middleware
// =======================

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Custom rate limit handler with detailed logging
const createRateLimitHandler = (limitType: string) => {
  return (req: Request, res: Response) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    console.warn(`Rate limit exceeded [${limitType}]:`, {
      ip: clientIp,
      userAgent,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
    
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      retryAfter: res.get('Retry-After'),
      limitType
    });
  };
};

// Strict rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: createRateLimitHandler('AUTH'),
  skip: (req) => {
    // Skip rate limiting for admin users during development
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1';
    
    if (isDevelopment && isLocalhost) {
      console.log('Skipping rate limit for local development');
      return true;
    }
    
    return false;
  }
});

// Medium rate limiting for sensitive user operations
export const userOperationRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 operations per 5 minutes per IP
  message: {
    success: false,
    message: 'Too many user operations. Please try again in 5 minutes.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('USER_OP'),
});

// General API rate limiting
export const generalApiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: {
    success: false,
    message: 'Too many API requests. Please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('GENERAL'),
  skip: (req) => {
    // Skip for static files and health checks
    const skipPaths = ['/health', '/favicon.ico', '/robots.txt'];
    return skipPaths.some(path => req.path.includes(path));
  }
});

// Aggressive rate limiting for password change operations
export const passwordChangeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password changes per hour per IP
  message: {
    success: false,
    message: 'Too many password change attempts. Please try again in 1 hour.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('PASSWORD_CHANGE'),
});

// Very strict rate limiting for account creation (admin only, but still protected)
export const accountCreationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 account creations per hour per IP
  message: {
    success: false,
    message: 'Too many account creation attempts. Please try again in 1 hour.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('ACCOUNT_CREATION'),
});

// Rate limiting for file uploads
export const fileUploadRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50, // 50 file uploads per 10 minutes per IP
  message: {
    success: false,
    message: 'Too many file uploads. Please try again in 10 minutes.',
    retryAfter: '10 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('FILE_UPLOAD'),
});

// Rate limiting configuration info for debugging
export const getRateLimitInfo = () => {
  return {
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 5,
      description: 'Authentication endpoints (login, logout)'
    },
    userOperation: {
      windowMs: 5 * 60 * 1000,
      max: 10,
      description: 'User management operations (profile updates, user creation)'
    },
    general: {
      windowMs: 1 * 60 * 1000,
      max: 100,
      description: 'General API requests'
    },
    passwordChange: {
      windowMs: 60 * 60 * 1000,
      max: 3,
      description: 'Password change operations'
    },
    accountCreation: {
      windowMs: 60 * 60 * 1000,
      max: 20,
      description: 'Account creation operations'
    },
    fileUpload: {
      windowMs: 10 * 60 * 1000,
      max: 50,
      description: 'File upload operations'
    }
  };
};

// Middleware to log rate limit information
export const rateLimitLogger = (req: Request, res: Response, next: any) => {
  const rateLimitRemaining = res.get('RateLimit-Remaining');
  const rateLimitLimit = res.get('RateLimit-Limit');
  
  if (rateLimitRemaining && rateLimitLimit) {
    const remaining = parseInt(rateLimitRemaining);
    const limit = parseInt(rateLimitLimit);
    
    // Log warning when approaching rate limit
    if (remaining <= limit * 0.2) { // When 80% of limit is used
      console.warn('Rate limit warning:', {
        ip: req.ip,
        path: req.path,
        remaining,
        limit,
        percentage: Math.round((remaining / limit) * 100)
      });
    }
  }
  
  next();
};