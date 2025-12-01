/**
 * AI Metrics Service
 * Business logic for AI performance tracking, aggregation, and feedback
 */

import { Db, ObjectId } from 'mongodb';
import { connectDB } from '../mongo_db';
import { AIMetricsRepository } from '../repositories/AIMetricsRepository';
import {
  AIMetricsEntry,
  AIFeedback,
  AIMetricsAggregation,
  DailyMetricsSummary,
  AIServiceType,
  AIErrorCategory,
  FeedbackRating,
  TokenUsage,
  CostEstimate,
  GEMINI_PRICING,
  DEFAULT_MODEL_VERSION,
  TOKEN_ESTIMATION
} from '../Models/AIMetrics';

// ============================================================================
// Types
// ============================================================================

export interface FeedbackSubmission {
  metricsId: string;
  service: AIServiceType;
  candidateId?: string;
  jobId?: string;
  rating: FeedbackRating;
  wasEdited: boolean;
  editPercentage?: number;
  feedbackText?: string;
  ratedBy: string;
  ratedByEmail?: string;
}

export interface RouteFeedbackSubmission {
  metricsEntryId: string;
  serviceType: AIServiceType;
  rating: number;
  comments?: string;
  isAccurate?: boolean;
  submittedBy: string;
  submittedAt: Date;
}

export interface MetricsFilter {
  service?: AIServiceType;
  success?: boolean;
  candidateId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface DateRangeOption {
  label: string;
  value: '30d' | '90d' | '1y' | 'custom';
  startDate: Date;
  endDate: Date;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class AIMetricsService {
  private static instance: AIMetricsService;
  private db: Db | null = null;
  private metricsRepo: AIMetricsRepository | null = null;

  constructor(db?: Db) {
    if (db) {
      this.db = db;
      this.metricsRepo = new AIMetricsRepository(db);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AIMetricsService {
    if (!AIMetricsService.instance) {
      AIMetricsService.instance = new AIMetricsService();
    }
    return AIMetricsService.instance;
  }

  /**
   * Initialize database connection
   */
  private async init(): Promise<void> {
    if (!this.db) {
      this.db = await connectDB();
      this.metricsRepo = new AIMetricsRepository(this.db);
    }
  }

  /**
   * Initialize indexes (call on app startup)
   */
  async initializeIndexes(): Promise<void> {
    await this.init();
    await this.metricsRepo!.createIndexes();
  }

  // ============================================================================
  // Date Range Helpers
  // ============================================================================

  /**
   * Get predefined date ranges
   */
  getDateRangeOptions(): DateRangeOption[] {
    const now = new Date();
    
    return [
      {
        label: 'Last 30 Days',
        value: '30d',
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        endDate: now
      },
      {
        label: 'Last 90 Days',
        value: '90d',
        startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        endDate: now
      },
      {
        label: 'Last Year',
        value: '1y',
        startDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        endDate: now
      }
    ];
  }

  /**
   * Parse date range from query parameter
   */
  parseDateRange(range: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    
    switch (range) {
      case '30d':
        return {
          startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          endDate: now
        };
      case '90d':
        return {
          startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          endDate: now
        };
      case '1y':
      default:
        return {
          startDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
          endDate: now
        };
    }
  }

  // ============================================================================
  // Dashboard Data
  // ============================================================================

  /**
   * Get dashboard overview data
   */
  async getDashboardData(
    startDate: Date,
    endDate: Date,
    service?: AIServiceType
  ): Promise<{
    aggregation: AIMetricsAggregation;
    dailyTrends: DailyMetricsSummary[];
    recentErrors: AIMetricsEntry[];
    serviceComparison: Record<AIServiceType, {
      requests: number;
      successRate: number;
      avgLatency: number;
      avgCost: number;
      avgRating: number;
    }>;
  }> {
    await this.init();

    const [aggregation, dailyTrends, recentErrors] = await Promise.all([
      this.metricsRepo!.getAggregatedMetrics(startDate, endDate, service),
      this.metricsRepo!.getDailySummaries({ startDate, endDate, service }),
      this.metricsRepo!.getRecentErrors({ limit: 10, service })
    ]);

    // Build service comparison from aggregation
    const serviceComparison: Record<AIServiceType, any> = {} as any;
    for (const svc of Object.values(AIServiceType)) {
      const svcData = aggregation.byService[svc];
      serviceComparison[svc] = {
        requests: svcData.requests,
        successRate: svcData.successRate,
        avgLatency: svcData.avgLatency,
        avgCost: svcData.requests > 0 ? svcData.totalCost / svcData.requests : 0,
        avgRating: svcData.avgRating
      };
    }

    return {
      aggregation,
      dailyTrends,
      recentErrors,
      serviceComparison
    };
  }

  /**
   * Get metrics summary cards data
   */
  async getSummaryCards(range: '30d' | '90d' | '1y' = '30d'): Promise<{
    totalRequests: number;
    successRate: number;
    avgLatency: number;
    totalCost: number;
    avgRating: number;
    topErrors: { category: AIErrorCategory; count: number }[];
  }> {
    await this.init();

    const { startDate, endDate } = this.parseDateRange(range);
    const aggregation = await this.metricsRepo!.getAggregatedMetrics(startDate, endDate);

    // Get top 5 errors
    const topErrors = Object.entries(aggregation.errorsByCategory)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({
        category: category as AIErrorCategory,
        count
      }));

    return {
      totalRequests: aggregation.totalRequests,
      successRate: aggregation.totalRequests > 0 
        ? (aggregation.successfulRequests / aggregation.totalRequests) * 100 
        : 0,
      avgLatency: aggregation.latencyAvg,
      totalCost: aggregation.totalCostUsd,
      avgRating: aggregation.avgFeedbackRating,
      topErrors
    };
  }

  // ============================================================================
  // Metrics Queries
  // ============================================================================

  /**
   * Get filtered metrics entries
   */
  async getMetrics(filter: MetricsFilter): Promise<{
    entries: AIMetricsEntry[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    await this.init();

    const result = await this.metricsRepo!.getMetrics({
      ...filter,
      limit: filter.limit || 50,
      offset: filter.offset || 0
    });

    return {
      entries: result.entries,
      total: result.total,
      page: Math.floor((filter.offset || 0) / (filter.limit || 50)) + 1,
      pageSize: filter.limit || 50
    };
  }

  /**
   * Get metrics by ID
   */
  async getMetricsById(metricsId: string): Promise<AIMetricsEntry | null> {
    await this.init();
    return await this.metricsRepo!.getMetricsById(metricsId);
  }

  /**
   * Get error breakdown
   */
  async getErrorBreakdown(
    range: '30d' | '90d' | '1y' = '30d',
    service?: AIServiceType
  ): Promise<{
    byCategory: Record<AIErrorCategory, number>;
    byService: Record<AIServiceType, number>;
    recentErrors: AIMetricsEntry[];
    errorRate: number;
  }> {
    await this.init();

    const { startDate, endDate } = this.parseDateRange(range);
    const aggregation = await this.metricsRepo!.getAggregatedMetrics(startDate, endDate, service);
    const recentErrors = await this.metricsRepo!.getRecentErrors({ limit: 20, service });

    // Calculate errors by service
    const byService: Record<AIServiceType, number> = {} as any;
    for (const svc of Object.values(AIServiceType)) {
      const svcData = aggregation.byService[svc];
      byService[svc] = Math.round(svcData.requests * (1 - svcData.successRate / 100));
    }

    return {
      byCategory: aggregation.errorsByCategory,
      byService,
      recentErrors,
      errorRate: aggregation.totalRequests > 0
        ? (aggregation.failedRequests / aggregation.totalRequests) * 100
        : 0
    };
  }

  /**
   * Get latency analysis
   */
  async getLatencyAnalysis(
    range: '30d' | '90d' | '1y' = '30d',
    service?: AIServiceType
  ): Promise<{
    percentiles: { p50: number; p90: number; p95: number; p99: number };
    average: number;
    byService: Record<AIServiceType, number>;
    slowestRequests: AIMetricsEntry[];
  }> {
    await this.init();

    const { startDate, endDate } = this.parseDateRange(range);
    const aggregation = await this.metricsRepo!.getAggregatedMetrics(startDate, endDate, service);

    // Get slowest requests
    const { entries: allEntries } = await this.metricsRepo!.getMetrics({
      startDate,
      endDate,
      service,
      limit: 1000
    });

    const slowestRequests = allEntries
      .sort((a, b) => b.latencyMs - a.latencyMs)
      .slice(0, 10);

    // By service average latency
    const byService: Record<AIServiceType, number> = {} as any;
    for (const svc of Object.values(AIServiceType)) {
      byService[svc] = aggregation.byService[svc].avgLatency;
    }

    return {
      percentiles: {
        p50: aggregation.latencyP50,
        p90: aggregation.latencyP90,
        p95: aggregation.latencyP95,
        p99: aggregation.latencyP99
      },
      average: aggregation.latencyAvg,
      byService,
      slowestRequests
    };
  }

  /**
   * Get cost analysis
   */
  async getCostAnalysis(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCost: number;
    avgCostPerRequest: number;
    byService: Record<AIServiceType, { totalCost: number; avgCost: number; requests: number }>;
    dailyCosts: { date: Date; cost: number }[];
    projectedMonthlyCost: number;
  }> {
    await this.init();

    const aggregation = await this.metricsRepo!.getAggregatedMetrics(startDate, endDate);
    const dailySummaries = await this.metricsRepo!.getDailySummaries({ startDate, endDate });

    // By service costs
    const byService: Record<AIServiceType, any> = {} as any;
    for (const svc of Object.values(AIServiceType)) {
      const svcData = aggregation.byService[svc];
      byService[svc] = {
        totalCost: svcData.totalCost,
        avgCost: svcData.requests > 0 ? svcData.totalCost / svcData.requests : 0,
        requests: svcData.requests
      };
    }

    // Daily costs
    const dailyCosts = dailySummaries.map(d => ({
      date: d.date,
      cost: d.totalCostUsd
    }));

    // Project monthly cost based on average daily cost
    const daysInRange = Math.max(1, dailySummaries.length);
    const avgDailyCost = aggregation.totalCostUsd / daysInRange;
    const projectedMonthlyCost = avgDailyCost * 30;

    return {
      totalCost: aggregation.totalCostUsd,
      avgCostPerRequest: aggregation.avgCostPerRequest,
      byService,
      dailyCosts,
      projectedMonthlyCost
    };
  }

  /**
   * Get performance metrics for a specific service
   */
  async getServicePerformance(
    service: AIServiceType,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRequests: number;
    successRate: number;
    avgLatency: number;
    latencyPercentiles: { p50: number; p90: number; p95: number; p99: number };
    totalCost: number;
    avgRating: number;
    errorBreakdown: Record<AIErrorCategory, number>;
  }> {
    await this.init();

    const aggregation = await this.metricsRepo!.getAggregatedMetrics(startDate, endDate, service);
    const svcData = aggregation.byService[service];

    return {
      totalRequests: svcData.requests,
      successRate: svcData.successRate,
      avgLatency: svcData.avgLatency,
      latencyPercentiles: {
        p50: aggregation.latencyP50,
        p90: aggregation.latencyP90,
        p95: aggregation.latencyP95,
        p99: aggregation.latencyP99
      },
      totalCost: svcData.totalCost,
      avgRating: svcData.avgRating,
      errorBreakdown: aggregation.errorsByCategory
    };
  }

  /**
   * Get feedback statistics
   */
  async getFeedbackStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalFeedback: number;
    avgRating: number;
    ratingDistribution: Record<FeedbackRating, number>;
    byService: Record<AIServiceType, { avgRating: number; count: number }>;
    accuracyRate: number;
  }> {
    await this.init();

    const feedback = await this.metricsRepo!.getFeedback({
      startDate,
      endDate,
      limit: 10000
    });

    const ratingDistribution: Record<FeedbackRating, number> = {
      [FeedbackRating.VERY_POOR]: 0,
      [FeedbackRating.POOR]: 0,
      [FeedbackRating.NEUTRAL]: 0,
      [FeedbackRating.GOOD]: 0,
      [FeedbackRating.EXCELLENT]: 0
    };

    let totalRating = 0;
    let accurateCount = 0;

    for (const fb of feedback) {
      ratingDistribution[fb.rating]++;
      totalRating += fb.rating;
    }

    // Calculate by service
    const byService: Record<AIServiceType, any> = {} as any;
    for (const svc of Object.values(AIServiceType)) {
      const svcFeedback = feedback.filter(f => f.service === svc);
      byService[svc] = {
        avgRating: svcFeedback.length > 0
          ? svcFeedback.reduce((sum, f) => sum + f.rating, 0) / svcFeedback.length
          : 0,
        count: svcFeedback.length
      };
    }

    return {
      totalFeedback: feedback.length,
      avgRating: feedback.length > 0 ? totalRating / feedback.length : 0,
      ratingDistribution,
      byService,
      accuracyRate: feedback.length > 0 ? (accurateCount / feedback.length) * 100 : 0
    };
  }

  /**
   * Get token usage statistics
   */
  async getTokenUsageStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    avgTokensPerRequest: number;
    byService: Record<AIServiceType, { input: number; output: number; total: number }>;
    estimatedPercentage: number;
  }> {
    await this.init();

    const aggregation = await this.metricsRepo!.getAggregatedMetrics(startDate, endDate);

    // Get all metrics to calculate estimated percentage
    const { entries } = await this.metricsRepo!.getMetrics({
      startDate,
      endDate,
      limit: 10000
    });

    const estimatedCount = entries.filter(e => e.tokenUsage.isEstimated).length;
    const estimatedPercentage = entries.length > 0
      ? (estimatedCount / entries.length) * 100
      : 0;

    // Calculate by service
    const byService: Record<AIServiceType, any> = {} as any;
    for (const svc of Object.values(AIServiceType)) {
      const svcAgg = await this.metricsRepo!.getAggregatedMetrics(startDate, endDate, svc);
      byService[svc] = {
        input: svcAgg.totalInputTokens,
        output: svcAgg.totalOutputTokens,
        total: svcAgg.totalInputTokens + svcAgg.totalOutputTokens
      };
    }

    return {
      totalInputTokens: aggregation.totalInputTokens,
      totalOutputTokens: aggregation.totalOutputTokens,
      totalTokens: aggregation.totalInputTokens + aggregation.totalOutputTokens,
      avgTokensPerRequest: aggregation.avgTokensPerRequest,
      byService,
      estimatedPercentage
    };
  }

  /**
   * Get latency statistics
   */
  async getLatencyStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    average: number;
    percentiles: { p50: number; p90: number; p95: number; p99: number };
    byService: Record<AIServiceType, { avg: number; p95: number }>;
    trends: { date: Date; avgLatency: number }[];
  }> {
    await this.init();

    const aggregation = await this.metricsRepo!.getAggregatedMetrics(startDate, endDate);
    const dailySummaries = await this.metricsRepo!.getDailySummaries({ startDate, endDate });

    // Calculate by service
    const byService: Record<AIServiceType, any> = {} as any;
    for (const svc of Object.values(AIServiceType)) {
      const svcAgg = await this.metricsRepo!.getAggregatedMetrics(startDate, endDate, svc);
      byService[svc] = {
        avg: svcAgg.latencyAvg,
        p95: svcAgg.latencyP95
      };
    }

    return {
      average: aggregation.latencyAvg,
      percentiles: {
        p50: aggregation.latencyP50,
        p90: aggregation.latencyP90,
        p95: aggregation.latencyP95,
        p99: aggregation.latencyP99
      },
      byService,
      trends: dailySummaries.map(d => ({
        date: d.date,
        avgLatency: d.avgLatencyMs
      }))
    };
  }

  /**
   * Get token usage analysis
   */
  async getTokenUsageAnalysis(
    range: '30d' | '90d' | '1y' = '30d'
  ): Promise<{
    totalInputTokens: number;
    totalOutputTokens: number;
    avgTokensPerRequest: number;
    estimatedPercentage: number;
    byService: Record<AIServiceType, { input: number; output: number; total: number }>;
  }> {
    await this.init();

    const { startDate, endDate } = this.parseDateRange(range);
    
    // Get all metrics to calculate estimated percentage
    const { entries } = await this.metricsRepo!.getMetrics({
      startDate,
      endDate,
      limit: 10000
    });

    const estimatedCount = entries.filter(e => e.tokenUsage.isEstimated).length;
    const estimatedPercentage = entries.length > 0 
      ? (estimatedCount / entries.length) * 100 
      : 0;

    const aggregation = await this.metricsRepo!.getAggregatedMetrics(startDate, endDate);

    // Calculate by service
    const byService: Record<AIServiceType, any> = {} as any;
    for (const svc of Object.values(AIServiceType)) {
      // We need to query per service for token breakdown
      const svcAgg = await this.metricsRepo!.getAggregatedMetrics(startDate, endDate, svc);
      byService[svc] = {
        input: svcAgg.totalInputTokens,
        output: svcAgg.totalOutputTokens,
        total: svcAgg.totalInputTokens + svcAgg.totalOutputTokens
      };
    }

    return {
      totalInputTokens: aggregation.totalInputTokens,
      totalOutputTokens: aggregation.totalOutputTokens,
      avgTokensPerRequest: aggregation.avgTokensPerRequest,
      estimatedPercentage,
      byService
    };
  }

  // ============================================================================
  // Feedback Management
  // ============================================================================

  /**
   * Submit feedback for an AI output (from routes)
   */
  async submitFeedback(submission: FeedbackSubmission | RouteFeedbackSubmission): Promise<AIFeedback> {
    await this.init();

    // Determine which type of submission we're handling
    const isRouteSubmission = 'metricsEntryId' in submission;
    const metricsId = isRouteSubmission
      ? (submission as RouteFeedbackSubmission).metricsEntryId
      : (submission as FeedbackSubmission).metricsId;

    // Validate metrics ID exists
    const metrics = await this.metricsRepo!.getMetricsById(metricsId);
    if (!metrics) {
      throw new Error(`Metrics entry not found: ${metricsId}`);
    }

    // Check if feedback already exists
    const existingFeedback = await this.metricsRepo!.getFeedbackByMetricsId(metricsId);
    if (existingFeedback) {
      throw new Error('Feedback already submitted for this metrics entry');
    }

    let feedback: AIFeedback;

    if (isRouteSubmission) {
      const routeSubmission = submission as RouteFeedbackSubmission;
      feedback = {
        feedbackId: new ObjectId().toString(),
        metricsId,
        service: routeSubmission.serviceType,
        rating: routeSubmission.rating as FeedbackRating,
        wasEdited: false,
        feedbackText: routeSubmission.comments,
        ratedBy: routeSubmission.submittedBy,
        ratedAt: routeSubmission.submittedAt
      };
    } else {
      const regularSubmission = submission as FeedbackSubmission;
      feedback = {
        feedbackId: new ObjectId().toString(),
        metricsId,
        service: regularSubmission.service,
        candidateId: regularSubmission.candidateId,
        jobId: regularSubmission.jobId,
        rating: regularSubmission.rating,
        wasEdited: regularSubmission.wasEdited,
        editPercentage: regularSubmission.editPercentage,
        feedbackText: regularSubmission.feedbackText,
        ratedBy: regularSubmission.ratedBy,
        ratedByEmail: regularSubmission.ratedByEmail,
        ratedAt: new Date()
      };
    }

    await this.metricsRepo!.saveFeedback(feedback);

    return feedback;
  }

  /**
   * Get feedback for a metrics entry
   */
  async getFeedbackByMetricsId(metricsId: string): Promise<AIFeedback | null> {
    await this.init();
    return await this.metricsRepo!.getFeedbackByMetricsId(metricsId);
  }

  /**
   * Get feedback analysis
   */
  async getFeedbackAnalysis(
    range: '30d' | '90d' | '1y' = '30d',
    service?: AIServiceType
  ): Promise<{
    avgRating: number;
    totalFeedback: number;
    ratingDistribution: Record<FeedbackRating, number>;
    editRate: number;
    avgEditPercentage: number;
    byService: Record<AIServiceType, { avgRating: number; count: number; editRate: number }>;
    recentFeedback: AIFeedback[];
  }> {
    await this.init();

    const { startDate, endDate } = this.parseDateRange(range);
    
    const feedback = await this.metricsRepo!.getFeedback({
      service,
      startDate,
      endDate,
      limit: 1000
    });

    // Calculate rating distribution
    const ratingDistribution: Record<FeedbackRating, number> = {
      [FeedbackRating.VERY_POOR]: 0,
      [FeedbackRating.POOR]: 0,
      [FeedbackRating.NEUTRAL]: 0,
      [FeedbackRating.GOOD]: 0,
      [FeedbackRating.EXCELLENT]: 0
    };

    let totalRating = 0;
    let editedCount = 0;
    let totalEditPercentage = 0;
    let editedWithPercentage = 0;

    for (const fb of feedback) {
      ratingDistribution[fb.rating]++;
      totalRating += fb.rating;
      if (fb.wasEdited) {
        editedCount++;
        if (fb.editPercentage !== undefined) {
          totalEditPercentage += fb.editPercentage;
          editedWithPercentage++;
        }
      }
    }

    // Calculate by service
    const byService: Record<AIServiceType, any> = {} as any;
    for (const svc of Object.values(AIServiceType)) {
      const svcFeedback = feedback.filter(f => f.service === svc);
      const svcEdited = svcFeedback.filter(f => f.wasEdited).length;
      byService[svc] = {
        avgRating: svcFeedback.length > 0 
          ? svcFeedback.reduce((sum, f) => sum + f.rating, 0) / svcFeedback.length 
          : 0,
        count: svcFeedback.length,
        editRate: svcFeedback.length > 0 ? (svcEdited / svcFeedback.length) * 100 : 0
      };
    }

    return {
      avgRating: feedback.length > 0 ? totalRating / feedback.length : 0,
      totalFeedback: feedback.length,
      ratingDistribution,
      editRate: feedback.length > 0 ? (editedCount / feedback.length) * 100 : 0,
      avgEditPercentage: editedWithPercentage > 0 ? totalEditPercentage / editedWithPercentage : 0,
      byService,
      recentFeedback: feedback.slice(0, 10)
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Estimate cost for a potential request
   */
  estimateCost(
    inputText: string,
    estimatedOutputLength: number = 2000,
    modelVersion: string = DEFAULT_MODEL_VERSION
  ): CostEstimate {
    const charsPerToken = TOKEN_ESTIMATION.CHARS_PER_TOKEN;
    const overhead = TOKEN_ESTIMATION.OVERHEAD_MULTIPLIER;

    const inputTokens = Math.ceil((inputText.length / charsPerToken) * overhead);
    const outputTokens = Math.ceil((estimatedOutputLength / charsPerToken) * overhead);

    const pricing = GEMINI_PRICING[modelVersion as keyof typeof GEMINI_PRICING]
      || GEMINI_PRICING[DEFAULT_MODEL_VERSION as keyof typeof GEMINI_PRICING];

    const inputCostUsd = (inputTokens / 1_000_000) * pricing.inputPer1M;
    const outputCostUsd = (outputTokens / 1_000_000) * pricing.outputPer1M;

    return {
      inputCostUsd,
      outputCostUsd,
      totalCostUsd: inputCostUsd + outputCostUsd,
      isEstimated: true
    };
  }

  /**
   * Get service health status
   */
  async getServiceHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'critical';
    byService: Record<AIServiceType, {
      status: 'healthy' | 'degraded' | 'critical';
      errorRate: number;
      avgLatency: number;
      lastSuccess?: Date;
      lastError?: Date;
    }>;
  }> {
    await this.init();

    const windowMinutes = 60; // Last hour
    const now = new Date();
    const startTime = new Date(now.getTime() - windowMinutes * 60 * 1000);

    const byService: Record<AIServiceType, any> = {} as any;
    let worstStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';

    for (const svc of Object.values(AIServiceType)) {
      const { entries } = await this.metricsRepo!.getMetrics({
        service: svc,
        startDate: startTime,
        endDate: now,
        limit: 100
      });

      if (entries.length === 0) {
        byService[svc] = {
          status: 'healthy', // No data = no problems (or no usage)
          errorRate: 0,
          avgLatency: 0
        };
        continue;
      }

      const errors = entries.filter(e => !e.success).length;
      const errorRate = (errors / entries.length) * 100;
      const avgLatency = entries.reduce((sum, e) => sum + e.latencyMs, 0) / entries.length;

      const lastSuccess = entries.find(e => e.success)?.timestamp;
      const lastError = entries.find(e => !e.success)?.timestamp;

      // Determine status
      let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
      if (errorRate >= 15 || avgLatency >= 10000) {
        status = 'critical';
      } else if (errorRate >= 5 || avgLatency >= 5000) {
        status = 'degraded';
      }

      if (status === 'critical') worstStatus = 'critical';
      else if (status === 'degraded' && worstStatus !== 'critical') worstStatus = 'degraded';

      byService[svc] = {
        status,
        errorRate,
        avgLatency,
        lastSuccess,
        lastError
      };
    }

    return {
      overall: worstStatus,
      byService
    };
  }
}

// Export singleton instance
export const aiMetricsService = AIMetricsService.getInstance();
