/**
 * AI Alert Service
 * Monitors AI performance metrics and triggers alerts when thresholds are exceeded
 * Logs alerts for admin dashboard viewing
 */

import { Db, ObjectId } from 'mongodb';
import { connectDB } from '../mongo_db';
import { AIMetricsRepository } from '../repositories/AIMetricsRepository';
import {
  AIAlert,
  AIAlertType,
  AlertSeverity,
  AlertThresholds,
  AIServiceType,
  DEFAULT_ALERT_THRESHOLDS,
  AI_METRICS_COLLECTIONS
} from '../Models/AIMetrics';
import { NotificationPriority } from '../Models/enums/NotificationTypes';

// ============================================================================
// Types
// ============================================================================

export interface AlertCheckResult {
  alertTriggered: boolean;
  alertType?: AIAlertType;
  severity?: AlertSeverity;
  currentValue?: number;
  threshold?: number;
  message?: string;
}

export interface AlertSummary {
  activeAlerts: number;
  criticalAlerts: number;
  highAlerts: number;
  mediumAlerts: number;
  lowAlerts: number;
  recentAlerts: AIAlert[];
}

// ============================================================================
// Service Implementation
// ============================================================================

export class AIAlertService {
  private static instance: AIAlertService;
  private db: Db | null = null;
  private metricsRepo: AIMetricsRepository | null = null;
  private thresholds: AlertThresholds;
  private checkIntervalMs: number = 5 * 60 * 1000; // 5 minutes
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(db?: Db, thresholds: AlertThresholds = DEFAULT_ALERT_THRESHOLDS) {
    this.thresholds = thresholds;
    if (db) {
      this.db = db;
      this.metricsRepo = new AIMetricsRepository(db);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AIAlertService {
    if (!AIAlertService.instance) {
      AIAlertService.instance = new AIAlertService();
    }
    return AIAlertService.instance;
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

  // ============================================================================
  // Alert Monitoring
  // ============================================================================

  /**
   * Start background monitoring
   */
  startMonitoring(intervalMs?: number): void {
    if (this.checkInterval) {
      this.stopMonitoring();
    }

    this.checkIntervalMs = intervalMs || this.checkIntervalMs;
    
    // Run initial check
    this.runAlertChecks().catch(err => {
      console.error('Initial alert check failed:', err);
    });

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runAlertChecks().catch(err => {
        console.error('Periodic alert check failed:', err);
      });
    }, this.checkIntervalMs);

    console.log(`AI Alert monitoring started (interval: ${this.checkIntervalMs / 1000}s)`);
  }

  /**
   * Stop background monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('AI Alert monitoring stopped');
    }
  }

  /**
   * Run all alert checks
   */
  async runAlertChecks(): Promise<AlertCheckResult[]> {
    await this.init();

    const results: AlertCheckResult[] = [];
    const windowMinutes = 15; // Check last 15 minutes

    // Check error rate (global)
    const errorRateResult = await this.checkErrorRate(windowMinutes);
    results.push(errorRateResult);
    if (errorRateResult.alertTriggered) {
      await this.createAndNotifyAlert(errorRateResult);
    }

    // Check latency (global)
    const latencyResult = await this.checkLatency(windowMinutes);
    results.push(latencyResult);
    if (latencyResult.alertTriggered) {
      await this.createAndNotifyAlert(latencyResult);
    }

    // Check daily cost
    const costResult = await this.checkDailyCost();
    results.push(costResult);
    if (costResult.alertTriggered) {
      await this.createAndNotifyAlert(costResult);
    }

    // Check per-service health
    for (const service of Object.values(AIServiceType)) {
      const serviceResult = await this.checkServiceHealth(service, windowMinutes);
      results.push(serviceResult);
      if (serviceResult.alertTriggered) {
        await this.createAndNotifyAlert(serviceResult, service);
      }
    }

    // Auto-resolve alerts that are no longer active
    await this.autoResolveAlerts(results);

    return results;
  }

  /**
   * Check error rate threshold
   */
  private async checkErrorRate(windowMinutes: number): Promise<AlertCheckResult> {
    const errorRate = await this.metricsRepo!.getErrorRate(windowMinutes);

    if (errorRate >= this.thresholds.errorRateCritical) {
      return {
        alertTriggered: true,
        alertType: AIAlertType.HIGH_ERROR_RATE,
        severity: AlertSeverity.CRITICAL,
        currentValue: errorRate,
        threshold: this.thresholds.errorRateCritical,
        message: `Critical: AI error rate is ${errorRate.toFixed(1)}% (threshold: ${this.thresholds.errorRateCritical}%)`
      };
    }

    if (errorRate >= this.thresholds.errorRateWarning) {
      return {
        alertTriggered: true,
        alertType: AIAlertType.HIGH_ERROR_RATE,
        severity: AlertSeverity.MEDIUM,
        currentValue: errorRate,
        threshold: this.thresholds.errorRateWarning,
        message: `Warning: AI error rate is ${errorRate.toFixed(1)}% (threshold: ${this.thresholds.errorRateWarning}%)`
      };
    }

    return { alertTriggered: false };
  }

  /**
   * Check latency threshold
   */
  private async checkLatency(windowMinutes: number): Promise<AlertCheckResult> {
    const p95Latency = await this.metricsRepo!.getP95Latency(windowMinutes);

    if (p95Latency >= this.thresholds.latencyP95Critical) {
      return {
        alertTriggered: true,
        alertType: AIAlertType.HIGH_LATENCY,
        severity: AlertSeverity.CRITICAL,
        currentValue: p95Latency,
        threshold: this.thresholds.latencyP95Critical,
        message: `Critical: AI P95 latency is ${(p95Latency / 1000).toFixed(1)}s (threshold: ${this.thresholds.latencyP95Critical / 1000}s)`
      };
    }

    if (p95Latency >= this.thresholds.latencyP95Warning) {
      return {
        alertTriggered: true,
        alertType: AIAlertType.HIGH_LATENCY,
        severity: AlertSeverity.MEDIUM,
        currentValue: p95Latency,
        threshold: this.thresholds.latencyP95Warning,
        message: `Warning: AI P95 latency is ${(p95Latency / 1000).toFixed(1)}s (threshold: ${this.thresholds.latencyP95Warning / 1000}s)`
      };
    }

    return { alertTriggered: false };
  }

  /**
   * Check daily cost threshold
   */
  private async checkDailyCost(): Promise<AlertCheckResult> {
    const dailyCost = await this.metricsRepo!.getDailyCost(new Date());

    if (dailyCost >= this.thresholds.dailyCostCritical) {
      return {
        alertTriggered: true,
        alertType: AIAlertType.COST_SPIKE,
        severity: AlertSeverity.CRITICAL,
        currentValue: dailyCost,
        threshold: this.thresholds.dailyCostCritical,
        message: `Critical: Daily AI cost is $${dailyCost.toFixed(2)} (threshold: $${this.thresholds.dailyCostCritical})`
      };
    }

    if (dailyCost >= this.thresholds.dailyCostWarning) {
      return {
        alertTriggered: true,
        alertType: AIAlertType.COST_SPIKE,
        severity: AlertSeverity.MEDIUM,
        currentValue: dailyCost,
        threshold: this.thresholds.dailyCostWarning,
        message: `Warning: Daily AI cost is $${dailyCost.toFixed(2)} (threshold: $${this.thresholds.dailyCostWarning})`
      };
    }

    return { alertTriggered: false };
  }

  /**
   * Check individual service health
   */
  private async checkServiceHealth(
    service: AIServiceType,
    windowMinutes: number
  ): Promise<AlertCheckResult> {
    const errorRate = await this.metricsRepo!.getErrorRate(windowMinutes, service);
    const p95Latency = await this.metricsRepo!.getP95Latency(windowMinutes, service);

    // Check for service-specific issues
    if (errorRate >= 25) { // Higher threshold for individual service
      return {
        alertTriggered: true,
        alertType: AIAlertType.SERVICE_DEGRADATION,
        severity: AlertSeverity.HIGH,
        currentValue: errorRate,
        threshold: 25,
        message: `Service degradation: ${service} error rate is ${errorRate.toFixed(1)}%`
      };
    }

    if (p95Latency >= 15000) { // 15s for individual service
      return {
        alertTriggered: true,
        alertType: AIAlertType.SERVICE_DEGRADATION,
        severity: AlertSeverity.HIGH,
        currentValue: p95Latency,
        threshold: 15000,
        message: `Service degradation: ${service} P95 latency is ${(p95Latency / 1000).toFixed(1)}s`
      };
    }

    return { alertTriggered: false };
  }

  // ============================================================================
  // Alert Management
  // ============================================================================

  /**
   * Create alert and send notification
   */
  private async createAndNotifyAlert(
    result: AlertCheckResult,
    service?: AIServiceType
  ): Promise<void> {
    if (!result.alertTriggered || !result.alertType || !result.severity) return;

    // Check if similar alert already exists and is active
    const existingAlerts = await this.metricsRepo!.getActiveAlerts({
      alertType: result.alertType,
      service
    });

    // Don't create duplicate alerts
    if (existingAlerts.length > 0) {
      return;
    }

    const now = new Date();
    const alert: AIAlert = {
      alertId: new ObjectId().toString(),
      alertType: result.alertType,
      severity: result.severity,
      service,
      message: result.message || 'AI alert triggered',
      currentValue: result.currentValue || 0,
      threshold: result.threshold || 0,
      windowStartTime: new Date(now.getTime() - 15 * 60 * 1000),
      windowEndTime: now,
      isActive: true,
      createdAt: now,
      metadata: {
        checkTime: now.toISOString()
      }
    };

    await this.metricsRepo!.createAlert(alert);

    // Send notification to admins
    await this.sendAlertNotification(alert);
  }

  /**
   * Send notification for an alert (logs to console for now)
   * TODO: Integrate with WebSocket broadcastToAdmins when available
   */
  private async sendAlertNotification(alert: AIAlert): Promise<void> {
    try {
      // Map severity to notification priority
      const priorityMap: Record<AlertSeverity, NotificationPriority> = {
        [AlertSeverity.LOW]: NotificationPriority.LOW,
        [AlertSeverity.MEDIUM]: NotificationPriority.MEDIUM,
        [AlertSeverity.HIGH]: NotificationPriority.HIGH,
        [AlertSeverity.CRITICAL]: NotificationPriority.CRITICAL
      };

      // Log the alert for now - WebSocket integration can be added later
      console.log(`[AI ALERT] ${priorityMap[alert.severity]}: ${this.getAlertTypeLabel(alert.alertType)}`);
      console.log(`  Message: ${alert.message}`);
      console.log(`  Alert ID: ${alert.alertId}`);
      console.log(`  Service: ${alert.service || 'all'}`);
      console.log(`  Current Value: ${alert.currentValue}, Threshold: ${alert.threshold}`);
    } catch (error) {
      console.error('Failed to send alert notification:', error);
    }
  }

  /**
   * Get human-readable alert type label
   */
  private getAlertTypeLabel(alertType: AIAlertType): string {
    const labels: Record<AIAlertType, string> = {
      [AIAlertType.HIGH_ERROR_RATE]: 'High Error Rate',
      [AIAlertType.HIGH_LATENCY]: 'High Latency',
      [AIAlertType.COST_SPIKE]: 'Cost Spike',
      [AIAlertType.LOW_QUALITY_SCORE]: 'Low Quality Score',
      [AIAlertType.RATE_LIMIT_WARNING]: 'Rate Limit Warning',
      [AIAlertType.SERVICE_DEGRADATION]: 'Service Degradation'
    };
    return labels[alertType] || alertType;
  }

  /**
   * Auto-resolve alerts that are no longer triggered
   */
  private async autoResolveAlerts(currentResults: AlertCheckResult[]): Promise<void> {
    const activeAlerts = await this.metricsRepo!.getActiveAlerts();

    for (const alert of activeAlerts) {
      // Find corresponding check result
      const correspondingResult = currentResults.find(r => 
        r.alertType === alert.alertType && 
        (!alert.service || r.alertTriggered === false)
      );

      // If no alert triggered for this type, resolve it
      if (correspondingResult && !correspondingResult.alertTriggered) {
        await this.metricsRepo!.resolveAlert(alert.alertId);
        
        // Log resolution notification
        try {
          console.log(`[AI ALERT RESOLVED] ${this.getAlertTypeLabel(alert.alertType)}`);
          console.log(`  Alert ID: ${alert.alertId}`);
          console.log(`  Resolved at: ${new Date().toISOString()}`);
        } catch (error) {
          console.error('Failed to send resolution notification:', error);
        }
      }
    }
  }

  // ============================================================================
  // Alert Queries
  // ============================================================================

  /**
   * Get alert summary
   */
  async getAlertSummary(): Promise<AlertSummary> {
    await this.init();

    const activeAlerts = await this.metricsRepo!.getActiveAlerts();
    
    const criticalAlerts = activeAlerts.filter(a => a.severity === AlertSeverity.CRITICAL).length;
    const highAlerts = activeAlerts.filter(a => a.severity === AlertSeverity.HIGH).length;
    const mediumAlerts = activeAlerts.filter(a => a.severity === AlertSeverity.MEDIUM).length;
    const lowAlerts = activeAlerts.filter(a => a.severity === AlertSeverity.LOW).length;

    const recentAlerts = await this.metricsRepo!.getAlertHistory({ limit: 10 });

    return {
      activeAlerts: activeAlerts.length,
      criticalAlerts,
      highAlerts,
      mediumAlerts,
      lowAlerts,
      recentAlerts
    };
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(options?: {
    severity?: AlertSeverity;
    alertType?: AIAlertType;
    service?: AIServiceType;
  }): Promise<AIAlert[]> {
    await this.init();
    return await this.metricsRepo!.getActiveAlerts(options);
  }

  /**
   * Get alert history
   */
  async getAlertHistory(options: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AIAlert[]> {
    await this.init();
    return await this.metricsRepo!.getAlertHistory(options);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await this.init();
    await this.metricsRepo!.acknowledgeAlert(alertId, userId);
  }

  /**
   * Manually resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    await this.init();
    await this.metricsRepo!.resolveAlert(alertId);
  }

  // ============================================================================
  // Threshold Configuration
  // ============================================================================

  /**
   * Get current thresholds
   */
  getThresholds(): AlertThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds: Partial<AlertThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...newThresholds
    };
  }

  /**
   * Reset thresholds to defaults
   */
  resetThresholds(): void {
    this.thresholds = { ...DEFAULT_ALERT_THRESHOLDS };
  }

  /**
   * Get alert configuration for API response
   */
  async getAlertConfig(): Promise<{
    thresholds: AlertThresholds;
    enabled: boolean;
    checkIntervalMs: number;
  }> {
    return {
      thresholds: this.getThresholds(),
      enabled: this.checkInterval !== null,
      checkIntervalMs: this.checkIntervalMs
    };
  }

  /**
   * Update alert configuration from API request
   */
  async updateAlertConfig(config: {
    thresholds?: Partial<AlertThresholds>;
    enabled?: boolean;
    updatedBy?: string;
    updatedAt?: Date;
  }): Promise<{
    thresholds: AlertThresholds;
    enabled: boolean;
    checkIntervalMs: number;
  }> {
    if (config.thresholds) {
      this.updateThresholds(config.thresholds);
    }

    if (config.enabled !== undefined) {
      if (config.enabled && !this.checkInterval) {
        this.startMonitoring();
      } else if (!config.enabled && this.checkInterval) {
        this.stopMonitoring();
      }
    }

    return this.getAlertConfig();
  }
}

// Export singleton instance
export const aiAlertService = AIAlertService.getInstance();
