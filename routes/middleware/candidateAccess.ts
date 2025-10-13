// =======================
// CANDIDATE ACCESS MIDDLEWARE
// =======================
// Purpose: Validate if user has access to candidate based on role and assignments
// Related: AuthMiddleware, CandidateService, role-based access control
// =======================

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { UserRole } from '../../Models/User';
import { CandidateService } from '../../services/CandidateService';

const candidateService = new CandidateService();

export class CandidateAccessMiddleware {
  
  /**
   * Middleware to check if user has access to a specific candidate
   * - HR_USER: Only assigned candidates
   * - HR_MANAGER: All candidates
   * - ADMIN: All candidates
   */
  static checkCandidateAccess = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const { candidateId } = req.params;
      const user = req.user!;
      
      if (!candidateId) {
        res.status(400).json({
          success: false,
          message: 'Candidate ID is required',
        });
        return;
      }

      // Check if candidate exists
      const candidate = await candidateService.getCandidate(candidateId);
      if (!candidate) {
        res.status(404).json({
          success: false,
          message: 'Candidate not found',
        });
        return;
      }

      // HR_MANAGER and ADMIN have access to all candidates
      if (user.role === UserRole.HR_MANAGER || user.role === UserRole.ADMIN) {
        next();
        return;
      }

      // HR_USER can only access assigned candidates
      if (user.role === UserRole.HR_USER) {
        const isAssigned = await candidateService.isHRUserAssignedToCandidate(candidateId, user.userId);
        if (!isAssigned) {
          res.status(403).json({
            success: false,
            message: 'Access denied. You are not assigned to this candidate.',
          });
          return;
        }
      }

      next();
    } catch (error) {
      console.error('Error in candidate access middleware:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while checking candidate access',
      });
    }
  };

  /**
   * Middleware to check if user can manage assignments (HR_MANAGER or ADMIN only)
   */
  static requireAssignmentPermissions = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const user = req.user!;
    
    if (user.role !== UserRole.HR_MANAGER && user.role !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        message: 'Access denied. HR Manager or Admin role required for assignment operations.',
      });
      return;
    }
    
    next();
  };

  /**
   * Middleware to validate HR user can access specific HR user endpoints
   * - HR_USER: Can only access their own data
   * - HR_MANAGER/ADMIN: Can access any HR user data
   */
  static validateHRUserAccess = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const { hrUserId } = req.params;
    const user = req.user!;
    
    if (!hrUserId) {
      res.status(400).json({
        success: false,
        message: 'HR User ID is required',
      });
      return;
    }

    // HR_USER can only access their own data
    if (user.role === UserRole.HR_USER && user.userId !== hrUserId) {
      res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own candidate assignments.',
      });
      return;
    }

    next();
  };
}