/**
 * Trend Calculation Utilities
 * Helper functions for calculating trends, deviations, and generating insights
 */

import { TrendDirection, MetricTrend, QualityBand } from '../types/AITrendTypes';

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Calculate absolute change between two values
 */
export function calculateAbsoluteChange(current: number, previous: number): number {
  return current - previous;
}

/**
 * Determine trend direction based on metric type and change
 * For error rates and costs, decreasing is improving
 * For ratings and success rates, increasing is improving
 */
export function determineTrendDirection(
  change: number,
  isInverseMetric: boolean = false,
  significanceThreshold: number = 15
): { direction: TrendDirection; isSignificant: boolean } {
  const absChange = Math.abs(change);
  const isSignificant = absChange >= significanceThreshold;
  
  if (absChange < 2) {
    return { direction: TrendDirection.STABLE, isSignificant: false };
  }
  
  let direction: TrendDirection;
  
  if (isInverseMetric) {
    // For error rates, latency, cost - lower is better
    direction = change < 0 ? TrendDirection.IMPROVING : TrendDirection.DEGRADING;
  } else {
    // For ratings, success rates - higher is better
    direction = change > 0 ? TrendDirection.IMPROVING : TrendDirection.DEGRADING;
  }
  
  return { direction, isSignificant };
}

/**
 * Create a complete metric trend object
 */
export function createMetricTrend(
  current: number,
  previous: number,
  isInverseMetric: boolean = false
): MetricTrend {
  const change = calculatePercentageChange(current, previous);
  const changeAbs = calculateAbsoluteChange(current, previous);
  const { direction, isSignificant } = determineTrendDirection(change, isInverseMetric);
  
  return {
    current,
    previous,
    change,
    changeAbs,
    direction,
    isSignificant
  };
}

/**
 * Calculate statistical deviation from average
 */
export function calculateDeviation(value: number, average: number): number {
  if (average === 0) return 0;
  return ((value - average) / average) * 100;
}

/**
 * Determine quality band from score
 */
export function getQualityBand(score: number): QualityBand {
  if (score >= 90) return QualityBand.EXCELLENT;
  if (score >= 75) return QualityBand.GOOD;
  if (score >= 50) return QualityBand.FAIR;
  return QualityBand.POOR;
}

/**
 * Calculate quality score from edit metrics
 * Formula: 100 - (avgEditPercentage * 0.6 + deleteRate * 0.4)
 */
export function calculateQualityScore(
  avgEditPercentage: number,
  deleteRate: number = 0
): number {
  const score = 100 - (avgEditPercentage * 0.6 + deleteRate * 0.4);
  return Math.max(0, Math.min(100, score)); // Clamp between 0-100
}

/**
 * Generate natural language insight for a metric trend
 */
export function generateMetricInsight(
  metricName: string,
  trend: MetricTrend,
  unit: string = '%'
): string | null {
  if (!trend.isSignificant) return null;
  
  const changeStr = Math.abs(trend.change).toFixed(1);
  const direction = trend.direction === TrendDirection.IMPROVING ? 'improved' : 'degraded';
  
  return `${metricName} ${direction} by ${changeStr}${unit} vs previous period`;
}

/**
 * Generate insights from trend comparison data
 */
export function generateTrendInsights(metrics: {
  errorRate: MetricTrend;
  avgLatency: MetricTrend;
  totalCost: MetricTrend;
  avgRating: MetricTrend;
  requestCount: MetricTrend;
}): string[] {
  const insights: string[] = [];
  
  // Error rate insight
  const errorInsight = generateMetricInsight('Error rate', metrics.errorRate);
  if (errorInsight) insights.push(errorInsight);
  
  // Latency insight
  if (metrics.avgLatency.isSignificant) {
    const change = Math.abs(metrics.avgLatency.change).toFixed(1);
    const direction = metrics.avgLatency.direction === TrendDirection.IMPROVING ? 'decreased' : 'increased';
    insights.push(`Average latency ${direction} by ${change}%`);
  }
  
  // Cost insight
  if (metrics.totalCost.isSignificant) {
    const change = Math.abs(metrics.totalCost.change).toFixed(1);
    const direction = metrics.totalCost.direction === TrendDirection.IMPROVING ? 'decreased' : 'increased';
    insights.push(`Total cost ${direction} by ${change}%`);
  }
  
  // Rating insight
  if (metrics.avgRating.isSignificant) {
    const change = Math.abs(metrics.avgRating.change).toFixed(1);
    const direction = metrics.avgRating.direction === TrendDirection.IMPROVING ? 'improved' : 'declined';
    insights.push(`User satisfaction ${direction} by ${change}%`);
  }
  
  // Request volume insight
  if (metrics.requestCount.isSignificant) {
    const change = Math.abs(metrics.requestCount.change).toFixed(1);
    const direction = metrics.requestCount.change > 0 ? 'increased' : 'decreased';
    insights.push(`Request volume ${direction} by ${change}%`);
  }
  
  return insights;
}

/**
 * Generate seasonality insights
 */
export function generateSeasonalityInsights(
  dayPatterns: Array<{ dayName: string; avgErrorRate: number; requestCount: number; errorRateDeviation: number }>,
  weeklyAverage: number
): string[] {
  const insights: string[] = [];
  
  // Find highest and lowest error rate days
  const sortedByError = [...dayPatterns].sort((a, b) => b.avgErrorRate - a.avgErrorRate);
  const highestErrorDay = sortedByError[0];
  const lowestErrorDay = sortedByError[sortedByError.length - 1];
  
  if (highestErrorDay.errorRateDeviation > 20) {
    insights.push(`${highestErrorDay.dayName}s have ${highestErrorDay.errorRateDeviation.toFixed(1)}% higher error rates than average`);
  }
  
  if (lowestErrorDay.errorRateDeviation < -20) {
    insights.push(`${lowestErrorDay.dayName}s show ${Math.abs(lowestErrorDay.errorRateDeviation).toFixed(1)}% better performance than average`);
  }
  
  // Find busiest day
  const sortedByVolume = [...dayPatterns].sort((a, b) => b.requestCount - a.requestCount);
  const busiestDay = sortedByVolume[0];
  const quietestDay = sortedByVolume[sortedByVolume.length - 1];
  
  const volumeRatio = busiestDay.requestCount / quietestDay.requestCount;
  if (volumeRatio > 1.5) {
    insights.push(`${busiestDay.dayName}s are ${volumeRatio.toFixed(1)}x busier than ${quietestDay.dayName}s`);
  }
  
  return insights;
}

/**
 * Generate quality trend insights
 */
export function generateQualityInsights(
  overallScore: number,
  overallTrend: MetricTrend,
  serviceScores: Array<{ service: string; score: number; band: QualityBand }>
): string[] {
  const insights: string[] = [];
  
  // Overall quality insight
  if (overallTrend.isSignificant) {
    const direction = overallTrend.direction === TrendDirection.IMPROVING ? 'improved' : 'declined';
    insights.push(`Overall AI quality ${direction} by ${Math.abs(overallTrend.change).toFixed(1)} points`);
  }
  
  // Poor performing services
  const poorServices = serviceScores.filter(s => s.band === QualityBand.POOR);
  if (poorServices.length > 0) {
    insights.push(`${poorServices.length} service(s) require attention: ${poorServices.map(s => s.service).join(', ')}`);
  }
  
  // Excellent performing services
  const excellentServices = serviceScores.filter(s => s.band === QualityBand.EXCELLENT);
  if (excellentServices.length > 0) {
    insights.push(`${excellentServices.length} service(s) performing excellently: ${excellentServices.map(s => s.service).join(', ')}`);
  }
  
  return insights;
}

/**
 * Get day name from day of week number
 */
export function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || 'Unknown';
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * Format number with suffix (K, M, B)
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}
