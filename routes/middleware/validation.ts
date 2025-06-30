import { Request, Response, NextFunction } from 'express';

/**
 * Validation helper functions
 */
export const validation = {
    /**
     * Validate required fields in request body
     */
    requireFields: (fields: string[]) => {
        return (req: Request, res: Response, next: NextFunction): void => {
            const missingFields = fields.filter(field => !req.body[field]);
            
            if (missingFields.length > 0) {
                res.status(400).json({
                    success: false,
                    message: `Missing required fields: ${missingFields.join(', ')}`
                });
                return;
            }
            
            next();
        };
    },

    /**
     * Validate email format
     */
    validateEmail: (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Validate date format (ISO 8601)
     */
    validateDate: (dateString: string): boolean => {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date.getTime());
    },

    /**
     * Validate skill level (1-10)
     */
    validateSkillLevel: (level: number): boolean => {
        return Number.isInteger(level) && level >= 1 && level <= 10;
    },

    /**
     * Middleware to validate email in request body
     */
    validateEmailMiddleware: (req: Request, res: Response, next: NextFunction): void => {
        const { email } = req.body;
        
        if (email) {
            const emails = Array.isArray(email) ? email : [email];
            const invalidEmails = emails.filter((e: string) => !validation.validateEmail(e));
            
            if (invalidEmails.length > 0) {
                res.status(400).json({
                    success: false,
                    message: `Invalid email format: ${invalidEmails.join(', ')}`
                });
                return;
            }
        }
        
        next();
    },

    /**
     * Middleware to validate dates in request body
     */
    validateDatesMiddleware: (dateFields: string[]) => {
        return (req: Request, res: Response, next: NextFunction): void => {
            const invalidDates = dateFields.filter(field => {
                const date = req.body[field];
                return date && !validation.validateDate(date);
            });
            
            if (invalidDates.length > 0) {
                res.status(400).json({
                    success: false,
                    message: `Invalid date format for fields: ${invalidDates.join(', ')}. Use ISO 8601 format (YYYY-MM-DD)`
                });
                return;
            }
            
            next();
        };
    }
};
