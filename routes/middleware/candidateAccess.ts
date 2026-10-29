// =======================
// CANDIDATE ACCESS MIDDLEWARE
// =======================
// Purpose: Validate if user has access to candidate based on role and assignments
// Related: AuthMiddleware, CandidateService, role-based access control
// =======================

import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth";
import { User, UserRole } from "../../Models/User";
import { CandidateService } from "../../services/CandidateService";

const candidateService = new CandidateService();

export type CandidateAccessResult = "allowed" | "not_found" | "forbidden";

export class CandidateAccessMiddleware {
  /**
   * Decide whether a user may access a candidate
   * - HR_USER / RECRUITER / INTERVIEWER: Only assigned candidates
   * - HR_MANAGER: All candidates
   * - ADMIN: All candidates
   */
  static getCandidateAccess = async (
    user: User,
    candidateId: string
  ): Promise<CandidateAccessResult> => {
    const candidate = await candidateService.getCandidate(candidateId);
    if (!candidate) {
      return "not_found";
    }

    // HR_MANAGER and ADMIN have access to all candidates
    if (user.role === UserRole.HR_MANAGER || user.role === UserRole.ADMIN) {
      return "allowed";
    }

    // HR_USER, RECRUITER, and INTERVIEWER can only access assigned candidates
    const isAssigned = await candidateService.isHRUserAssignedToCandidate(
      candidateId,
      user.userId
    );
    return isAssigned ? "allowed" : "forbidden";
  };

  /**
   * Build a middleware that checks access to the candidate IDs found in the
   * given route params (e.g. compare routes take two candidates).
   */
  static checkCandidateAccessFor = (...paramNames: string[]) => {
    return async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const user = req.user;
        if (!user) {
          res.status(401).json({
            success: false,
            message: "Authentication required.",
          });
          return;
        }

        for (const paramName of paramNames) {
          const candidateId = req.params[paramName];
          if (!candidateId) {
            res.status(400).json({
              success: false,
              message: "Candidate ID is required",
            });
            return;
          }

          const access = await CandidateAccessMiddleware.getCandidateAccess(
            user,
            candidateId
          );
          if (access === "not_found") {
            res.status(404).json({
              success: false,
              message: "Candidate not found",
            });
            return;
          }
          if (access === "forbidden") {
            res.status(403).json({
              success: false,
              message: "Access denied. You are not assigned to this candidate.",
            });
            return;
          }
        }

        next();
      } catch (error) {
        console.error("Error in candidate access middleware:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error while checking candidate access",
        });
      }
    };
  };

  /**
   * Middleware to check if user has access to the :candidateId route param
   */
  static checkCandidateAccess = CandidateAccessMiddleware.checkCandidateAccessFor(
    "candidateId"
  );

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
        message:
          "Access denied. HR Manager or Admin role required for assignment operations.",
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
        message: "HR User ID is required",
      });
      return;
    }

    // HR_USER can only access their own data
    if (user.role === UserRole.HR_USER && user.userId !== hrUserId) {
      res.status(403).json({
        success: false,
        message:
          "Access denied. You can only access your own candidate assignments.",
      });
      return;
    }

    next();
  };
}
