// =======================
// SETTINGS ROUTES
// =======================
// Purpose: Configuration endpoints for scoring preferences and other system settings
// Related: ScoringPreferencesRepository, PredictiveScoreService
// =======================

import { Router, Response } from 'express';
import { asyncHandler, errorHandler } from './middleware/errorHandler';
import { AuthMiddleware, AuthenticatedRequest } from './middleware/auth';
import { ScoringPreferencesRepository } from '../repositories/ScoringPreferencesRepository';
import { connectDB } from '../mongo_db';
import { UserRole } from '../Models/User';
import { AuditLogger } from '../utils/AuditLogger';
import { AuditEventType } from '../types/AuditEventTypes';
import {
  ScoringPreferencesScope,
  UpdateScoringPreferencesData,
  validateScoringPreferences,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_SCORING_MODIFIERS,
  DEFAULT_PERSONALITY_CATEGORY_WEIGHTS
} from '../Models/ScoringPreferences';
import { OK, CREATED, BAD_REQUEST, NOT_FOUND, FORBIDDEN } from '../constants/HttpStatusCodes';

const router = Router();
let scoringPreferencesRepo: ScoringPreferencesRepository;

// Initialize repository
const initializeRepo = async () => {
  const db = await connectDB();
  scoringPreferencesRepo = new ScoringPreferencesRepository(db);
  await scoringPreferencesRepo.ensureIndexes();
  await AuthMiddleware.initialize();
};

initializeRepo().catch(console.error);

// ====================
// SCORING SETTINGS ENDPOINTS
// ====================

/**
 * GET /api/settings/scoring
 * Get global scoring preferences
 * Access: All authenticated users (read-only)
 */
router.get(
  '/scoring',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    
    const settings = await scoringPreferencesRepo.getOrCreateGlobalSettings(user.userId);
    
    res.status(OK).json({
      success: true,
      data: settings
    });
  })
);

/**
 * PUT /api/settings/scoring
 * Update global scoring preferences
 * Access: Admin and HR Manager only
 */
router.put(
  '/scoring',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    
    // Check permissions - Admin or HR Manager
    if (!user.isAdmin() && !user.isHRManager()) {
      return res.status(FORBIDDEN).json({
        success: false,
        message: 'Only Admin and HR Manager can update scoring settings'
      });
    }
    
    const { weights, modifiers, personalityCategoryWeights } = req.body;
    
    // Get current settings to merge with
    const currentSettings = await scoringPreferencesRepo.getOrCreateGlobalSettings(user.userId);
    
    // Merge with current values for validation
    const mergedWeights = weights ? { ...currentSettings.weights, ...weights } : currentSettings.weights;
    const mergedModifiers = modifiers ? { ...currentSettings.modifiers, ...modifiers } : currentSettings.modifiers;
    const mergedPersonalityWeights = personalityCategoryWeights 
      ? { ...currentSettings.personalityCategoryWeights, ...personalityCategoryWeights } 
      : currentSettings.personalityCategoryWeights;
    
    // Validate
    const validation = validateScoringPreferences(mergedWeights, mergedModifiers, mergedPersonalityWeights);
    if (!validation.valid) {
      return res.status(BAD_REQUEST).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }
    
    const updateData: UpdateScoringPreferencesData = {
      weights,
      modifiers,
      personalityCategoryWeights,
      lastModifiedBy: user.userId
    };
    
    const updated = await scoringPreferencesRepo.updateGlobalSettings(updateData);
    
    // Audit log
    await AuditLogger.log({
      eventType: AuditEventType.NOTIFICATION_PREFERENCES_UPDATED, // Reuse existing event type for settings
      userId: user.userId,
      userEmail: user.email,
      resource: 'scoring_settings',
      resourceId: 'global',
      action: 'update_global_scoring_settings',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      oldValue: currentSettings,
      newValue: updated,
      metadata: {
        weightsChanged: !!weights,
        modifiersChanged: !!modifiers,
        personalityWeightsChanged: !!personalityCategoryWeights
      }
    });
    
    res.status(OK).json({
      success: true,
      message: 'Scoring settings updated successfully',
      data: updated
    });
  })
);

/**
 * POST /api/settings/scoring/reset
 * Reset global scoring preferences to defaults
 * Access: Admin only
 */
router.post(
  '/scoring/reset',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    
    const currentSettings = await scoringPreferencesRepo.getGlobalSettings();
    const reset = await scoringPreferencesRepo.resetGlobalToDefaults(user.userId);
    
    // Audit log
    await AuditLogger.log({
      eventType: AuditEventType.NOTIFICATION_PREFERENCES_UPDATED,
      userId: user.userId,
      userEmail: user.email,
      resource: 'scoring_settings',
      resourceId: 'global',
      action: 'reset_global_scoring_settings',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      oldValue: currentSettings,
      newValue: reset,
      metadata: {
        action: 'reset_to_defaults'
      }
    });
    
    res.status(OK).json({
      success: true,
      message: 'Scoring settings reset to defaults',
      data: reset
    });
  })
);

/**
 * GET /api/settings/scoring/defaults
 * Get default scoring values (for UI reference)
 * Access: All authenticated users
 */
router.get(
  '/scoring/defaults',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.status(OK).json({
      success: true,
      data: {
        weights: DEFAULT_SCORING_WEIGHTS,
        modifiers: DEFAULT_SCORING_MODIFIERS,
        personalityCategoryWeights: DEFAULT_PERSONALITY_CATEGORY_WEIGHTS
      }
    });
  })
);

// ====================
// JOB-SPECIFIC SCORING SETTINGS
// ====================

/**
 * GET /api/settings/scoring/job/:jobId
 * Get job-specific scoring preferences (or global if none set)
 * Access: All authenticated users
 */
router.get(
  '/scoring/job/:jobId',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { jobId } = req.params;
    const user = req.user!;
    
    const jobSettings = await scoringPreferencesRepo.getJobSettings(jobId);
    
    if (jobSettings) {
      return res.status(OK).json({
        success: true,
        data: jobSettings,
        isJobSpecific: true
      });
    }
    
    // Fall back to global
    const globalSettings = await scoringPreferencesRepo.getOrCreateGlobalSettings(user.userId);
    
    res.status(OK).json({
      success: true,
      data: globalSettings,
      isJobSpecific: false,
      message: 'No job-specific settings found, using global settings'
    });
  })
);

/**
 * PUT /api/settings/scoring/job/:jobId
 * Create or update job-specific scoring preferences
 * Access: Admin and HR Manager only
 */
router.put(
  '/scoring/job/:jobId',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { jobId } = req.params;
    const user = req.user!;
    
    // Check permissions
    if (!user.isAdmin() && !user.isHRManager()) {
      return res.status(FORBIDDEN).json({
        success: false,
        message: 'Only Admin and HR Manager can update job scoring settings'
      });
    }
    
    const { weights, modifiers, personalityCategoryWeights } = req.body;
    
    // Get effective settings (job or global) for validation merge
    const effectiveSettings = await scoringPreferencesRepo.getEffectiveSettings(jobId, user.userId);
    
    // Merge with current values for validation
    const mergedWeights = weights ? { ...effectiveSettings.weights, ...weights } : effectiveSettings.weights;
    const mergedModifiers = modifiers ? { ...effectiveSettings.modifiers, ...modifiers } : effectiveSettings.modifiers;
    const mergedPersonalityWeights = personalityCategoryWeights 
      ? { ...effectiveSettings.personalityCategoryWeights, ...personalityCategoryWeights } 
      : effectiveSettings.personalityCategoryWeights;
    
    // Validate
    const validation = validateScoringPreferences(mergedWeights, mergedModifiers, mergedPersonalityWeights);
    if (!validation.valid) {
      return res.status(BAD_REQUEST).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }
    
    const updateData: UpdateScoringPreferencesData = {
      weights,
      modifiers,
      personalityCategoryWeights,
      lastModifiedBy: user.userId
    };
    
    const updated = await scoringPreferencesRepo.upsertJobSettings(jobId, updateData);
    
    // Audit log
    await AuditLogger.log({
      eventType: AuditEventType.JOB_UPDATED,
      userId: user.userId,
      userEmail: user.email,
      resource: 'scoring_settings',
      resourceId: jobId,
      action: 'update_job_scoring_settings',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        jobId,
        weightsChanged: !!weights,
        modifiersChanged: !!modifiers,
        personalityWeightsChanged: !!personalityCategoryWeights
      }
    });
    
    res.status(OK).json({
      success: true,
      message: 'Job scoring settings updated successfully',
      data: updated
    });
  })
);

/**
 * DELETE /api/settings/scoring/job/:jobId
 * Delete job-specific settings (revert to global)
 * Access: Admin and HR Manager only
 */
router.delete(
  '/scoring/job/:jobId',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { jobId } = req.params;
    const user = req.user!;
    
    // Check permissions
    if (!user.isAdmin() && !user.isHRManager()) {
      return res.status(FORBIDDEN).json({
        success: false,
        message: 'Only Admin and HR Manager can delete job scoring settings'
      });
    }
    
    const deleted = await scoringPreferencesRepo.deleteJobSettings(jobId);
    
    if (!deleted) {
      return res.status(NOT_FOUND).json({
        success: false,
        message: 'No job-specific settings found for this job'
      });
    }
    
    // Audit log
    await AuditLogger.log({
      eventType: AuditEventType.JOB_UPDATED,
      userId: user.userId,
      userEmail: user.email,
      resource: 'scoring_settings',
      resourceId: jobId,
      action: 'delete_job_scoring_settings',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        jobId,
        action: 'reverted_to_global'
      }
    });
    
    res.status(OK).json({
      success: true,
      message: 'Job scoring settings deleted, reverting to global settings'
    });
  })
);

/**
 * POST /api/settings/scoring/job/:jobId/copy-from-global
 * Copy global settings to create job-specific settings
 * Access: Admin and HR Manager only
 */
router.post(
  '/scoring/job/:jobId/copy-from-global',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { jobId } = req.params;
    const user = req.user!;
    
    // Check permissions
    if (!user.isAdmin() && !user.isHRManager()) {
      return res.status(FORBIDDEN).json({
        success: false,
        message: 'Only Admin and HR Manager can create job scoring settings'
      });
    }
    
    // Check if job settings already exist
    const existing = await scoringPreferencesRepo.hasJobSettings(jobId);
    if (existing) {
      return res.status(BAD_REQUEST).json({
        success: false,
        message: 'Job-specific settings already exist. Use PUT to update.'
      });
    }
    
    const copied = await scoringPreferencesRepo.copyGlobalToJob(jobId, user.userId);
    
    // Audit log
    await AuditLogger.log({
      eventType: AuditEventType.JOB_UPDATED,
      userId: user.userId,
      userEmail: user.email,
      resource: 'scoring_settings',
      resourceId: jobId,
      action: 'copy_global_to_job_scoring_settings',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        jobId,
        action: 'copied_from_global'
      }
    });
    
    res.status(CREATED).json({
      success: true,
      message: 'Global settings copied to job-specific settings',
      data: copied
    });
  })
);

/**
 * GET /api/settings/scoring/jobs-with-custom
 * Get list of jobs that have custom scoring settings
 * Access: Admin and HR Manager only
 */
router.get(
  '/scoring/jobs-with-custom',
  AuthMiddleware.authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    
    // Check permissions
    if (!user.isAdmin() && !user.isHRManager()) {
      return res.status(FORBIDDEN).json({
        success: false,
        message: 'Only Admin and HR Manager can view this'
      });
    }
    
    const jobIds = await scoringPreferencesRepo.getJobsWithCustomSettings();
    
    res.status(OK).json({
      success: true,
      data: jobIds,
      count: jobIds.length
    });
  })
);

router.use(errorHandler);
export default router;
