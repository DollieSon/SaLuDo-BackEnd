/**
 * Scoring Preferences Model
 * Manages customizable weight configurations for Predictive Success Score calculations
 * Supports global settings and per-job overrides
 */

import { PERSONALITY_CATEGORIES } from './PersonalityConstants';

// ============================================================================
// Enums
// ============================================================================

/**
 * Scope types for scoring preferences
 */
export enum ScoringPreferencesScope {
  GLOBAL = 'global',
  JOB = 'job'
}

// ============================================================================
// Core Weight Interfaces
// ============================================================================

/**
 * Main scoring weight categories (must sum to 100)
 */
export interface ScoringWeights {
  skillMatch: number;       // Weight for skill matching score (default: 35)
  personalityFit: number;   // Weight for personality assessment (default: 25)
  experience: number;       // Weight for experience evaluation (default: 20)
  education: number;        // Weight for education background (default: 10)
  profileQuality: number;   // Weight for profile completeness & certifications (default: 10)
}

/**
 * Modifier settings that adjust scoring calculations
 */
export interface ScoringModifiers {
  manualSkillBoost: number;     // Multiplier for manually-added skills vs resume-parsed (default: 1.2, range: 1.0-2.0)
  recencyBiasWeight: number;    // Weight applied to recent experience/certifications (default: 1.1, range: 1.0-1.5)
  recencyThresholdYears: number; // Years threshold for "recent" items (default: 2)
  missingSkillPenalty: number;  // Penalty per missing required skill in job mode (default: 5, range: 0-20)
  skillGapThreshold: number;    // Max acceptable gap for partial skill match (default: 2, range: 0-5)
}

/**
 * Personality category weights (must sum to 100)
 * Maps to PERSONALITY_CATEGORIES from PersonalityConstants
 */
export interface PersonalityCategoryWeights {
  cognitiveAndProblemSolving: number;  // 'Cognitive & Problem-Solving Traits' (default: 20)
  communicationAndTeamwork: number;    // 'Communication & Teamwork Traits' (default: 20)
  workEthicAndReliability: number;     // 'Work Ethic & Reliability Traits' (default: 20)
  growthAndLeadership: number;         // 'Growth & Leadership Traits' (default: 15)
  cultureAndPersonalityFit: number;    // 'Culture & Personality Fit Traits' (default: 15)
  bonusTraits: number;                 // 'Bonus Traits' (default: 10)
}

// ============================================================================
// Main Preferences Interface
// ============================================================================

/**
 * Complete Scoring Preferences configuration
 */
export interface ScoringPreferences {
  // Identifier
  preferencesId: string;
  
  // Scope: 'global' for organization-wide, or jobId for job-specific override
  scope: ScoringPreferencesScope;
  jobId?: string;  // Only set when scope is JOB
  
  // Core weights
  weights: ScoringWeights;
  
  // Calculation modifiers
  modifiers: ScoringModifiers;
  
  // Personality category sub-weights
  personalityCategoryWeights: PersonalityCategoryWeights;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;       // User ID who created
  lastModifiedBy: string;  // User ID who last modified
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default scoring weights (sum = 100)
 */
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  skillMatch: 35,
  personalityFit: 25,
  experience: 20,
  education: 10,
  profileQuality: 10
};

/**
 * Default scoring modifiers
 */
export const DEFAULT_SCORING_MODIFIERS: ScoringModifiers = {
  manualSkillBoost: 1.2,
  recencyBiasWeight: 1.1,
  recencyThresholdYears: 2,
  missingSkillPenalty: 5,
  skillGapThreshold: 2
};

/**
 * Default personality category weights (sum = 100)
 */
export const DEFAULT_PERSONALITY_CATEGORY_WEIGHTS: PersonalityCategoryWeights = {
  cognitiveAndProblemSolving: 20,
  communicationAndTeamwork: 20,
  workEthicAndReliability: 20,
  growthAndLeadership: 15,
  cultureAndPersonalityFit: 15,
  bonusTraits: 10
};

/**
 * Complete default preferences for new configurations
 */
export const DEFAULT_SCORING_PREFERENCES: Omit<ScoringPreferences, 'preferencesId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'lastModifiedBy'> = {
  scope: ScoringPreferencesScope.GLOBAL,
  weights: DEFAULT_SCORING_WEIGHTS,
  modifiers: DEFAULT_SCORING_MODIFIERS,
  personalityCategoryWeights: DEFAULT_PERSONALITY_CATEGORY_WEIGHTS
};

// ============================================================================
// Validation Constants
// ============================================================================

export const SCORING_VALIDATION = {
  WEIGHTS_SUM: 100,
  PERSONALITY_WEIGHTS_SUM: 100,
  MANUAL_SKILL_BOOST_MIN: 1.0,
  MANUAL_SKILL_BOOST_MAX: 2.0,
  RECENCY_BIAS_MIN: 1.0,
  RECENCY_BIAS_MAX: 1.5,
  RECENCY_THRESHOLD_MIN: 1,
  RECENCY_THRESHOLD_MAX: 10,
  MISSING_SKILL_PENALTY_MIN: 0,
  MISSING_SKILL_PENALTY_MAX: 20,
  SKILL_GAP_THRESHOLD_MIN: 0,
  SKILL_GAP_THRESHOLD_MAX: 5
} as const;

// ============================================================================
// DTO Interfaces
// ============================================================================

/**
 * Data for creating scoring preferences
 */
export interface CreateScoringPreferencesData {
  scope: ScoringPreferencesScope;
  jobId?: string;
  weights?: Partial<ScoringWeights>;
  modifiers?: Partial<ScoringModifiers>;
  personalityCategoryWeights?: Partial<PersonalityCategoryWeights>;
  createdBy: string;
}

/**
 * Data for updating scoring preferences
 */
export interface UpdateScoringPreferencesData {
  weights?: Partial<ScoringWeights>;
  modifiers?: Partial<ScoringModifiers>;
  personalityCategoryWeights?: Partial<PersonalityCategoryWeights>;
  lastModifiedBy: string;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates that scoring weights sum to 100
 */
export function validateScoringWeights(weights: ScoringWeights): { valid: boolean; sum: number; error?: string } {
  const sum = weights.skillMatch + weights.personalityFit + weights.experience + weights.education + weights.profileQuality;
  
  if (sum !== SCORING_VALIDATION.WEIGHTS_SUM) {
    return {
      valid: false,
      sum,
      error: `Scoring weights must sum to ${SCORING_VALIDATION.WEIGHTS_SUM}. Current sum: ${sum}`
    };
  }
  
  // Check for negative values
  const values = Object.values(weights);
  if (values.some(v => v < 0)) {
    return {
      valid: false,
      sum,
      error: 'Scoring weights cannot be negative'
    };
  }
  
  return { valid: true, sum };
}

/**
 * Validates that personality category weights sum to 100
 */
export function validatePersonalityCategoryWeights(weights: PersonalityCategoryWeights): { valid: boolean; sum: number; error?: string } {
  const sum = weights.cognitiveAndProblemSolving + 
              weights.communicationAndTeamwork + 
              weights.workEthicAndReliability + 
              weights.growthAndLeadership + 
              weights.cultureAndPersonalityFit + 
              weights.bonusTraits;
  
  if (sum !== SCORING_VALIDATION.PERSONALITY_WEIGHTS_SUM) {
    return {
      valid: false,
      sum,
      error: `Personality category weights must sum to ${SCORING_VALIDATION.PERSONALITY_WEIGHTS_SUM}. Current sum: ${sum}`
    };
  }
  
  // Check for negative values
  const values = Object.values(weights);
  if (values.some(v => v < 0)) {
    return {
      valid: false,
      sum,
      error: 'Personality category weights cannot be negative'
    };
  }
  
  return { valid: true, sum };
}

/**
 * Validates scoring modifiers are within acceptable ranges
 */
export function validateScoringModifiers(modifiers: ScoringModifiers): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (modifiers.manualSkillBoost < SCORING_VALIDATION.MANUAL_SKILL_BOOST_MIN || 
      modifiers.manualSkillBoost > SCORING_VALIDATION.MANUAL_SKILL_BOOST_MAX) {
    errors.push(`Manual skill boost must be between ${SCORING_VALIDATION.MANUAL_SKILL_BOOST_MIN} and ${SCORING_VALIDATION.MANUAL_SKILL_BOOST_MAX}`);
  }
  
  if (modifiers.recencyBiasWeight < SCORING_VALIDATION.RECENCY_BIAS_MIN || 
      modifiers.recencyBiasWeight > SCORING_VALIDATION.RECENCY_BIAS_MAX) {
    errors.push(`Recency bias weight must be between ${SCORING_VALIDATION.RECENCY_BIAS_MIN} and ${SCORING_VALIDATION.RECENCY_BIAS_MAX}`);
  }
  
  if (modifiers.recencyThresholdYears < SCORING_VALIDATION.RECENCY_THRESHOLD_MIN || 
      modifiers.recencyThresholdYears > SCORING_VALIDATION.RECENCY_THRESHOLD_MAX) {
    errors.push(`Recency threshold must be between ${SCORING_VALIDATION.RECENCY_THRESHOLD_MIN} and ${SCORING_VALIDATION.RECENCY_THRESHOLD_MAX} years`);
  }
  
  if (modifiers.missingSkillPenalty < SCORING_VALIDATION.MISSING_SKILL_PENALTY_MIN || 
      modifiers.missingSkillPenalty > SCORING_VALIDATION.MISSING_SKILL_PENALTY_MAX) {
    errors.push(`Missing skill penalty must be between ${SCORING_VALIDATION.MISSING_SKILL_PENALTY_MIN} and ${SCORING_VALIDATION.MISSING_SKILL_PENALTY_MAX}`);
  }
  
  if (modifiers.skillGapThreshold < SCORING_VALIDATION.SKILL_GAP_THRESHOLD_MIN || 
      modifiers.skillGapThreshold > SCORING_VALIDATION.SKILL_GAP_THRESHOLD_MAX) {
    errors.push(`Skill gap threshold must be between ${SCORING_VALIDATION.SKILL_GAP_THRESHOLD_MIN} and ${SCORING_VALIDATION.SKILL_GAP_THRESHOLD_MAX}`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates complete scoring preferences
 */
export function validateScoringPreferences(
  weights: ScoringWeights,
  modifiers: ScoringModifiers,
  personalityCategoryWeights: PersonalityCategoryWeights
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const weightsValidation = validateScoringWeights(weights);
  if (!weightsValidation.valid && weightsValidation.error) {
    errors.push(weightsValidation.error);
  }
  
  const personalityValidation = validatePersonalityCategoryWeights(personalityCategoryWeights);
  if (!personalityValidation.valid && personalityValidation.error) {
    errors.push(personalityValidation.error);
  }
  
  const modifiersValidation = validateScoringModifiers(modifiers);
  errors.push(...modifiersValidation.errors);
  
  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Maps personality category key to display name
 */
export const PERSONALITY_CATEGORY_KEY_TO_NAME: Record<keyof PersonalityCategoryWeights, string> = {
  cognitiveAndProblemSolving: 'Cognitive & Problem-Solving Traits',
  communicationAndTeamwork: 'Communication & Teamwork Traits',
  workEthicAndReliability: 'Work Ethic & Reliability Traits',
  growthAndLeadership: 'Growth & Leadership Traits',
  cultureAndPersonalityFit: 'Culture & Personality Fit Traits',
  bonusTraits: 'Bonus Traits'
};

/**
 * Maps personality category display name to key
 */
export const PERSONALITY_CATEGORY_NAME_TO_KEY: Record<string, keyof PersonalityCategoryWeights> = {
  'Cognitive & Problem-Solving Traits': 'cognitiveAndProblemSolving',
  'Communication & Teamwork Traits': 'communicationAndTeamwork',
  'Work Ethic & Reliability Traits': 'workEthicAndReliability',
  'Growth & Leadership Traits': 'growthAndLeadership',
  'Culture & Personality Fit Traits': 'cultureAndPersonalityFit',
  'Bonus Traits': 'bonusTraits'
};

/**
 * Merges partial weights with defaults
 */
export function mergeWithDefaults(
  partial: Partial<ScoringWeights> | undefined,
  defaults: ScoringWeights
): ScoringWeights {
  return {
    skillMatch: partial?.skillMatch ?? defaults.skillMatch,
    personalityFit: partial?.personalityFit ?? defaults.personalityFit,
    experience: partial?.experience ?? defaults.experience,
    education: partial?.education ?? defaults.education,
    profileQuality: partial?.profileQuality ?? defaults.profileQuality
  };
}

/**
 * Merges partial modifiers with defaults
 */
export function mergeModifiersWithDefaults(
  partial: Partial<ScoringModifiers> | undefined,
  defaults: ScoringModifiers
): ScoringModifiers {
  return {
    manualSkillBoost: partial?.manualSkillBoost ?? defaults.manualSkillBoost,
    recencyBiasWeight: partial?.recencyBiasWeight ?? defaults.recencyBiasWeight,
    recencyThresholdYears: partial?.recencyThresholdYears ?? defaults.recencyThresholdYears,
    missingSkillPenalty: partial?.missingSkillPenalty ?? defaults.missingSkillPenalty,
    skillGapThreshold: partial?.skillGapThreshold ?? defaults.skillGapThreshold
  };
}

/**
 * Merges partial personality category weights with defaults
 */
export function mergePersonalityWeightsWithDefaults(
  partial: Partial<PersonalityCategoryWeights> | undefined,
  defaults: PersonalityCategoryWeights
): PersonalityCategoryWeights {
  return {
    cognitiveAndProblemSolving: partial?.cognitiveAndProblemSolving ?? defaults.cognitiveAndProblemSolving,
    communicationAndTeamwork: partial?.communicationAndTeamwork ?? defaults.communicationAndTeamwork,
    workEthicAndReliability: partial?.workEthicAndReliability ?? defaults.workEthicAndReliability,
    growthAndLeadership: partial?.growthAndLeadership ?? defaults.growthAndLeadership,
    cultureAndPersonalityFit: partial?.cultureAndPersonalityFit ?? defaults.cultureAndPersonalityFit,
    bonusTraits: partial?.bonusTraits ?? defaults.bonusTraits
  };
}
