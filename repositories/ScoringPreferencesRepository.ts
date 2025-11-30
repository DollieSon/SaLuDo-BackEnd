/**
 * Scoring Preferences Repository
 * Data access layer for scoring weight configuration operations
 * Supports global settings and per-job overrides
 */

import { Collection, Db } from 'mongodb';
import {
  ScoringPreferences,
  ScoringPreferencesScope,
  CreateScoringPreferencesData,
  UpdateScoringPreferencesData,
  DEFAULT_SCORING_PREFERENCES,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_SCORING_MODIFIERS,
  DEFAULT_PERSONALITY_CATEGORY_WEIGHTS,
  ScoringWeights,
  ScoringModifiers,
  PersonalityCategoryWeights,
  validateScoringPreferences,
  mergeWithDefaults,
  mergeModifiersWithDefaults,
  mergePersonalityWeightsWithDefaults
} from '../Models/ScoringPreferences';

const COLLECTION_NAME = 'scoringSettings';

export class ScoringPreferencesRepository {
  private collection: Collection;
  private db: Db;

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection(COLLECTION_NAME);
  }

  /**
   * Generate a unique ID for preferences
   */
  private generateId(): string {
    const { ObjectId } = require('mongodb');
    return new ObjectId().toString();
  }

  // ============================================================================
  // Create Operations
  // ============================================================================

  /**
   * Create new scoring preferences
   */
  async create(data: CreateScoringPreferencesData): Promise<ScoringPreferences> {
    const now = new Date();

    // Merge provided values with defaults
    const weights = mergeWithDefaults(data.weights, DEFAULT_SCORING_WEIGHTS);
    const modifiers = mergeModifiersWithDefaults(data.modifiers, DEFAULT_SCORING_MODIFIERS);
    const personalityCategoryWeights = mergePersonalityWeightsWithDefaults(
      data.personalityCategoryWeights,
      DEFAULT_PERSONALITY_CATEGORY_WEIGHTS
    );

    // Validate before saving
    const validation = validateScoringPreferences(weights, modifiers, personalityCategoryWeights);
    if (!validation.valid) {
      throw new Error(`Invalid scoring preferences: ${validation.errors.join(', ')}`);
    }

    const preferences: ScoringPreferences = {
      preferencesId: this.generateId(),
      scope: data.scope,
      jobId: data.scope === ScoringPreferencesScope.JOB ? data.jobId : undefined,
      weights,
      modifiers,
      personalityCategoryWeights,
      createdAt: now,
      updatedAt: now,
      createdBy: data.createdBy,
      lastModifiedBy: data.createdBy
    };

    await this.collection.insertOne(preferences);
    return preferences;
  }

  // ============================================================================
  // Read Operations
  // ============================================================================

  /**
   * Get global scoring settings
   */
  async getGlobalSettings(): Promise<ScoringPreferences | null> {
    return await this.collection.findOne({
      scope: ScoringPreferencesScope.GLOBAL
    }) as ScoringPreferences | null;
  }

  /**
   * Get global settings or create with defaults if not exists
   */
  async getOrCreateGlobalSettings(createdBy: string): Promise<ScoringPreferences> {
    let settings = await this.getGlobalSettings();

    if (!settings) {
      settings = await this.create({
        scope: ScoringPreferencesScope.GLOBAL,
        createdBy
      });
    }

    return settings;
  }

  /**
   * Get job-specific scoring settings
   */
  async getJobSettings(jobId: string): Promise<ScoringPreferences | null> {
    return await this.collection.findOne({
      scope: ScoringPreferencesScope.JOB,
      jobId
    }) as ScoringPreferences | null;
  }

  /**
   * Get effective settings for a job (job-specific if exists, otherwise global)
   */
  async getEffectiveSettings(jobId?: string, createdBy?: string): Promise<ScoringPreferences> {
    // If jobId provided, check for job-specific settings first
    if (jobId) {
      const jobSettings = await this.getJobSettings(jobId);
      if (jobSettings) {
        return jobSettings;
      }
    }

    // Fall back to global settings
    return await this.getOrCreateGlobalSettings(createdBy || 'system');
  }

  /**
   * Get settings by ID
   */
  async getById(preferencesId: string): Promise<ScoringPreferences | null> {
    return await this.collection.findOne({
      preferencesId
    }) as ScoringPreferences | null;
  }

  /**
   * Get all job-specific settings
   */
  async getAllJobSettings(): Promise<ScoringPreferences[]> {
    return await this.collection.find({
      scope: ScoringPreferencesScope.JOB
    }).toArray() as unknown as ScoringPreferences[];
  }

  /**
   * Check if job-specific settings exist
   */
  async hasJobSettings(jobId: string): Promise<boolean> {
    const count = await this.collection.countDocuments({
      scope: ScoringPreferencesScope.JOB,
      jobId
    });
    return count > 0;
  }

  // ============================================================================
  // Update Operations
  // ============================================================================

  /**
   * Update global settings
   */
  async updateGlobalSettings(data: UpdateScoringPreferencesData): Promise<ScoringPreferences | null> {
    return await this.updateByScope(ScoringPreferencesScope.GLOBAL, undefined, data);
  }

  /**
   * Update job-specific settings
   */
  async updateJobSettings(jobId: string, data: UpdateScoringPreferencesData): Promise<ScoringPreferences | null> {
    return await this.updateByScope(ScoringPreferencesScope.JOB, jobId, data);
  }

  /**
   * Create or update job-specific settings
   */
  async upsertJobSettings(
    jobId: string,
    data: UpdateScoringPreferencesData
  ): Promise<ScoringPreferences> {
    const existing = await this.getJobSettings(jobId);

    if (existing) {
      const updated = await this.updateJobSettings(jobId, data);
      if (!updated) {
        throw new Error(`Failed to update job settings for jobId: ${jobId}`);
      }
      return updated;
    }

    // Create new job-specific settings
    return await this.create({
      scope: ScoringPreferencesScope.JOB,
      jobId,
      weights: data.weights as Partial<ScoringWeights>,
      modifiers: data.modifiers as Partial<ScoringModifiers>,
      personalityCategoryWeights: data.personalityCategoryWeights as Partial<PersonalityCategoryWeights>,
      createdBy: data.lastModifiedBy
    });
  }

  /**
   * Update settings by scope
   */
  private async updateByScope(
    scope: ScoringPreferencesScope,
    jobId: string | undefined,
    data: UpdateScoringPreferencesData
  ): Promise<ScoringPreferences | null> {
    // Get current settings to merge with
    const query = scope === ScoringPreferencesScope.GLOBAL
      ? { scope: ScoringPreferencesScope.GLOBAL }
      : { scope: ScoringPreferencesScope.JOB, jobId };

    const current = await this.collection.findOne(query) as ScoringPreferences | null;
    if (!current) {
      return null;
    }

    // Merge updates with current values
    const weights = data.weights
      ? mergeWithDefaults(data.weights, current.weights)
      : current.weights;

    const modifiers = data.modifiers
      ? mergeModifiersWithDefaults(data.modifiers, current.modifiers)
      : current.modifiers;

    const personalityCategoryWeights = data.personalityCategoryWeights
      ? mergePersonalityWeightsWithDefaults(data.personalityCategoryWeights, current.personalityCategoryWeights)
      : current.personalityCategoryWeights;

    // Validate merged values
    const validation = validateScoringPreferences(weights, modifiers, personalityCategoryWeights);
    if (!validation.valid) {
      throw new Error(`Invalid scoring preferences: ${validation.errors.join(', ')}`);
    }

    const updateData = {
      weights,
      modifiers,
      personalityCategoryWeights,
      updatedAt: new Date(),
      lastModifiedBy: data.lastModifiedBy
    };

    const result = await this.collection.findOneAndUpdate(
      query,
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result as ScoringPreferences | null;
  }

  /**
   * Update specific weight values
   */
  async updateWeights(
    scope: ScoringPreferencesScope,
    jobId: string | undefined,
    weights: Partial<ScoringWeights>,
    lastModifiedBy: string
  ): Promise<ScoringPreferences | null> {
    return await this.updateByScope(scope, jobId, {
      weights,
      lastModifiedBy
    });
  }

  /**
   * Update specific modifier values
   */
  async updateModifiers(
    scope: ScoringPreferencesScope,
    jobId: string | undefined,
    modifiers: Partial<ScoringModifiers>,
    lastModifiedBy: string
  ): Promise<ScoringPreferences | null> {
    return await this.updateByScope(scope, jobId, {
      modifiers,
      lastModifiedBy
    });
  }

  /**
   * Update personality category weights
   */
  async updatePersonalityCategoryWeights(
    scope: ScoringPreferencesScope,
    jobId: string | undefined,
    personalityCategoryWeights: Partial<PersonalityCategoryWeights>,
    lastModifiedBy: string
  ): Promise<ScoringPreferences | null> {
    return await this.updateByScope(scope, jobId, {
      personalityCategoryWeights,
      lastModifiedBy
    });
  }

  // ============================================================================
  // Reset Operations
  // ============================================================================

  /**
   * Reset global settings to defaults
   */
  async resetGlobalToDefaults(lastModifiedBy: string): Promise<ScoringPreferences | null> {
    const query = { scope: ScoringPreferencesScope.GLOBAL };

    const updateData = {
      weights: DEFAULT_SCORING_WEIGHTS,
      modifiers: DEFAULT_SCORING_MODIFIERS,
      personalityCategoryWeights: DEFAULT_PERSONALITY_CATEGORY_WEIGHTS,
      updatedAt: new Date(),
      lastModifiedBy
    };

    const result = await this.collection.findOneAndUpdate(
      query,
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result as ScoringPreferences | null;
  }

  /**
   * Reset job-specific settings to match global (or delete)
   */
  async resetJobToGlobal(jobId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({
      scope: ScoringPreferencesScope.JOB,
      jobId
    });
    return result.deletedCount > 0;
  }

  // ============================================================================
  // Delete Operations
  // ============================================================================

  /**
   * Delete job-specific settings
   */
  async deleteJobSettings(jobId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({
      scope: ScoringPreferencesScope.JOB,
      jobId
    });
    return result.deletedCount > 0;
  }

  /**
   * Delete settings by ID
   */
  async deleteById(preferencesId: string): Promise<boolean> {
    // Prevent deletion of global settings
    const settings = await this.getById(preferencesId);
    if (settings?.scope === ScoringPreferencesScope.GLOBAL) {
      throw new Error('Cannot delete global scoring settings. Use reset instead.');
    }

    const result = await this.collection.deleteOne({ preferencesId });
    return result.deletedCount > 0;
  }

  // ============================================================================
  // Utility Operations
  // ============================================================================

  /**
   * Copy global settings to a job-specific configuration
   */
  async copyGlobalToJob(jobId: string, createdBy: string): Promise<ScoringPreferences> {
    const globalSettings = await this.getOrCreateGlobalSettings(createdBy);

    // Check if job settings already exist
    const existingJobSettings = await this.getJobSettings(jobId);
    if (existingJobSettings) {
      throw new Error(`Job-specific settings already exist for jobId: ${jobId}`);
    }

    return await this.create({
      scope: ScoringPreferencesScope.JOB,
      jobId,
      weights: globalSettings.weights,
      modifiers: globalSettings.modifiers,
      personalityCategoryWeights: globalSettings.personalityCategoryWeights,
      createdBy
    });
  }

  /**
   * Get list of jobs with custom scoring settings
   */
  async getJobsWithCustomSettings(): Promise<string[]> {
    const jobSettings = await this.getAllJobSettings();
    return jobSettings
      .filter(s => s.jobId)
      .map(s => s.jobId as string);
  }

  /**
   * Ensure indexes exist for efficient queries
   */
  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ scope: 1 });
    await this.collection.createIndex({ scope: 1, jobId: 1 }, { unique: true, sparse: true });
    await this.collection.createIndex({ preferencesId: 1 }, { unique: true });
  }
}
