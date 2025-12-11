import { Router, Response } from 'express';
import { AuthMiddleware, AuthenticatedRequest } from './middleware/auth';
import { AIMetricsService } from '../services/AIMetricsService';
import { AIAlertService } from '../services/AIAlertService';
import { connectDB } from '../mongo_db';
import { AuditLogger } from '../utils/AuditLogger';
import { AuditEventType } from '../types/AuditEventTypes';
import { AIServiceType, ComparisonType } from '../Models/AIMetrics';

const router = Router();

// Valid date range options
const DATE_RANGES = {
  '30d': 30,
  '90d': 90,
  '1y': 365
} as const;

type DateRangeKey = keyof typeof DATE_RANGES;

/**
 * Parse date range from query parameter
 */
function parseDateRange(range: string | undefined): number {
  if (!range) return 30; // Default to 30 days
  const key = range as DateRangeKey;
  return DATE_RANGES[key] || 30;
}

/**
 * Calculate start date based on days
 */
function getStartDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * @route   GET /api/ai-metrics/dashboard
 * @desc    Get AI metrics dashboard data (with optional trend comparison)
 * @access  Private (Admin)
 * @query   range - Date range (30d, 90d, 1y)
 * @query   compare - Comparison type (previous, year_ago) for trend analysis
 */
router.get('/dashboard', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await connectDB();
    const metricsService = new AIMetricsService(db);
    
    const days = parseDateRange(req.query.range as string);
    const startDate = getStartDate(days);
    const endDate = new Date();
    
    // Check if trend comparison is requested
    const compare = req.query.compare as string;
    let dashboardData;

    if (compare === 'previous' || compare === 'year_ago') {
      const comparisonType = compare === 'previous' 
        ? ComparisonType.PREVIOUS 
        : ComparisonType.YEAR_AGO;
      
      dashboardData = await metricsService.getDashboardWithTrends(
        startDate,
        endDate,
        comparisonType
      );
    } else {
      dashboardData = await metricsService.getDashboardData(startDate, endDate);
    }
    
    await AuditLogger.log({
      eventType: AuditEventType.REPORT_GENERATED,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      resource: 'ai-metrics',
      resourceId: 'dashboard',
      action: 'viewed',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        reportType: 'ai_metrics_dashboard',
        dateRange: `${days}d`,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        withTrends: !!compare
      }
    });
    
    res.status(200).json({
      success: true,
      data: {
        ...dashboardData,
        dateRange: {
          days,
          startDate,
          endDate
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching AI metrics dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AI metrics dashboard',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ai-metrics/service/:service
 * @desc    Get metrics for a specific AI service
 * @access  Private (Admin)
 */
router.get('/service/:service', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { service } = req.params;
    
    // Validate service type
    if (!Object.values(AIServiceType).includes(service as AIServiceType)) {
      res.status(400).json({
        success: false,
        message: `Invalid service type. Valid types: ${Object.values(AIServiceType).join(', ')}`
      });
      return;
    }
    
    const db = await connectDB();
    const metricsService = new AIMetricsService(db);
    
    const days = parseDateRange(req.query.range as string);
    const startDate = getStartDate(days);
    const endDate = new Date();
    
    const serviceMetrics = await metricsService.getServicePerformance(
      service as AIServiceType,
      startDate,
      endDate
    );
    
    res.status(200).json({
      success: true,
      data: {
        service,
        metrics: serviceMetrics,
        dateRange: {
          days,
          startDate,
          endDate
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching service metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service metrics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ai-metrics/costs
 * @desc    Get AI cost analysis
 * @access  Private (Admin)
 */
router.get('/costs', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await connectDB();
    const metricsService = new AIMetricsService(db);
    
    const days = parseDateRange(req.query.range as string);
    const startDate = getStartDate(days);
    const endDate = new Date();
    
    const costAnalysis = await metricsService.getCostAnalysis(startDate, endDate);
    
    await AuditLogger.log({
      eventType: AuditEventType.REPORT_GENERATED,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      resource: 'ai-metrics',
      resourceId: 'costs',
      action: 'viewed',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        reportType: 'ai_cost_analysis',
        dateRange: `${days}d`,
        totalCost: costAnalysis.totalCost
      }
    });
    
    res.status(200).json({
      success: true,
      data: {
        ...costAnalysis,
        dateRange: {
          days,
          startDate,
          endDate
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching cost analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cost analysis',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/ai-metrics/feedback
 * @desc    Submit feedback rating for an AI operation
 * @access  Private
 */
router.post('/feedback', AuthMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { metricsEntryId, rating, comments, isAccurate, serviceType } = req.body;
    
    // Validate required fields
    if (!metricsEntryId || !rating || serviceType === undefined) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: metricsEntryId, rating, and serviceType are required'
      });
      return;
    }
    
    // Validate rating range (1-5)
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      res.status(400).json({
        success: false,
        message: 'Rating must be a number between 1 and 5'
      });
      return;
    }
    
    // Validate service type
    if (!Object.values(AIServiceType).includes(serviceType)) {
      res.status(400).json({
        success: false,
        message: `Invalid service type. Valid types: ${Object.values(AIServiceType).join(', ')}`
      });
      return;
    }
    
    const db = await connectDB();
    const metricsService = new AIMetricsService(db);
    
    const feedback = await metricsService.submitFeedback({
      metricsEntryId,
      serviceType,
      rating,
      comments,
      isAccurate,
      submittedBy: req.user?.userId || 'anonymous',
      submittedAt: new Date()
    });
    
    await AuditLogger.log({
      eventType: AuditEventType.AI_ANALYSIS_COMPLETED,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      resource: 'ai-metrics',
      resourceId: metricsEntryId,
      action: 'feedback_submitted',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        serviceType,
        rating,
        isAccurate
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: feedback
    });
  } catch (error: any) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ai-metrics/feedback
 * @desc    Get feedback statistics for AI services
 * @access  Private (Admin)
 */
router.get('/feedback', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await connectDB();
    const metricsService = new AIMetricsService(db);
    
    const days = parseDateRange(req.query.range as string);
    const startDate = getStartDate(days);
    const endDate = new Date();
    
    const feedbackStats = await metricsService.getFeedbackStats(startDate, endDate);
    
    res.status(200).json({
      success: true,
      data: {
        ...feedbackStats,
        dateRange: {
          days,
          startDate,
          endDate
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching feedback stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback statistics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ai-metrics/alerts
 * @desc    Get active AI alerts
 * @access  Private (Admin)
 */
router.get('/alerts', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = await connectDB();
    const alertService = new AIAlertService(db);
    
    const alerts = await alertService.getActiveAlerts();
    
    res.status(200).json({
      success: true,
      data: alerts
    });
  } catch (error: any) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alerts',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/ai-metrics/alerts/:alertId/acknowledge
 * @desc    Acknowledge an AI alert
 * @access  Private (Admin)
 */
router.put('/alerts/:alertId/acknowledge', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { alertId } = req.params;
    
    const db = await connectDB();
    const alertService = new AIAlertService(db);
    
    await alertService.acknowledgeAlert(
      alertId,
      req.user?.userId || 'unknown'
    );
    
    await AuditLogger.log({
      eventType: AuditEventType.AI_ANALYSIS_COMPLETED,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      resource: 'ai-metrics',
      resourceId: alertId,
      action: 'alert_acknowledged',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        alertId
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Alert acknowledged successfully'
    });
  } catch (error: any) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ai-metrics/alerts/config
 * @desc    Get alert configuration/thresholds
 * @access  Private (Admin)
 */
router.get('/alerts/config', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await connectDB();
    const alertService = new AIAlertService(db);
    
    const config = await alertService.getAlertConfig();
    
    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error: any) {
    console.error('Error fetching alert config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alert configuration',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/ai-metrics/alerts/config
 * @desc    Update alert configuration/thresholds
 * @access  Private (Admin)
 */
router.put('/alerts/config', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { thresholds, enabled } = req.body;
    
    const db = await connectDB();
    const alertService = new AIAlertService(db);
    
    const updatedConfig = await alertService.updateAlertConfig({
      thresholds,
      enabled,
      updatedBy: req.user?.userId || 'unknown',
      updatedAt: new Date()
    });
    
    await AuditLogger.log({
      eventType: AuditEventType.NOTIFICATION_PREFERENCES_UPDATED,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      resource: 'ai-metrics',
      resourceId: 'alert-config',
      action: 'updated',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        thresholdsUpdated: thresholds ? Object.keys(thresholds) : [],
        enabled
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Alert configuration updated successfully',
      data: updatedConfig
    });
  } catch (error: any) {
    console.error('Error updating alert config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update alert configuration',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ai-metrics/tokens
 * @desc    Get token usage statistics
 * @access  Private (Admin)
 */
router.get('/tokens', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await connectDB();
    const metricsService = new AIMetricsService(db);
    
    const days = parseDateRange(req.query.range as string);
    const startDate = getStartDate(days);
    const endDate = new Date();
    
    const tokenStats = await metricsService.getTokenUsageStats(startDate, endDate);
    
    res.status(200).json({
      success: true,
      data: {
        ...tokenStats,
        dateRange: {
          days,
          startDate,
          endDate
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching token stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch token usage statistics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ai-metrics/latency
 * @desc    Get latency percentiles and trends
 * @access  Private (Admin)
 */
router.get('/latency', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await connectDB();
    const metricsService = new AIMetricsService(db);
    
    const days = parseDateRange(req.query.range as string);
    const startDate = getStartDate(days);
    const endDate = new Date();
    
    const latencyStats = await metricsService.getLatencyStats(startDate, endDate);
    
    res.status(200).json({
      success: true,
      data: {
        ...latencyStats,
        dateRange: {
          days,
          startDate,
          endDate
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching latency stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latency statistics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ai-metrics/trends/seasonality
 * @desc    Get seasonality patterns (day-of-week analysis)
 * @access  Private (Admin)
 * @query   range - Date range (30d, 90d, 1y)
 * @query   service - Optional AI service filter
 */
router.get('/trends/seasonality', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await connectDB();
    const metricsService = new AIMetricsService(db);
    
    const days = parseDateRange(req.query.range as string);
    const startDate = getStartDate(days);
    const endDate = new Date();
    
    const serviceParam = req.query.service as string | undefined;
    
    // Validate and normalize service parameter (empty string means "all")
    let service: AIServiceType | undefined;
    if (serviceParam && serviceParam !== "") {
      if (!Object.values(AIServiceType).includes(serviceParam as AIServiceType)) {
        res.status(400).json({
          success: false,
          message: `Invalid service type. Valid types: ${Object.values(AIServiceType).join(', ')}`
        });
        return;
      }
      service = serviceParam as AIServiceType;
    }
    
    const seasonalityData = await metricsService.getSeasonalityAnalysis(
      startDate,
      endDate,
      service
    );
    
    await AuditLogger.log({
      eventType: AuditEventType.REPORT_GENERATED,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      resource: 'ai-metrics',
      resourceId: 'seasonality',
      action: 'viewed',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        reportType: 'seasonality_analysis',
        dateRange: `${days}d`,
        service: service || 'all'
      }
    });
    
    res.status(200).json({
      success: true,
      data: {
        ...seasonalityData,
        dateRange: {
          days,
          startDate,
          endDate
        },
        service: service || 'all'
      }
    });
  } catch (error: any) {
    console.error('Error fetching seasonality analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch seasonality analysis',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ai-metrics/trends/quality
 * @desc    Get quality trends based on edit behavior
 * @access  Private (Admin)
 * @query   range - Date range (30d, 90d, 1y)
 * @query   service - Optional AI service filter
 */
router.get('/trends/quality', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await connectDB();
    const metricsService = new AIMetricsService(db);
    
    const days = parseDateRange(req.query.range as string);
    const startDate = getStartDate(days);
    const endDate = new Date();
    
    const serviceParam = req.query.service as string | undefined;
    
    // Validate and normalize service parameter (empty string means "all")
    let service: AIServiceType | undefined;
    if (serviceParam && serviceParam !== "") {
      if (!Object.values(AIServiceType).includes(serviceParam as AIServiceType)) {
        res.status(400).json({
          success: false,
          message: `Invalid service type. Valid types: ${Object.values(AIServiceType).join(', ')}`
        });
        return;
      }
      service = serviceParam as AIServiceType;
    }
    
    const qualityData = await metricsService.getQualityTrends(
      startDate,
      endDate,
      service
    );
    
    await AuditLogger.log({
      eventType: AuditEventType.REPORT_GENERATED,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      resource: 'ai-metrics',
      resourceId: 'quality',
      action: 'viewed',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        reportType: 'quality_trends',
        dateRange: `${days}d`,
        service: service || 'all',
        overallScore: qualityData.overall.score || 0
      }
    });
    
    res.status(200).json({
      success: true,
      data: {
        ...qualityData,
        dateRange: {
          days,
          startDate,
          endDate
        },
        service: service || 'all'
      }
    });
  } catch (error: any) {
    console.error('Error fetching quality trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quality trends',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ai-metrics/calls
 * @desc    Get paginated AI call history with filters
 * @access  Private (Admin)
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 50, max: 200)
 * @query   service - Filter by service type
 * @query   success - Filter by success status (true/false)
 * @query   candidateId - Filter by candidate ID
 * @query   userId - Filter by user ID
 * @query   startDate - Start date (ISO string)
 * @query   endDate - End date (ISO string)
 */
router.get('/calls', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await connectDB();
    const metricsService = new AIMetricsService(db);
    
    // Parse pagination
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;
    
    // Parse filters
    const filters: any = {};
    
    if (req.query.service) {
      filters.service = req.query.service as AIServiceType;
    }
    
    if (req.query.success !== undefined) {
      filters.success = req.query.success === 'true';
    }
    
    if (req.query.candidateId) {
      filters.candidateId = req.query.candidateId as string;
    }
    
    if (req.query.userId) {
      filters.userId = req.query.userId as string;
    }
    
    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string);
    }
    
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string);
    }
    
    filters.limit = limit;
    filters.offset = offset;
    
    const result = await metricsService.getMetrics(filters);
    
    await AuditLogger.log({
      eventType: AuditEventType.REPORT_GENERATED,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      resource: 'ai-metrics',
      resourceId: 'calls',
      action: 'viewed',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        reportType: 'call_history',
        page,
        limit,
        filters
      }
    });
    
    res.status(200).json({
      success: true,
      data: {
        entries: result.entries,
        pagination: {
          page,
          pageSize: limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching call history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch call history',
      error: error.message
    });
  }
});

export default router;
