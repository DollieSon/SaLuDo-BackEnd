import { Request, Response, NextFunction } from 'express';
export const asyncHandler = (fn: (req: Request, res: Response, next?: NextFunction) => Promise<any>) => 
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
    console.error('API Error:', error);
    // Don't send error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Internal server error',
        error: isDevelopment ? error.stack : 'Something went wrong'
    });
};
