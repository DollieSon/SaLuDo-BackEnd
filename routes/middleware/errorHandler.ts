import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AuditLogger } from '../../utils/AuditLogger';
import { AuditEventType } from '../../types/AuditEventTypes';

export const asyncHandler = (fn: (req: Request, res: Response, next?: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

// Field names whose values must never reach logs (matched case-insensitively, substring)
const SENSITIVE_KEY_PATTERN = /pass(word)?|token|secret|authorization|cookie|api[-_]?key|otp/i;
const MAX_REDACT_DEPTH = 5;

/**
 * Deep-copy a value, replacing sensitive fields with "[REDACTED]".
 */
export const redactSensitive = (value: unknown, depth = 0): unknown => {
    if (value === null || typeof value !== 'object') return value;
    if (depth >= MAX_REDACT_DEPTH) return '[Truncated]';
    if (Buffer.isBuffer(value)) return '[Binary]';
    if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1));

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        result[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : redactSensitive(val, depth + 1);
    }
    return result;
};

// Translate upload limit errors into client errors instead of 500s
const getStatusCode = (error: any): number => {
    if (error instanceof multer.MulterError) {
        return error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    }
    if (error?.type === 'entity.too.large') return 413;
    if (error?.type === 'entity.parse.failed') return 400;
    const status = error?.status || error?.statusCode;
    return typeof status === 'number' && status >= 400 && status < 600 ? status : 500;
};

export const errorHandler = async (error: any, req: Request, res: Response, next: NextFunction) => {
    const statusCode = getStatusCode(error);
    console.error('API Error:', error?.message || error);

    // Log system error to audit (secrets redacted; admins can read audit logs)
    if (statusCode >= 500) {
        try {
            const user = (req as any).user; // Try to get authenticated user if available
            await AuditLogger.log({
                eventType: AuditEventType.SYSTEM_ERROR,
                userId: user?.userId,
                userEmail: user?.email,
                resource: 'system',
                resourceId: 'error',
                action: 'error_occurred',
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                success: false,
                metadata: {
                    errorMessage: error?.message,
                    errorStack: error?.stack,
                    statusCode,
                    path: req.path,
                    method: req.method,
                    query: redactSensitive(req.query),
                    body: redactSensitive(req.body)
                }
            });
        } catch (auditError) {
            console.error('Failed to log system error to audit:', auditError);
        }
    }

    if (res.headersSent) {
        return next(error);
    }

    // Client errors keep their message; server errors never expose internals
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(statusCode).json({
        success: false,
        message: statusCode < 500 ? error?.message || 'Request failed' : 'Internal server error',
        ...(isDevelopment && statusCode >= 500 ? { error: error?.stack } : {})
    });
};
