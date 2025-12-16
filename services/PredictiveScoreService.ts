/**
 * Predictive Score Service
 * Calculates success scores for candidates based on customizable weights
 * Supports both job-specific matching and general candidate strength evaluation
 */

import { Db, ObjectId } from 'mongodb';
import { connectDB } from '../mongo_db';
import { CandidateService } from './CandidateService';
import { JobService } from './JobService';
import { ScoringPreferencesRepository } from '../repositories/ScoringPreferencesRepository';
import { SkillMasterRepository } from '../repositories/SkillMasterRepository';
import { PersonalInfoRepository } from '../repositories/CandidateRepository';
import {
  ScoringPreferences,
  ScoringWeights,
  ScoringModifiers,
  PersonalityCategoryWeights,
  PERSONALITY_CATEGORY_NAME_TO_KEY
} from '../Models/ScoringPreferences';
import { CandidateData } from '../Models/Candidate';
import { JobData, JobSkillRequirement } from '../Models/JobTypes';
import { PersonalityData } from '../Models/PersonalityTypes';
import { SkillData, AddedBy } from '../Models/Skill';
import { AuditLogger } from '../utils/AuditLogger';
import { AuditEventType } from '../types/AuditEventTypes';
import { GeminiClientService } from './GeminiClientService';
import { AIServiceType } from '../Models/AIMetrics';

// ============================================================================
// Result Interfaces
// ============================================================================

/**
 * Breakdown of score by category
 */
export interface ScoreBreakdown {
  skillMatch: number;       // 0-100 scaled contribution
  personalityFit: number;   // 0-100 scaled contribution
  experience: number;       // 0-100 scaled contribution
  education: number;        // 0-100 scaled contribution
  profileQuality: number;   // 0-100 scaled contribution
}

/**
 * Detailed skill match information
 */
export interface SkillMatchDetail {
  skillId: string;
  skillName: string;
  candidateScore: number;
  requiredLevel?: number;      // Only for job-specific
  gap?: number;                // Difference (negative = below requirement)
  isPartialMatch?: boolean;    // Within gap threshold
  isManuallyAdded: boolean;
  appliedBoost: number;        // Multiplier applied (1.0 or manualSkillBoost)
}

/**
 * Personality category score details
 */
export interface PersonalityCategoryDetail {
  category: string;
  categoryKey: string;
  score: number;              // 0-10 average
  weight: number;             // Applied weight percentage
  weightedScore: number;      // score * (weight/100)
  traitCount: number;
}

/**
 * Contributing factors to the score
 */
export interface ScoreFactors {
  positiveFactors: string[];
  negativeFactors: string[];
  recommendations: string[];
}

/**
 * Complete predictive score result
 */
export interface PredictiveScoreResult {
  candidateId: string;
  jobId?: string;
  
  // Core scores
  overallScore: number;           // 0-100
  breakdown: ScoreBreakdown;
  confidence: number;             // 0-100 based on profile completeness
  
  // Detailed information
  skillMatchDetails: SkillMatchDetail[];
  personalityDetails: PersonalityCategoryDetail[];
  factors: ScoreFactors;
  
  // Penalties applied
  missingSkillsPenalty: number;
  missingSkills: string[];
  
  // Metadata
  mode: 'job-specific' | 'general';
  calculatedAt: Date;
  weightsUsed: ScoringWeights;
  modifiersUsed: ScoringModifiers;
}

/**
 * Score history entry for tracking over time
 */
export interface ScoreHistoryEntry {
  historyId: string;
  candidateId: string;
  jobId?: string;
  overallScore: number;
  breakdown: ScoreBreakdown;
  confidence: number;
  scoringSettingsId: string; // References the ScoringPreferences used for calculation
  scoringSettingsName: string; // Human-readable name (e.g., "Global Settings" or "Job-specific: Software Engineer")
  calculatedAt: Date;
  calculatedBy?: string;
}

/**
 * AI-generated insights
 */
export interface AIInsights {
  summary: string;
  strengths: string[];
  areasForDevelopment: string[];
  cultureFitAssessment: string;
  recommendations: string[];
  generatedAt: Date;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class PredictiveScoreService {
  private db: Db | null = null;
  private candidateService: CandidateService;
  private jobService: JobService;
  private scoringPreferencesRepo: ScoringPreferencesRepository | null = null;
  private skillMasterRepo: SkillMasterRepository | null = null;
  private personalInfoRepo: PersonalInfoRepository | null = null;

  constructor() {
    this.candidateService = new CandidateService();
    this.jobService = new JobService();
  }

  /**
   * Initialize database connections
   */
  private async init(): Promise<void> {
    if (!this.db) {
      this.db = await connectDB();
      this.scoringPreferencesRepo = new ScoringPreferencesRepository(this.db);
      this.skillMasterRepo = new SkillMasterRepository(this.db);
      this.personalInfoRepo = new PersonalInfoRepository(this.db);
    }
  }

  // ============================================================================
  // Main Score Calculation
  // ============================================================================

  /**
   * Calculate predictive success score for a candidate
   * @param candidateId - Candidate to score
   * @param jobId - Optional job ID for job-specific scoring
   * @param userId - User requesting the score (for audit)
   */
  async calculateScore(
    candidateId: string,
    jobId?: string,
    userId?: string
  ): Promise<PredictiveScoreResult> {
    await this.init();

    // Fetch candidate data
    const candidate = await this.candidateService.getCandidate(candidateId);
    if (!candidate) {
      throw new Error(`Candidate not found: ${candidateId}`);
    }

    // If no explicit jobId provided, use candidate's roleApplied (the job they're applying for)
    // This ensures candidates are scored against their applied job's specific settings
    let effectiveJobId = jobId;
    if (!effectiveJobId && candidate.roleApplied) {
      effectiveJobId = candidate.roleApplied;
    }

    // Fetch personality data
    const personality = await this.candidateService.getCandidatePersonality(candidateId);

    // Fetch job data if job-specific
    let job: JobData | null = null;
    if (effectiveJobId) {
      job = await this.jobService.getJob(effectiveJobId);
      if (!job && jobId) {
        // Only throw error if jobId was explicitly provided
        throw new Error(`Job not found: ${jobId}`);
      }
      // If job came from roleApplied and wasn't found, continue with general scoring
      if (!job) {
        effectiveJobId = undefined;
      }
    }

    // Get effective scoring preferences (job-specific or global)
    const preferences = await this.scoringPreferencesRepo!.getEffectiveSettings(effectiveJobId, userId);

    // Calculate each component score
    const skillMatchResult = await this.calculateSkillMatchScore(
      candidate,
      job,
      preferences.weights,
      preferences.modifiers
    );

    const personalityResult = this.calculatePersonalityScore(
      personality,
      preferences.weights,
      preferences.personalityCategoryWeights
    );

    const experienceScore = this.calculateExperienceScore(
      candidate,
      preferences.weights,
      preferences.modifiers
    );

    const educationScore = this.calculateEducationScore(
      candidate,
      preferences.weights,
      preferences.modifiers
    );

    const profileQualityScore = this.calculateProfileQualityScore(
      candidate,
      preferences.weights
    );

    // Calculate confidence based on profile completeness
    const confidence = this.calculateConfidence(candidate, personality);

    // Build breakdown
    const breakdown: ScoreBreakdown = {
      skillMatch: skillMatchResult.weightedScore,
      personalityFit: personalityResult.weightedScore,
      experience: experienceScore,
      education: educationScore,
      profileQuality: profileQualityScore
    };

    // Calculate overall score (sum of weighted components)
    const overallScore = Math.min(100, Math.max(0,
      breakdown.skillMatch +
      breakdown.personalityFit +
      breakdown.experience +
      breakdown.education +
      breakdown.profileQuality -
      skillMatchResult.penalty
    ));

    // Generate factors
    const factors = this.generateFactors(
      candidate,
      skillMatchResult,
      personalityResult,
      job
    );

    const result: PredictiveScoreResult = {
      candidateId,
      jobId: effectiveJobId,
      overallScore: Number(overallScore.toFixed(1)),
      breakdown,
      confidence,
      skillMatchDetails: skillMatchResult.details,
      personalityDetails: personalityResult.details,
      factors,
      missingSkillsPenalty: skillMatchResult.penalty,
      missingSkills: skillMatchResult.missingSkills,
      mode: effectiveJobId ? 'job-specific' : 'general',
      calculatedAt: new Date(),
      weightsUsed: preferences.weights,
      modifiersUsed: preferences.modifiers
    };

    // Save to history with scoring settings ID and job name
    const jobName = job?.jobName;
    await this.saveScoreHistory(result, userId, preferences.preferencesId, jobName);

    return result;
  }

  // ============================================================================
  // Component Score Calculations
  // ============================================================================

  /**
   * Calculate skill match score
   */
  private async calculateSkillMatchScore(
    candidate: CandidateData,
    job: JobData | null,
    weights: ScoringWeights,
    modifiers: ScoringModifiers
  ): Promise<{
    weightedScore: number;
    details: SkillMatchDetail[];
    penalty: number;
    missingSkills: string[];
  }> {
    const candidateSkills = candidate.skills || [];
    const details: SkillMatchDetail[] = [];
    const missingSkills: string[] = [];
    let totalScore = 0;
    let maxPossibleScore = 0;
    let penalty = 0;

    // Build skill name map
    const skillNameMap = new Map<string, string>();
    for (const skill of candidateSkills) {
      try {
        const masterSkill = await this.skillMasterRepo!.findById(skill.skillId);
        if (masterSkill) {
          skillNameMap.set(skill.skillId, masterSkill.skillName);
        }
      } catch (e) {
        skillNameMap.set(skill.skillId, skill.skillId);
      }
    }

    if (job && job.skills && job.skills.length > 0) {
      // Job-specific scoring: compare against job requirements
      const activeJobSkills = job.skills.filter(s => !s.isDeleted);
      const candidateSkillMap = new Map(candidateSkills.map(s => [s.skillId, s]));

      for (const jobSkill of activeJobSkills) {
        const candidateSkill = candidateSkillMap.get(jobSkill.skillId);
        const skillName = skillNameMap.get(jobSkill.skillId) || jobSkill.skillId;

        if (candidateSkill) {
          // Candidate has this skill
          const isManual = candidateSkill.addedBy === AddedBy.HUMAN;
          const boost = isManual ? modifiers.manualSkillBoost : 1.0;
          const boostedScore = Math.min(10, candidateSkill.score * boost);
          const gap = boostedScore - jobSkill.requiredLevel;
          const isPartialMatch = gap < 0 && Math.abs(gap) <= modifiers.skillGapThreshold;

          details.push({
            skillId: jobSkill.skillId,
            skillName,
            candidateScore: candidateSkill.score,
            requiredLevel: jobSkill.requiredLevel,
            gap,
            isPartialMatch,
            isManuallyAdded: isManual,
            appliedBoost: boost
          });

          // Score contribution: ratio of candidate score to required level
          const matchRatio = isPartialMatch 
            ? 0.5 + (0.5 * (1 - Math.abs(gap) / modifiers.skillGapThreshold))
            : Math.min(1, boostedScore / jobSkill.requiredLevel);

          totalScore += matchRatio * jobSkill.requiredLevel;
          maxPossibleScore += jobSkill.requiredLevel;
        } else {
          // Missing required skill
          missingSkills.push(skillName);
          penalty += modifiers.missingSkillPenalty;
          maxPossibleScore += jobSkill.requiredLevel;

          details.push({
            skillId: jobSkill.skillId,
            skillName,
            candidateScore: 0,
            requiredLevel: jobSkill.requiredLevel,
            gap: -jobSkill.requiredLevel,
            isPartialMatch: false,
            isManuallyAdded: false,
            appliedBoost: 1.0
          });
        }
      }
    } else {
      // General scoring: evaluate all candidate skills
      for (const skill of candidateSkills) {
        if (skill.isDeleted) continue;

        const isManual = skill.addedBy === AddedBy.HUMAN;
        const boost = isManual ? modifiers.manualSkillBoost : 1.0;
        const boostedScore = Math.min(10, skill.score * boost);
        const skillName = skillNameMap.get(skill.skillId) || skill.skillId;

        details.push({
          skillId: skill.skillId,
          skillName,
          candidateScore: skill.score,
          isManuallyAdded: isManual,
          appliedBoost: boost
        });

        totalScore += boostedScore;
        maxPossibleScore += 10; // Max possible per skill
      }
    }

    // Calculate weighted score (0-100 scale, then apply weight)
    const rawScore = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    const weightedScore = (rawScore * weights.skillMatch) / 100;

    return {
      weightedScore: Number(weightedScore.toFixed(2)),
      details,
      penalty: Math.min(penalty, 20), // Cap penalty
      missingSkills
    };
  }

  /**
   * Calculate personality fit score
   */
  private calculatePersonalityScore(
    personality: PersonalityData | null,
    weights: ScoringWeights,
    categoryWeights: PersonalityCategoryWeights
  ): {
    weightedScore: number;
    details: PersonalityCategoryDetail[];
  } {
    const details: PersonalityCategoryDetail[] = [];

    if (!personality) {
      return { weightedScore: 0, details };
    }

    const categories = [
      { name: 'Cognitive & Problem-Solving Traits', data: personality.cognitiveAndProblemSolving, weight: categoryWeights.cognitiveAndProblemSolving },
      { name: 'Communication & Teamwork Traits', data: personality.communicationAndTeamwork, weight: categoryWeights.communicationAndTeamwork },
      { name: 'Work Ethic & Reliability Traits', data: personality.workEthicAndReliability, weight: categoryWeights.workEthicAndReliability },
      { name: 'Growth & Leadership Traits', data: personality.growthAndLeadership, weight: categoryWeights.growthAndLeadership },
      { name: 'Culture & Personality Fit Traits', data: personality.cultureAndPersonalityFit, weight: categoryWeights.cultureAndPersonalityFit },
      { name: 'Bonus Traits', data: personality.bonusTraits, weight: categoryWeights.bonusTraits }
    ];

    let totalWeightedScore = 0;

    for (const category of categories) {
      const categoryKey = PERSONALITY_CATEGORY_NAME_TO_KEY[category.name] || category.name;
      const { score, traitCount } = this.calculateCategoryAverage(category.data);
      const weightedCategoryScore = (score / 10) * category.weight; // Normalize to 0-1, then apply weight

      details.push({
        category: category.name,
        categoryKey,
        score: Number(score.toFixed(2)),
        weight: category.weight,
        weightedScore: Number(weightedCategoryScore.toFixed(2)),
        traitCount
      });

      totalWeightedScore += weightedCategoryScore;
    }

    // Scale to weight allocation (personality weight out of 100)
    const finalScore = (totalWeightedScore / 100) * weights.personalityFit;

    return {
      weightedScore: Number(finalScore.toFixed(2)),
      details
    };
  }

  /**
   * Calculate average score for a personality category
   */
  private calculateCategoryAverage(categoryData: any): { score: number; traitCount: number } {
    if (!categoryData) return { score: 0, traitCount: 0 };

    const traits = Object.values(categoryData) as any[];
    const validTraits = traits.filter(t => t && typeof t.score === 'number' && t.score > 0);

    if (validTraits.length === 0) return { score: 0, traitCount: 0 };

    const totalScore = validTraits.reduce((sum, t) => sum + t.score, 0);
    return {
      score: totalScore / validTraits.length,
      traitCount: validTraits.length
    };
  }

  /**
   * Calculate experience score
   */
  private calculateExperienceScore(
    candidate: CandidateData,
    weights: ScoringWeights,
    modifiers: ScoringModifiers
  ): number {
    const experiences = candidate.experience || [];
    if (experiences.length === 0) return 0;

    // Base score on experience count (diminishing returns)
    const countScore = Math.min(10, experiences.length * 2);

    // TODO: Apply recency bias if date parsing is added
    // For now, use count-based scoring
    const rawScore = (countScore / 10) * 100;
    const weightedScore = (rawScore * weights.experience) / 100;

    return Number(weightedScore.toFixed(2));
  }

  /**
   * Calculate education score
   */
  private calculateEducationScore(
    candidate: CandidateData,
    weights: ScoringWeights,
    modifiers: ScoringModifiers
  ): number {
    const educations = candidate.education || [];
    if (educations.length === 0) return 0;

    // Base score on education entries (capped)
    const countScore = Math.min(10, educations.length * 3);

    const rawScore = (countScore / 10) * 100;
    const weightedScore = (rawScore * weights.education) / 100;

    return Number(weightedScore.toFixed(2));
  }

  /**
   * Calculate profile quality score
   */
  private calculateProfileQualityScore(
    candidate: CandidateData,
    weights: ScoringWeights
  ): number {
    let qualityPoints = 0;
    const maxPoints = 10;

    // Certifications (up to 3 points)
    const certs = candidate.certification?.length || 0;
    qualityPoints += Math.min(3, certs);

    // Resume uploaded (1 point)
    if (candidate.resume?.fileId) {
      qualityPoints += 1;
    }

    // Social links (up to 2 points)
    const socialLinks = candidate.socialLinks?.length || 0;
    qualityPoints += Math.min(2, socialLinks);

    // Transcripts (1 point)
    if ((candidate.transcripts?.length || 0) > 0) {
      qualityPoints += 1;
    }

    // Videos (up to 2 points)
    const videoCount = (candidate.interviewVideos?.length || 0) + (candidate.introductionVideos?.length || 0);
    qualityPoints += Math.min(2, videoCount);

    const rawScore = (qualityPoints / maxPoints) * 100;
    const weightedScore = (rawScore * weights.profileQuality) / 100;

    return Number(weightedScore.toFixed(2));
  }

  /**
   * Calculate confidence level based on profile completeness
   */
  private calculateConfidence(candidate: CandidateData, personality: PersonalityData | null): number {
    let confidencePoints = 0;
    const maxPoints = 100;

    // Skills (30 points)
    const skillCount = candidate.skills?.length || 0;
    confidencePoints += Math.min(30, skillCount * 3);

    // Experience (20 points)
    const expCount = candidate.experience?.length || 0;
    confidencePoints += Math.min(20, expCount * 5);

    // Education (10 points)
    const eduCount = candidate.education?.length || 0;
    confidencePoints += Math.min(10, eduCount * 5);

    // Personality (25 points)
    if (personality) {
      const allTraits = [
        ...Object.values(personality.cognitiveAndProblemSolving || {}),
        ...Object.values(personality.communicationAndTeamwork || {}),
        ...Object.values(personality.workEthicAndReliability || {}),
        ...Object.values(personality.growthAndLeadership || {}),
        ...Object.values(personality.cultureAndPersonalityFit || {}),
        ...Object.values(personality.bonusTraits || {})
      ] as any[];
      const assessedTraits = allTraits.filter(t => t && typeof t.score === 'number' && t.score > 0).length;
      confidencePoints += Math.min(25, assessedTraits);
    }

    // Certifications (10 points)
    const certCount = candidate.certification?.length || 0;
    confidencePoints += Math.min(10, certCount * 3);

    // Resume (5 points)
    if (candidate.resume?.fileId) {
      confidencePoints += 5;
    }

    return Math.min(100, Math.round((confidencePoints / maxPoints) * 100));
  }

  /**
   * Generate human-readable factors
   */
  private generateFactors(
    candidate: CandidateData,
    skillResult: { details: SkillMatchDetail[]; missingSkills: string[] },
    personalityResult: { details: PersonalityCategoryDetail[] },
    job: JobData | null
  ): ScoreFactors {
    const positiveFactors: string[] = [];
    const negativeFactors: string[] = [];
    const recommendations: string[] = [];

    // Skill analysis
    const highSkills = skillResult.details.filter(s => s.candidateScore >= 8);
    if (highSkills.length > 0) {
      positiveFactors.push(`Strong proficiency in ${highSkills.slice(0, 3).map(s => s.skillName).join(', ')}`);
    }

    const manualSkills = skillResult.details.filter(s => s.isManuallyAdded);
    if (manualSkills.length > 0) {
      positiveFactors.push(`${manualSkills.length} verified skills added by HR`);
    }

    if (skillResult.missingSkills.length > 0) {
      negativeFactors.push(`Missing required skills: ${skillResult.missingSkills.slice(0, 3).join(', ')}`);
      recommendations.push(`Consider training or certification in: ${skillResult.missingSkills[0]}`);
    }

    // Personality analysis
    const strongCategories = personalityResult.details.filter(c => c.score >= 7);
    if (strongCategories.length > 0) {
      positiveFactors.push(`Strong in ${strongCategories[0].category.replace(' Traits', '')}`);
    }

    const weakCategories = personalityResult.details.filter(c => c.score > 0 && c.score < 5);
    if (weakCategories.length > 0) {
      negativeFactors.push(`Lower scores in ${weakCategories[0].category.replace(' Traits', '')}`);
    }

    // Experience
    const expCount = candidate.experience?.length || 0;
    if (expCount >= 3) {
      positiveFactors.push(`${expCount} relevant work experiences`);
    } else if (expCount === 0) {
      negativeFactors.push('No work experience listed');
      recommendations.push('Add work experience to strengthen profile');
    }

    // Certifications
    const certCount = candidate.certification?.length || 0;
    if (certCount >= 2) {
      positiveFactors.push(`${certCount} professional certifications`);
    }

    // Profile completeness
    if (!candidate.resume?.fileId) {
      recommendations.push('Upload a resume for better assessment');
    }

    if ((candidate.transcripts?.length || 0) === 0) {
      recommendations.push('Add interview transcripts for personality insights');
    }

    return {
      positiveFactors,
      negativeFactors,
      recommendations
    };
  }

  // ============================================================================
  // Score History
  // ============================================================================

  /**
   * Save score to history
   */
  private async saveScoreHistory(result: PredictiveScoreResult, userId?: string, scoringSettingsId?: string, jobName?: string): Promise<void> {
    await this.init();

    // Build human-readable settings name
    const scoringSettingsName = result.jobId && jobName
      ? `Job-specific: ${jobName}`
      : 'Global Settings';

    const historyEntry: ScoreHistoryEntry = {
      historyId: new ObjectId().toString(),
      candidateId: result.candidateId,
      jobId: result.jobId,
      overallScore: result.overallScore,
      breakdown: result.breakdown,
      confidence: result.confidence,
      scoringSettingsId: scoringSettingsId || 'unknown',
      scoringSettingsName,
      calculatedAt: result.calculatedAt,
      calculatedBy: userId
    };

    // Update candidate with new history entry (limit to 50)
    const collection = this.db!.collection('personalInfo');
    await collection.updateOne(
      { candidateId: result.candidateId },
      {
        $push: {
          scoreHistory: {
            $each: [historyEntry],
            $slice: -50  // Keep only last 50 entries
          }
        } as any,
        $set: {
          lastScoreCalculatedAt: result.calculatedAt
        }
      }
    );
  }

  /**
   * Get score history for a candidate
   */
  async getScoreHistory(candidateId: string, limit: number = 50): Promise<ScoreHistoryEntry[]> {
    await this.init();

    const collection = this.db!.collection('personalInfo');
    const candidate = await collection.findOne({ candidateId });

    if (!candidate || !candidate.scoreHistory) {
      return [];
    }

    return (candidate.scoreHistory as ScoreHistoryEntry[])
      .slice(-limit)
      .reverse(); // Most recent first
  }

  // ============================================================================
  // AI Insights
  // ============================================================================

  /**
   * Generate AI-powered insights for a candidate
   * This is called on-demand to save computation resources
   */
  async generateAIInsights(
    candidateId: string,
    jobId?: string,
    userId?: string
  ): Promise<AIInsights> {
    await this.init();

    // Get candidate and score data
    const candidate = await this.candidateService.getCandidate(candidateId);
    if (!candidate) {
      throw new Error(`Candidate not found: ${candidateId}`);
    }

    // Calculate current score
    const scoreResult = await this.calculateScore(candidateId, jobId, userId);

    // Get job details if applicable
    let jobContext = '';
    if (jobId) {
      const job = await this.jobService.getJob(jobId);
      if (job) {
        jobContext = `\nApplying for: ${job.jobName}\nJob Requirements: ${job.skills?.map(s => s.skillId).join(', ') || 'None specified'}`;
      }
    }

    // Build prompt for Gemini
    const prompt = this.buildInsightsPrompt(candidate, scoreResult, jobContext);

    // Call Gemini API using centralized client with metrics tracking
    const insights = await this.callGeminiForInsights(prompt, candidateId, userId);

    // Save insights to candidate record
    await this.saveInsights(candidateId, insights);

    // Log AI operation
    await AuditLogger.logAIOperation({
      eventType: AuditEventType.AI_ANALYSIS_COMPLETED,
      candidateId,
      userId,
      action: `Generated AI insights for candidate ${candidate.name}`,
      success: true,
      metadata: {
        jobId,
        scoreAtGeneration: scoreResult.overallScore
      }
    });

    return insights;
  }

  /**
   * Build prompt for AI insights generation
   */
  private buildInsightsPrompt(
    candidate: CandidateData,
    scoreResult: PredictiveScoreResult,
    jobContext: string
  ): string {
    const skillsSummary = candidate.skills?.slice(0, 10)
      .map(s => `${s.skillId}: ${s.score}/10`)
      .join(', ') || 'None';

    const experienceSummary = candidate.experience?.length || 0;
    const educationSummary = candidate.education?.length || 0;
    const certsSummary = candidate.certification?.length || 0;

    return `You are an HR analytics expert. Analyze this candidate profile and provide actionable insights.

Candidate: ${candidate.name}
Overall Score: ${scoreResult.overallScore}/100
Confidence: ${scoreResult.confidence}%
${jobContext}

Score Breakdown:
- Skill Match: ${scoreResult.breakdown.skillMatch.toFixed(1)}
- Personality Fit: ${scoreResult.breakdown.personalityFit.toFixed(1)}
- Experience: ${scoreResult.breakdown.experience.toFixed(1)}
- Education: ${scoreResult.breakdown.education.toFixed(1)}
- Profile Quality: ${scoreResult.breakdown.profileQuality.toFixed(1)}

Key Skills: ${skillsSummary}
Experience Entries: ${experienceSummary}
Education Entries: ${educationSummary}
Certifications: ${certsSummary}

Positive Factors: ${scoreResult.factors.positiveFactors.join('; ') || 'None identified'}
Negative Factors: ${scoreResult.factors.negativeFactors.join('; ') || 'None identified'}
Missing Skills: ${scoreResult.missingSkills.join(', ') || 'None'}

Provide a JSON response with:
{
  "summary": "2-3 sentence professional assessment of the candidate",
  "strengths": ["3-5 key strengths"],
  "areasForDevelopment": ["2-4 areas for development or improvement"],
  "cultureFitAssessment": "1-2 sentence assessment of cultural fit potential",
  "recommendations": ["3-5 specific actionable recommendations for the HR team"]
}`;
  }

  /**
   * Call Gemini API for insights using centralized client with metrics tracking
   */
  private async callGeminiForInsights(prompt: string, candidateId?: string, userId?: string): Promise<AIInsights> {
    const geminiClient = GeminiClientService.getInstance();
    
    const result = await geminiClient.callGemini(prompt, {
      service: AIServiceType.PREDICTIVE_INSIGHTS,
      candidateId,
      userId
    });

    const contentText = result.rawText;

    if (!contentText) {
      throw new Error('No content returned by Gemini');
    }

    // Parse JSON response
    const cleanedText = contentText
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/```$/, '')
      .trim();

    try {
      const parsed = JSON.parse(cleanedText);
      return {
        summary: this.stripMarkdown(parsed.summary || 'No summary generated'),
        strengths: (parsed.strengths || []).map((s: string) => this.stripMarkdown(s)),
        areasForDevelopment: (parsed.areasForDevelopment || parsed.areasForImprovement || []).map((s: string) => this.stripMarkdown(s)),
        cultureFitAssessment: this.stripMarkdown(parsed.cultureFitAssessment || ''),
        recommendations: (parsed.recommendations || []).map((s: string) => this.stripMarkdown(s)),
        generatedAt: new Date()
      };
    } catch (e) {
      // If JSON parsing fails, create a basic response
      return {
        summary: this.stripMarkdown(cleanedText.substring(0, 500)),
        strengths: [],
        areasForDevelopment: [],
        cultureFitAssessment: '',
        recommendations: [],
        generatedAt: new Date()
      };
    }
  }

  /**
   * Strip markdown formatting from text
   * Converts markdown syntax to plain text
   */
  private stripMarkdown(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    return text
      // Bold: **text** or __text__
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      // Italic: *text* or _text_
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      // Strikethrough: ~~text~~
      .replace(/~~(.+?)~~/g, '$1')
      // Inline code: `code`
      .replace(/`([^`]+)`/g, '$1')
      // Headers: # Header
      .replace(/^#{1,6}\s+/gm, '')
      // Links: [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Images: ![alt](url) -> alt
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // Blockquotes: > text
      .replace(/^>\s+/gm, '')
      // Horizontal rules: --- or *** or ___
      .replace(/^[-*_]{3,}$/gm, '')
      // Unordered list markers: - or * or +
      .replace(/^[\s]*[-*+]\s+/gm, '')
      // Ordered list markers: 1. 2. etc
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Clean up extra whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Save AI insights to candidate record
   */
  private async saveInsights(candidateId: string, insights: AIInsights): Promise<void> {
    const collection = this.db!.collection('personalInfo');
    await collection.updateOne(
      { candidateId },
      {
        $set: {
          aiInsights: JSON.stringify(insights),
          insightsGeneratedAt: insights.generatedAt
        }
      }
    );
  }

  /**
   * Get cached AI insights for a candidate
   */
  async getCachedInsights(candidateId: string): Promise<AIInsights | null> {
    await this.init();

    const collection = this.db!.collection('personalInfo');
    const candidate = await collection.findOne({ candidateId });

    if (!candidate || !candidate.aiInsights) {
      return null;
    }

    try {
      const parsed = JSON.parse(candidate.aiInsights);
      // Handle both old (areasForImprovement) and new (areasForDevelopment) field names
      const generatedAt = candidate.insightsGeneratedAt || parsed.generatedAt;
      return {
        summary: parsed.summary || '',
        strengths: parsed.strengths || [],
        areasForDevelopment: parsed.areasForDevelopment || parsed.areasForImprovement || [],
        cultureFitAssessment: parsed.cultureFitAssessment || '',
        recommendations: parsed.recommendations || [],
        generatedAt: generatedAt instanceof Date ? generatedAt : new Date(generatedAt)
      };
    } catch (err) {
      console.error('Error parsing cached insights:', err);
      return null;
    }
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Calculate scores for all candidates on a job
   */
  async calculateScoresForJob(
    jobId: string,
    userId?: string
  ): Promise<{ candidateId: string; score: number; confidence: number }[]> {
    await this.init();

    // Get all candidates for this job via direct query
    const collection = this.db!.collection('personalInfo');
    const candidateDocs = await collection.find({ 
      roleApplied: jobId, 
      isDeleted: { $ne: true } 
    }).toArray();

    const results: { candidateId: string; score: number; confidence: number }[] = [];

    for (const candidateDoc of candidateDocs) {
      try {
        const scoreResult = await this.calculateScore(candidateDoc.candidateId, jobId, userId);
        results.push({
          candidateId: candidateDoc.candidateId,
          score: scoreResult.overallScore,
          confidence: scoreResult.confidence
        });
      } catch (error) {
        console.error(`Error calculating score for candidate ${candidateDoc.candidateId}:`, error);
        results.push({
          candidateId: candidateDoc.candidateId,
          score: 0,
          confidence: 0
        });
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }
}
