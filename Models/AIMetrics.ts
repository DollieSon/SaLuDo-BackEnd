/**
 * AI Metrics Model
 * Tracks AI model performance, usage, costs, and quality metrics
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * AI Service types available in the system
 */
export enum AIServiceType {
  RESUME_PARSING = "resume_parsing",
  JOB_ANALYSIS = "job_analysis",
  TRANSCRIPT_ANALYSIS = "transcript_analysis",
  PREDICTIVE_INSIGHTS = "predictive_insights",
  VIDEO_ANALYSIS = "video_analysis",
}

/**
 * Error categories for AI failures
 */
export enum AIErrorCategory {
  // API Errors
  RATE_LIMIT = "rate_limit",
  TIMEOUT = "timeout",
  API_ERROR = "api_error",
  AUTHENTICATION = "authentication",

  // Response Errors
  INVALID_JSON = "invalid_json",
  EMPTY_RESPONSE = "empty_response",
  INCOMPLETE_RESPONSE = "incomplete_response",
  UNEXPECTED_FORMAT = "unexpected_format",

  // Validation Errors
  VALIDATION_FAILED = "validation_failed",
  MISSING_FIELDS = "missing_fields",

  // Other
  UNKNOWN = "unknown",
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Alert types for AI monitoring
 */
export enum AIAlertType {
  HIGH_ERROR_RATE = "high_error_rate",
  HIGH_LATENCY = "high_latency",
  COST_SPIKE = "cost_spike",
  LOW_QUALITY_SCORE = "low_quality_score",
  RATE_LIMIT_WARNING = "rate_limit_warning",
  SERVICE_DEGRADATION = "service_degradation",
}

/**
 * Feedback rating scale
 */
export enum FeedbackRating {
  VERY_POOR = 1,
  POOR = 2,
  NEUTRAL = 3,
  GOOD = 4,
  EXCELLENT = 5,
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Token usage information from Gemini API
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  thoughtsTokens?: number; // Thinking tokens (Gemini 2.0 thinking mode)
  isEstimated: boolean; // True if tokens were estimated, false if from API
}

/**
 * Cost estimation for an AI request
 */
export interface CostEstimate {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  isEstimated: boolean; // True if cost was estimated
}

/**
 * Main AI Metrics entry - logged for every AI request
 */
export interface AIMetricsEntry {
  metricsId: string;
  timestamp: Date;

  // Request Context
  service: AIServiceType;
  modelVersion: string;
  promptVersion?: string; // For tracking prompt changes

  // Entity References
  candidateId?: string;
  jobId?: string;
  userId?: string;
  userEmail?: string;

  // Operational Metrics
  latencyMs: number;
  tokenUsage: TokenUsage;
  costEstimate: CostEstimate;

  // Status
  success: boolean;
  errorCategory?: AIErrorCategory;
  errorMessage?: string;
  httpStatusCode?: number;

  // Quality Indicators
  parseSuccess: boolean; // Did JSON parsing succeed?
  fallbackUsed: boolean; // Was a fallback response used?
  outputLength: number; // Length of useful output
  retryCount: number; // Number of retries before success/failure

  // Request Details (for debugging)
  inputLength: number; // Length of input text
  requestId?: string; // For correlation
}

/**
 * Human feedback on AI output quality
 */
export interface AIFeedback {
  feedbackId: string;
  metricsId: string; // Links to the original AI request

  // Context
  service: AIServiceType;
  candidateId?: string;
  jobId?: string;

  // Feedback
  rating: FeedbackRating;
  wasEdited: boolean; // Did user edit the AI output?
  editPercentage?: number; // How much was edited (0-100)
  feedbackText?: string; // Optional text feedback

  // Metadata
  ratedBy: string; // User ID who provided feedback
  ratedByEmail?: string;
  ratedAt: Date;
}

/**
 * AI Alert - generated when thresholds are exceeded
 */
export interface AIAlert {
  alertId: string;
  alertType: AIAlertType;
  severity: AlertSeverity;

  // Context
  service?: AIServiceType; // Which service triggered (optional for global alerts)

  // Alert Details
  message: string;
  currentValue: number; // Current metric value
  threshold: number; // Threshold that was exceeded

  // Time Window
  windowStartTime: Date;
  windowEndTime: Date;

  // Status
  isActive: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;

  // Metadata
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Alert threshold configuration
 */
export interface AlertThresholds {
  // Error rate thresholds (percentage)
  errorRateWarning: number; // Default: 5%
  errorRateCritical: number; // Default: 15%

  // Latency thresholds (ms)
  latencyP95Warning: number; // Default: 5000ms
  latencyP95Critical: number; // Default: 10000ms

  // Cost thresholds (daily USD)
  dailyCostWarning: number; // Default: $10
  dailyCostCritical: number; // Default: $50

  // Quality thresholds
  avgRatingWarning: number; // Default: 3.0
  parseFailureRateWarning: number; // Default: 10%

  // Rate limit
  rateLimitWarningPercent: number; // Default: 80% of limit
}

/**
 * Aggregated metrics for dashboard
 */
export interface AIMetricsAggregation {
  period: "30d" | "90d" | "1y" | "custom";
  startDate: Date;
  endDate: Date;

  // Request Counts
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;

  // Error Breakdown
  errorsByCategory: Record<AIErrorCategory, number>;

  // Latency Stats
  latencyP50: number;
  latencyP90: number;
  latencyP95: number;
  latencyP99: number;
  latencyAvg: number;

  // Token Usage
  totalInputTokens: number;
  totalOutputTokens: number;
  avgTokensPerRequest: number;

  // Cost
  totalCostUsd: number;
  avgCostPerRequest: number;
  estimatedVsActualRatio: number; // How accurate are estimates?

  // Quality
  avgFeedbackRating: number;
  totalFeedbackCount: number;
  editRate: number; // % of outputs that were edited
  parseSuccessRate: number;
  fallbackRate: number;

  // By Service
  byService: Record<
    AIServiceType,
    {
      requests: number;
      successRate: number;
      avgLatency: number;
      totalCost: number;
      avgRating: number;
    }
  >;
}

/**
 * Daily metrics summary for trends
 */
export interface DailyMetricsSummary {
  date: Date;
  service?: AIServiceType; // Optional - aggregate across all if not specified

  requestCount: number;
  successCount: number;
  errorCount: number;

  avgLatencyMs: number;
  p95LatencyMs: number;

  totalTokens: number;
  totalCostUsd: number;

  avgRating?: number;
  feedbackCount: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default alert thresholds
 */
export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  errorRateWarning: 5,
  errorRateCritical: 15,
  latencyP95Warning: 5000,
  latencyP95Critical: 10000,
  dailyCostWarning: 10,
  dailyCostCritical: 50,
  avgRatingWarning: 3.0,
  parseFailureRateWarning: 10,
  rateLimitWarningPercent: 80,
};

/**
 * Gemini pricing per 1M tokens (as of Dec 2025)
 * Note: Update these when pricing changes
 */
export const GEMINI_PRICING = {
  "gemini-2.5-flash": {
    inputPer1M: 0.075, // $0.075 per 1M input tokens
    outputPer1M: 0.3, // $0.30 per 1M output tokens
  },
  "gemini-2.5-pro": {
    inputPer1M: 1.25, // $1.25 per 1M input tokens
    outputPer1M: 5.0, // $5.00 per 1M output tokens
  },
  "gemini-2.5-flash-lite": {
    inputPer1M: 0.03,
    outputPer1M: 0.12,
  },
  "gemini-3-pro-preview": {
    inputPer1M: 0.0, // Preview/experimental (check actual pricing)
    outputPer1M: 0.0,
  },
  "gemini-pro": {
    inputPer1M: 0.5,
    outputPer1M: 1.5,
  },
  "gemini-1.5-flash": {
    inputPer1M: 0.075,
    outputPer1M: 0.3,
  },
} as const;

/**
 * Default model version
 */
export const DEFAULT_MODEL_VERSION = "gemini-2.5-flash-lite";

/**
 * Token estimation constants (average chars per token)
 * Used when API doesn't return token counts
 */
export const TOKEN_ESTIMATION = {
  CHARS_PER_TOKEN: 4, // Rough estimate for English text
  OVERHEAD_MULTIPLIER: 1.1, // Add 10% for formatting/special tokens
};

/**
 * Metrics retention period in days
 */
export const METRICS_RETENTION_DAYS = 365; // 1 year

/**
 * Collection names
 */
export const AI_METRICS_COLLECTIONS = {
  METRICS: "ai_metrics",
  FEEDBACK: "ai_feedback",
  ALERTS: "ai_alerts",
  DAILY_SUMMARIES: "ai_daily_summaries",
} as const;

// Export trend analysis types
export type {
  TrendComparison,
  SeasonalityPattern,
  QualityTrend,
  DashboardWithTrends,
  MetricTrend,
  DayOfWeekPattern,
  QualityScore,
} from "../types/AITrendTypes";

export {
  TrendDirection,
  ComparisonType,
  QualityBand,
} from "../types/AITrendTypes";
