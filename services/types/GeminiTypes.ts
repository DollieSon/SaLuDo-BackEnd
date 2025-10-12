// =======================
// GEMINI AI TYPES
// =======================
// Purpose: Common interfaces and types for Gemini AI services
// Related: GeminiJobService, GeminiResumeService, GeminiTranscriptService
// =======================

/**
 * Skill inferred by Gemini AI from job descriptions
 */
export interface InferredJobSkill {
  skillName: string;
  requiredLevel: number; // Between 0.0 and 10.0
  evidence: string;
}

/**
 * Response structure from Gemini AI API
 */
export interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text: string }[];
    };
  }[];
}

/**
 * Parsed resume data structure from Gemini AI
 */
export interface ParsedResumeData {
  skills: {
    skillName: string;
    score: number;
    evidence: string;
    addedBy: string;
  }[];
  education: any[];
  experience: any[];
  certifications: any[];
  strengths: any[];
  weaknesses: any[];
}

/**
 * Gemini AI processing configuration
 */
export interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  safetySettings?: any[];
}

/**
 * Gemini AI error response
 */
export interface GeminiError {
  code: number;
  message: string;
  details?: any;
}