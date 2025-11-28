import { Request, Response, NextFunction } from 'express';
import { AuditLogger } from '../../utils/AuditLogger';
import { AuditEventType } from '../../types/AuditEventTypes';

export const asyncHandler = (fn: (req: Request, res: Response, next?: NextFunction) => Promise<any>) => 
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

export const errorHandler = async (error: any, req: Request, res: Response, next: NextFunction) => {
    console.error('API Error:', error);
    
    // Log system error to audit
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
                errorMessage: error.message,
                errorStack: error.stack,
                statusCode: error.status || 500,
                path: req.path,
                method: req.method,
                query: req.query,
                body: req.body
            }
        });
    } catch (auditError) {
        console.error('Failed to log system error to audit:', auditError);
    }
    
    // Don't send error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Internal server error',
        error: isDevelopment ? error.stack : 'Something went wrong'
    });
};
