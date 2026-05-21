import { AIServiceType, GEMINI_PRICING, DEFAULT_MODEL_VERSION, DEPRECATED_GEMINI_MODELS, getActiveGeminiModels } from './AIMetrics';

export type GeminiModelName = keyof typeof GEMINI_PRICING;

export const ALLOWED_GEMINI_MODELS: string[] = getActiveGeminiModels();

export const DEFAULT_GEMINI_MAPPING: Record<AIServiceType, string> = {
  [AIServiceType.RESUME_PARSING]: DEFAULT_MODEL_VERSION,
  [AIServiceType.JOB_ANALYSIS]: DEFAULT_MODEL_VERSION,
  [AIServiceType.TRANSCRIPT_ANALYSIS]: DEFAULT_MODEL_VERSION,
  [AIServiceType.PREDICTIVE_INSIGHTS]: DEFAULT_MODEL_VERSION,
  [AIServiceType.VIDEO_ANALYSIS]: DEFAULT_MODEL_VERSION,
};

export interface GeminiModelSettings {
  settingsId: string; // constant 'global'
  mapping: Record<AIServiceType, string>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy: string;
}

export function validateModelName(model: string): boolean {
  // Allow active models only (exclude deprecated)
  if (DEPRECATED_GEMINI_MODELS.has(model)) {
    return false;
  }
  return ALLOWED_GEMINI_MODELS.includes(model);
}

export function validateFeatureKey(key: string): boolean {
  return Object.values(AIServiceType).includes(key as AIServiceType);
}

export function buildDefaultSettings(createdBy: string): GeminiModelSettings {
  const now = new Date();
  return {
    settingsId: 'global',
    mapping: { ...DEFAULT_GEMINI_MAPPING },
    createdAt: now,
    updatedAt: now,
    createdBy,
    lastModifiedBy: createdBy,
  };
}

export type GeminiModelUpdate = Partial<Record<AIServiceType, string>>;
