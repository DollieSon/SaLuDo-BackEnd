import { Request, Response, NextFunction } from "express";
export const validation = {
  requireFields: (fields: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const missingFields = fields.filter((field) => !req.body[field]);
      if (missingFields.length > 0) {
        res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(", ")}`,
        });
        return;
      }
      next();
    };
  },
  validateEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  validateDate: (dateString: string): boolean => {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  },
  validateSkillLevel: (level: number): boolean => {
    return Number.isInteger(level) && level >= 1 && level <= 10;
  },
  validatePasswordStrength: (password: string): boolean => {
    // Password must be at least 8 characters and contain:
    // - At least one uppercase letter
    // - At least one lowercase letter  
    // - At least one number
    // - At least one special character
    if (password.length < 8) return false;
    
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    return hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
  },
  validateEmailMiddleware: (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const { email } = req.body;
    if (email) {
      const emails = Array.isArray(email) ? email : [email];
      const invalidEmails = emails.filter(
        (e: string) => !validation.validateEmail(e)
      );
      if (invalidEmails.length > 0) {
        res.status(400).json({
          success: false,
          message: `Invalid email format: ${invalidEmails.join(", ")}`,
        });
        return;
      }
    }
    next();
  },
  validateDatesMiddleware: (dateFields: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const invalidDates = dateFields.filter((field) => {
        const date = req.body[field];
        return date && !validation.validateDate(date);
      });
      if (invalidDates.length > 0) {
        res.status(400).json({
          success: false,
          message: `Invalid date format for fields: ${invalidDates.join(
            ", "
          )}. Use ISO 8601 format (YYYY-MM-DD)`,
        });
        return;
      }
      next();
    };
  },
  validateTranscriptFile: (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const file = req.file;
    if (!file) {
      res.status(400).json({
        success: false,
        message: "No transcript file provided",
      });
      return;
    }
    // Allowed MIME types for transcript files
    const allowedTypes = [
      "audio/mpeg", // MP3
      "audio/wav", // WAV
      "audio/mp4", // M4A
      "audio/ogg", // OGG
      "text/plain", // TXT
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      res.status(400).json({
        success: false,
        message:
          "Invalid file type. Only MP3, WAV, M4A, OGG, TXT, and DOCX files are allowed.",
      });
      return;
    }
    // Check file size (50MB limit for audio files)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 50MB.",
      });
      return;
    }
    next();
  },

  validateVideoFile: (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const file = req.file;
    if (!file) {
      res.status(400).json({
        success: false,
        message: "No video file provided",
      });
      return;
    }

    // Allowed MIME types for video files
    const allowedTypes = [
      "video/mp4", // MP4
      "video/webm", // WebM
      "video/avi", // AVI
      "video/mov", // MOV (QuickTime)
      "video/wmv", // WMV
      "video/flv", // FLV
      "video/mkv", // MKV
      "video/m4v", // M4V
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      res.status(400).json({
        success: false,
        message:
          "Invalid file type. Only MP4, WebM, AVI, MOV, WMV, FLV, MKV, and M4V files are allowed.",
      });
      return;
    }

    // Check file size (500MB limit for video files)
    const maxSize = 500 * 1024 * 1024; // 500MB in bytes
    if (file.size > maxSize) {
      res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 500MB.",
      });
      return;
    }

    next();
  },

  validateInterviewRound: (round?: string): boolean => {
    if (!round) return true; // Optional field
    const validRounds = ["initial", "technical", "hr", "final", "general"];
    return validRounds.includes(round.toLowerCase());
  },
};
