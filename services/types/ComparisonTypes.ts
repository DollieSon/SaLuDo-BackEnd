// =======================
// CANDIDATE COMPARISON TYPES
// =======================
// Purpose: Common interfaces and types for candidate comparison functionality
// Related: CandidateComparisonService, CandidateService
// =======================

import { CandidateData } from '../../Models/Candidate';

/**
 * Complete candidate comparison data structure (actual implementation)
 */
export interface CandidateComparisonData {
  candidate1: CandidateData;
  candidate2: CandidateData;
  comparison: {
    personalInfo: {
      ageComparison: {
        candidate1Age: number;
        candidate2Age: number;
        ageDifference: number;
      };
      experienceComparison: {
        candidate1Experience: number;
        candidate2Experience: number;
        experienceDifference: number;
      };
      certificationComparison: {
        candidate1Certification: number;
        candidate2Certification: number;
        certificationDifference: number;
      };
    };
    skills: {
      commonSkills: any[]; // SkillWithMasterData from Models
      uniqueToCandidate1: any[];
      uniqueToCandidate2: any[];
      skillScoreComparison: {
        skillName: string;
        candidate1Score: number;
        candidate2Score: number;
        scoreDifference: number;
      }[];
    };
    personality: {
      candidate1PersonalityScore: number;
      candidate2PersonalityScore: number;
      personalityDifference: number;
      categoryComparisons: {
        category: string;
        candidate1Score: number;
        candidate2Score: number;
        difference: number;
      }[];
    };
    overallComparison: {
      totalSkillsComparison: {
        candidate1Total: number;
        candidate2Total: number;
        difference: number;
      };
      averageSkillScoreComparison: {
        candidate1Average: number;
        candidate2Average: number;
        difference: number;
      };
      recommendedCandidate: "candidate1" | "candidate2" | "tie";
      recommendation: string;
    };
  };
}

/**
 * Individual skill comparison between candidates
 */
export interface SkillComparison {
  skillName: string;
  masterSkillId?: string;
  candidate1Score: number;
  candidate2Score: number;
  scoreDifference: number;
  winner: string;
  importance: number;
  evidence: {
    candidate1Evidence: string;
    candidate2Evidence: string;
  };
}

/**
 * Personality traits comparison between candidates
 */
export interface PersonalityComparison {
  openness: TraitComparison;
  conscientiousness: TraitComparison;
  extraversion: TraitComparison;
  agreeableness: TraitComparison;
  neuroticism: TraitComparison;
  overallMatch: {
    candidate1Personality: string;
    candidate2Personality: string;
    compatibility: number;
  };
}

/**
 * Individual personality trait comparison
 */
export interface TraitComparison {
  candidate1Score: number;
  candidate2Score: number;
  scoreDifference: number;
  winner: string;
  interpretation: string;
}

/**
 * Comparison filtering options
 */
export interface ComparisonFilter {
  includeSkills?: boolean;
  includePersonality?: boolean;
  includeExperience?: boolean;
  skillWeightings?: { [skillName: string]: number };
  minimumSkillScore?: number;
}

/**
 * Comparison scoring configuration
 */
export interface ComparisonScoringConfig {
  skillWeight: number;
  personalityWeight: number;
  experienceWeight: number;
  educationWeight: number;
  strengthWeight: number;
}