/**
 * AI Metrics Repository
 * Data access layer for AI performance metrics, feedback, and alerts
 */

import { Db, Collection, ObjectId } from 'mongodb';
import {
  AIMetricsEntry,
  AIFeedback,
  AIAlert,
  AIMetricsAggregation,
  DailyMetricsSummary,
  AIServiceType,
  AIErrorCategory,
  AIAlertType,
  AlertSeverity,
  AI_METRICS_COLLECTIONS,
  METRICS_RETENTION_DAYS
} from '../Models/AIMetrics';

export class AIMetricsRepository {
  private db: Db;
  private metricsCollection: Collection<AIMetricsEntry>;
  private feedbackCollection: Collection<AIFeedback>;
  private alertsCollection: Collection<AIAlert>;
  private dailySummariesCollection: Collection<DailyMetricsSummary>;

  constructor(db: Db) {
    this.db = db;
    this.metricsCollection = db.collection(AI_METRICS_COLLECTIONS.METRICS);
    this.feedbackCollection = db.collection(AI_METRICS_COLLECTIONS.FEEDBACK);
    this.alertsCollection = db.collection(AI_METRICS_COLLECTIONS.ALERTS);
    this.dailySummariesCollection = db.collection(AI_METRICS_COLLECTIONS.DAILY_SUMMARIES);
  }

  // ============================================================================
  // Index Setup
  // ============================================================================

  /**
   * Create indexes for AI metrics collections
   * Should be called once during application startup
   */
  async createIndexes(): Promise<void> {
    // Metrics collection indexes
    await this.metricsCollection.createIndexes([
      // TTL index for automatic deletion after retention period
      { 
        key: { timestamp: 1 }, 
        expireAfterSeconds: METRICS_RETENTION_DAYS * 24 * 60 * 60,
        name: 'ttl_timestamp'
      },
      // Query indexes
      { key: { metricsId: 1 }, unique: true, name: 'unique_metricsId' },
      { key: { service: 1, timestamp: -1 }, name: 'service_timestamp' },
      { key: { success: 1, timestamp: -1 }, name: 'success_timestamp' },
      { key: { candidateId: 1, timestamp: -1 }, name: 'candidate_timestamp' },
      { key: { userId: 1, timestamp: -1 }, name: 'user_timestamp' },
      { key: { errorCategory: 1, timestamp: -1 }, name: 'error_timestamp' }
    ]);

    // Feedback collection indexes
    await this.feedbackCollection.createIndexes([
      { 
        key: { ratedAt: 1 }, 
        expireAfterSeconds: METRICS_RETENTION_DAYS * 24 * 60 * 60,
        name: 'ttl_ratedAt'
      },
      { key: { feedbackId: 1 }, unique: true, name: 'unique_feedbackId' },
      { key: { metricsId: 1 }, name: 'metricsId' },
      { key: { service: 1, ratedAt: -1 }, name: 'service_ratedAt' },
      { key: { rating: 1 }, name: 'rating' }
    ]);

    // Alerts collection indexes
    await this.alertsCollection.createIndexes([
      { key: { alertId: 1 }, unique: true, name: 'unique_alertId' },
      { key: { isActive: 1, createdAt: -1 }, name: 'active_createdAt' },
      { key: { alertType: 1, createdAt: -1 }, name: 'type_createdAt' },
      { key: { severity: 1, isActive: 1 }, name: 'severity_active' }
    ]);

    // Daily summaries indexes
    await this.dailySummariesCollection.createIndexes([
      { 
        key: { date: 1 }, 
        expireAfterSeconds: METRICS_RETENTION_DAYS * 24 * 60 * 60,
        name: 'ttl_date'
      },
      { key: { date: 1, service: 1 }, unique: true, name: 'unique_date_service' }
    ]);
  }

  // ============================================================================
  // Metrics CRUD
  // ============================================================================

  /**
   * Log a new AI metrics entry
   */
  async logMetrics(entry: AIMetricsEntry): Promise<void> {
    await this.metricsCollection.insertOne(entry);
  }

  /**
   * Get metrics by ID
   */
  async getMetricsById(metricsId: string): Promise<AIMetricsEntry | null> {
    return await this.metricsCollection.findOne({ metricsId });
  }

  /**
   * Get metrics with filters
   */
  async getMetrics(options: {
    service?: AIServiceType;
    success?: boolean;
    candidateId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: AIMetricsEntry[]; total: number }> {
    const filter: any = {};

    if (options.service) filter.service = options.service;
    if (options.success !== undefined) filter.success = options.success;
    if (options.candidateId) filter.candidateId = options.candidateId;
    if (options.userId) filter.userId = options.userId;

    if (options.startDate || options.endDate) {
      filter.timestamp = {};
      if (options.startDate) filter.timestamp.$gte = options.startDate;
      if (options.endDate) filter.timestamp.$lte = options.endDate;
    }

    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const [entries, total] = await Promise.all([
      this.metricsCollection
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
      this.metricsCollection.countDocuments(filter)
    ]);

    return { entries, total };
  }

  // ============================================================================
  // Feedback CRUD
  // ============================================================================

  /**
   * Save feedback for an AI output
   */
  async saveFeedback(feedback: AIFeedback): Promise<void> {
    await this.feedbackCollection.insertOne(feedback);
  }

  /**
   * Get feedback by metrics ID
   */
  async getFeedbackByMetricsId(metricsId: string): Promise<AIFeedback | null> {
    return await this.feedbackCollection.findOne({ metricsId });
  }

  /**
   * Get feedback with filters
   */
  async getFeedback(options: {
    service?: AIServiceType;
    minRating?: number;
    maxRating?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AIFeedback[]> {
    const filter: any = {};

    if (options.service) filter.service = options.service;
    
    if (options.minRating || options.maxRating) {
      filter.rating = {};
      if (options.minRating) filter.rating.$gte = options.minRating;
      if (options.maxRating) filter.rating.$lte = options.maxRating;
    }

    if (options.startDate || options.endDate) {
      filter.ratedAt = {};
      if (options.startDate) filter.ratedAt.$gte = options.startDate;
      if (options.endDate) filter.ratedAt.$lte = options.endDate;
    }

    return await this.feedbackCollection
      .find(filter)
      .sort({ ratedAt: -1 })
      .limit(options.limit || 100)
      .toArray();
  }

  // ============================================================================
  // Alerts CRUD
  // ============================================================================

  /**
   * Create a new alert
   */
  async createAlert(alert: AIAlert): Promise<void> {
    await this.alertsCollection.insertOne(alert);
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(options?: {
    severity?: AlertSeverity;
    alertType?: AIAlertType;
    service?: AIServiceType;
  }): Promise<AIAlert[]> {
    const filter: any = { isActive: true };

    if (options?.severity) filter.severity = options.severity;
    if (options?.alertType) filter.alertType = options.alertType;
    if (options?.service) filter.service = options.service;

    return await this.alertsCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await this.alertsCollection.updateOne(
      { alertId },
      { 
        $set: { 
          isActive: false,
          acknowledgedBy: userId, 
          acknowledgedAt: new Date() 
        } 
      }
    );
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    await this.alertsCollection.updateOne(
      { alertId },
      { 
        $set: { 
          isActive: false, 
          resolvedAt: new Date() 
        } 
      }
    );
  }

  /**
   * Get alert history
   */
  async getAlertHistory(options: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AIAlert[]> {
    const filter: any = {};

    if (options.startDate || options.endDate) {
      filter.createdAt = {};
      if (options.startDate) filter.createdAt.$gte = options.startDate;
      if (options.endDate) filter.createdAt.$lte = options.endDate;
    }

    return await this.alertsCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(options.limit || 100)
      .toArray();
  }

  // ============================================================================
  // Aggregations
  // ============================================================================

  /**
   * Get aggregated metrics for a time period
   */
  async getAggregatedMetrics(
    startDate: Date,
    endDate: Date,
    service?: AIServiceType
  ): Promise<AIMetricsAggregation> {
    const matchStage: any = {
      timestamp: { $gte: startDate, $lte: endDate }
    };
    if (service) matchStage.service = service;

    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          // Overall counts
          counts: [
            {
              $group: {
                _id: null,
                totalRequests: { $sum: 1 },
                successfulRequests: { $sum: { $cond: ['$success', 1, 0] } },
                failedRequests: { $sum: { $cond: ['$success', 0, 1] } },
                totalInputTokens: { $sum: '$tokenUsage.promptTokens' },
                totalOutputTokens: { $sum: '$tokenUsage.completionTokens' },
                totalCostUsd: { $sum: '$costEstimate.totalCostUsd' },
                avgLatency: { $avg: '$latencyMs' },
                parseSuccessCount: { $sum: { $cond: ['$parseSuccess', 1, 0] } },
                fallbackCount: { $sum: { $cond: ['$fallbackUsed', 1, 0] } }
              }
            }
          ],
          // Latency percentiles (approximation using buckets)
          latencyStats: [
            { $sort: { latencyMs: 1 } },
            {
              $group: {
                _id: null,
                latencies: { $push: '$latencyMs' }
              }
            }
          ],
          // Errors by category
          errorsByCategory: [
            { $match: { success: false, errorCategory: { $exists: true } } },
            {
              $group: {
                _id: '$errorCategory',
                count: { $sum: 1 }
              }
            }
          ],
          // By service breakdown
          byService: [
            {
              $group: {
                _id: '$service',
                requests: { $sum: 1 },
                successCount: { $sum: { $cond: ['$success', 1, 0] } },
                avgLatency: { $avg: '$latencyMs' },
                totalCost: { $sum: '$costEstimate.totalCostUsd' }
              }
            }
          ]
        }
      }
    ];

    const [result] = await this.metricsCollection.aggregate(pipeline).toArray();

    // Get feedback stats separately
    const feedbackStats = await this.getFeedbackStats(startDate, endDate, service);

    // Process results
    const counts = result.counts[0] || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      avgLatency: 0,
      parseSuccessCount: 0,
      fallbackCount: 0
    };

    // Calculate percentiles
    const latencies = result.latencyStats[0]?.latencies || [];
    const percentiles = this.calculatePercentiles(latencies);

    // Build errors by category map
    const errorsByCategory: Record<AIErrorCategory, number> = {} as any;
    for (const cat of Object.values(AIErrorCategory)) {
      errorsByCategory[cat] = 0;
    }
    for (const err of result.errorsByCategory) {
      errorsByCategory[err._id as AIErrorCategory] = err.count;
    }

    // Build by service map
    const byService: AIMetricsAggregation['byService'] = {} as any;
    for (const svc of Object.values(AIServiceType)) {
      byService[svc] = {
        requests: 0,
        successRate: 0,
        avgLatency: 0,
        totalCost: 0,
        avgRating: 0
      };
    }
    for (const svc of result.byService) {
      const serviceType = svc._id as AIServiceType;
      byService[serviceType] = {
        requests: svc.requests,
        successRate: svc.requests > 0 ? (svc.successCount / svc.requests) * 100 : 0,
        avgLatency: svc.avgLatency || 0,
        totalCost: svc.totalCost || 0,
        avgRating: feedbackStats.byService[serviceType]?.avgRating || 0
      };
    }

    // Determine period label
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    let period: AIMetricsAggregation['period'] = 'custom';
    if (daysDiff <= 31) period = '30d';
    else if (daysDiff <= 91) period = '90d';
    else if (daysDiff <= 366) period = '1y';

    return {
      period,
      startDate,
      endDate,
      totalRequests: counts.totalRequests,
      successfulRequests: counts.successfulRequests,
      failedRequests: counts.failedRequests,
      errorsByCategory,
      latencyP50: percentiles.p50,
      latencyP90: percentiles.p90,
      latencyP95: percentiles.p95,
      latencyP99: percentiles.p99,
      latencyAvg: counts.avgLatency || 0,
      totalInputTokens: counts.totalInputTokens,
      totalOutputTokens: counts.totalOutputTokens,
      avgTokensPerRequest: counts.totalRequests > 0 
        ? (counts.totalInputTokens + counts.totalOutputTokens) / counts.totalRequests 
        : 0,
      totalCostUsd: counts.totalCostUsd,
      avgCostPerRequest: counts.totalRequests > 0 
        ? counts.totalCostUsd / counts.totalRequests 
        : 0,
      estimatedVsActualRatio: 1.0, // TODO: Track actual vs estimated
      avgFeedbackRating: feedbackStats.avgRating,
      totalFeedbackCount: feedbackStats.totalCount,
      editRate: feedbackStats.editRate,
      parseSuccessRate: counts.totalRequests > 0 
        ? (counts.parseSuccessCount / counts.totalRequests) * 100 
        : 0,
      fallbackRate: counts.totalRequests > 0 
        ? (counts.fallbackCount / counts.totalRequests) * 100 
        : 0,
      byService
    };
  }

  /**
   * Get feedback statistics
   */
  private async getFeedbackStats(
    startDate: Date,
    endDate: Date,
    service?: AIServiceType
  ): Promise<{
    avgRating: number;
    totalCount: number;
    editRate: number;
    byService: Record<AIServiceType, { avgRating: number; count: number }>;
  }> {
    const matchStage: any = {
      ratedAt: { $gte: startDate, $lte: endDate }
    };
    if (service) matchStage.service = service;

    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                avgRating: { $avg: '$rating' },
                totalCount: { $sum: 1 },
                editedCount: { $sum: { $cond: ['$wasEdited', 1, 0] } }
              }
            }
          ],
          byService: [
            {
              $group: {
                _id: '$service',
                avgRating: { $avg: '$rating' },
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ];

    const [result] = await this.feedbackCollection.aggregate(pipeline).toArray();

    const overall = result.overall[0] || { avgRating: 0, totalCount: 0, editedCount: 0 };

    const byService: Record<AIServiceType, { avgRating: number; count: number }> = {} as any;
    for (const svc of Object.values(AIServiceType)) {
      byService[svc] = { avgRating: 0, count: 0 };
    }
    for (const svc of result.byService) {
      byService[svc._id as AIServiceType] = {
        avgRating: svc.avgRating || 0,
        count: svc.count
      };
    }

    return {
      avgRating: overall.avgRating || 0,
      totalCount: overall.totalCount,
      editRate: overall.totalCount > 0 
        ? (overall.editedCount / overall.totalCount) * 100 
        : 0,
      byService
    };
  }

  /**
   * Calculate percentiles from sorted array
   */
  private calculatePercentiles(sortedValues: number[]): {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  } {
    if (sortedValues.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const getPercentile = (arr: number[], p: number): number => {
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, Math.min(index, arr.length - 1))];
    };

    return {
      p50: getPercentile(sortedValues, 50),
      p90: getPercentile(sortedValues, 90),
      p95: getPercentile(sortedValues, 95),
      p99: getPercentile(sortedValues, 99)
    };
  }

  /**
   * Get daily summaries for trend charts
   */
  async getDailySummaries(options: {
    startDate: Date;
    endDate: Date;
    service?: AIServiceType;
  }): Promise<DailyMetricsSummary[]> {
    const matchStage: any = {
      timestamp: { $gte: options.startDate, $lte: options.endDate }
    };
    if (options.service) matchStage.service = options.service;

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            service: options.service ? '$service' : null
          },
          requestCount: { $sum: 1 },
          successCount: { $sum: { $cond: ['$success', 1, 0] } },
          errorCount: { $sum: { $cond: ['$success', 0, 1] } },
          avgLatencyMs: { $avg: '$latencyMs' },
          latencies: { $push: '$latencyMs' },
          totalTokens: { $sum: '$tokenUsage.totalTokens' },
          totalCostUsd: { $sum: '$costEstimate.totalCostUsd' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ];

    const results = await this.metricsCollection.aggregate(pipeline).toArray();

    return results.map(r => {
      const latencies = (r.latencies as number[]).sort((a, b) => a - b);
      return {
        date: new Date(r._id.date),
        service: options.service,
        requestCount: r.requestCount,
        successCount: r.successCount,
        errorCount: r.errorCount,
        avgLatencyMs: r.avgLatencyMs || 0,
        p95LatencyMs: this.calculatePercentiles(latencies).p95,
        totalTokens: r.totalTokens,
        totalCostUsd: r.totalCostUsd,
        feedbackCount: 0 // Populated separately if needed
      };
    });
  }

  /**
   * Get recent error details for debugging
   */
  async getRecentErrors(options: {
    limit?: number;
    service?: AIServiceType;
    errorCategory?: AIErrorCategory;
  }): Promise<AIMetricsEntry[]> {
    const filter: any = { success: false };
    
    if (options.service) filter.service = options.service;
    if (options.errorCategory) filter.errorCategory = options.errorCategory;

    return await this.metricsCollection
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(options.limit || 50)
      .toArray();
  }

  /**
   * Get error rate for alerting
   */
  async getErrorRate(windowMinutes: number, service?: AIServiceType): Promise<number> {
    const startTime = new Date(Date.now() - windowMinutes * 60 * 1000);
    
    const filter: any = { timestamp: { $gte: startTime } };
    if (service) filter.service = service;

    const [total, errors] = await Promise.all([
      this.metricsCollection.countDocuments(filter),
      this.metricsCollection.countDocuments({ ...filter, success: false })
    ]);

    return total > 0 ? (errors / total) * 100 : 0;
  }

  /**
   * Get P95 latency for alerting
   */
  async getP95Latency(windowMinutes: number, service?: AIServiceType): Promise<number> {
    const startTime = new Date(Date.now() - windowMinutes * 60 * 1000);
    
    const matchStage: any = { timestamp: { $gte: startTime } };
    if (service) matchStage.service = service;

    const result = await this.metricsCollection
      .find(matchStage)
      .project({ latencyMs: 1 })
      .sort({ latencyMs: 1 })
      .toArray();

    const latencies = result.map(r => r.latencyMs);
    return this.calculatePercentiles(latencies).p95;
  }

  /**
   * Get daily cost for alerting
   */
  async getDailyCost(date: Date, service?: AIServiceType): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const matchStage: any = { 
      timestamp: { $gte: startOfDay, $lte: endOfDay } 
    };
    if (service) matchStage.service = service;

    const result = await this.metricsCollection.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalCost: { $sum: '$costEstimate.totalCostUsd' }
        }
      }
    ]).toArray();

    return result[0]?.totalCost || 0;
  }
}
