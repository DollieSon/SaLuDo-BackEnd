/**
 * AI Trend Analysis Types
 * Types and interfaces for trend detection, seasonality patterns, and quality analysis
 */

import { AIServiceType, AIMetricsAggregation } from '../Models/AIMetrics';

/**
 * Trend direction indicator
 */
export enum TrendDirection {
  IMPROVING = 'improving',
  DEGRADING = 'degrading',
  STABLE = 'stable'
}

/**
 * Comparison type for trend analysis
 */
export enum ComparisonType {
  PREVIOUS = 'previous',        // Compare with previous period (e.g., last 30 days)
  YEAR_AGO = 'year_ago'          // Compare with same period last year
}

/**
 * Quality band classification
 */
export enum QualityBand {
  EXCELLENT = 'Excellent',  // 90-100
  GOOD = 'Good',            // 75-89
  FAIR = 'Fair',            // 50-74
  POOR = 'Poor'             // 0-49
}

/**
 * Single metric trend data
 */
export interface MetricTrend {
  current: number;
  previous: number;
  change: number;              // Percentage change
  changeAbs: number;           // Absolute change
  direction: TrendDirection;
  isSignificant: boolean;      // True if change > 15%
}

/**
 * Complete trend comparison for dashboard
 */
export interface TrendComparison {
  period: {
    current: { startDate: Date; endDate: Date };
    previous: { startDate: Date; endDate: Date };
    comparisonType: ComparisonType;
  };
  metrics: {
    errorRate: MetricTrend;
    avgLatency: MetricTrend;
    totalCost: MetricTrend;
    avgRating: MetricTrend;
    requestCount: MetricTrend;
  };
  byService: Record<AIServiceType, {
    errorRate: MetricTrend;
    avgLatency: MetricTrend;
    cost: MetricTrend;
  }>;
  insights: string[];           // Natural language insights
}

/**
 * Day of week pattern
 */
export interface DayOfWeekPattern {
  dayOfWeek: number;            // 0 = Sunday, 6 = Saturday
  dayName: string;              // 'Monday', 'Tuesday', etc.
  metrics: {
    requestCount: number;
    avgErrorRate: number;
    avgLatency: number;
    avgCost: number;
    successRate: number;
  };
  deviation: {
    errorRateDeviation: number;  // % deviation from weekly average
    latencyDeviation: number;
    requestDeviation: number;
  };
}

/**
 * Seasonality analysis results
 */
export interface SeasonalityPattern {
  dateRange: {
    startDate: Date;
    endDate: Date;
    totalDays: number;
  };
  service?: AIServiceType;
  byDayOfWeek: DayOfWeekPattern[];
  weeklyAverages: {
    avgErrorRate: number;
    avgLatency: number;
    avgRequestCount: number;
    avgCost: number;
  };
  insights: string[];           // Natural language insights
  outliers: {
    highestErrorDay: string;
    lowestErrorDay: string;
    busiestDay: string;
    quietestDay: string;
  };
}

/**
 * Quality score calculation
 */
export interface QualityScore {
  score: number;                // 0-100
  band: QualityBand;
  avgEditPercentage: number;
  deleteRate: number;
  feedbackCount: number;
}

/**
 * Quality trend analysis
 */
export interface QualityTrend {
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  overall: QualityScore & {
    trend: MetricTrend;
  };
  byService: Record<AIServiceType, QualityScore & {
    trend: MetricTrend;
  }>;
  insights: string[];
  recommendations: string[];
}

/**
 * Enhanced dashboard response with trends
 */
export interface DashboardWithTrends {
  current: AIMetricsAggregation;
  previous?: AIMetricsAggregation;
  trends?: TrendComparison;
  dateRange: {
    days: number;
    startDate: Date;
    endDate: Date;
  };
}
