import { Router, Response } from "express";
import { AuthMiddleware, AuthenticatedRequest } from "./middleware/auth";
import { asyncHandler, errorHandler } from "./middleware/errorHandler";
import { UserRole } from "../Models/User";
import { connectDB } from "../mongo_db";
import { AuditLogService } from "../services/AuditLogService";
import {
  AuditLogRepository,
  AuditLogFilter,
  AuditEventType,
  AuditSeverity,
} from "../repositories/AuditLogRepository";

const router = Router();
let auditLogService: AuditLogService | null = null;

const AUDIT_EVENT_TYPES = Object.values(AuditEventType);
const AUDIT_SEVERITIES = Object.values(AuditSeverity);

async function getAuditLogService(): Promise<AuditLogService> {
  if (!auditLogService) {
    const db = await connectDB();
    const repository = new AuditLogRepository(db);
    auditLogService = new AuditLogService(repository);
  }

  return auditLogService;
}

function normalizeListParam(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : String(item)))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

const isAuditEventType = (value: string): value is AuditEventType =>
  AUDIT_EVENT_TYPES.includes(value as AuditEventType);

const isAuditSeverity = (value: string): value is AuditSeverity =>
  AUDIT_SEVERITIES.includes(value as AuditSeverity);

router.get(
  "/",
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.ADMIN),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const service = await getAuditLogService();

    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit as string, 10) || 50, 1),
      200
    );

    const filter: AuditLogFilter = {
      limit,
      skip: (page - 1) * limit,
    };

    const rawEventTypes = normalizeListParam(req.query.eventType);
    if (rawEventTypes.length) {
      const normalizedEventTypes = rawEventTypes.map((value) =>
        value.toUpperCase()
      );
      const validEventTypes = normalizedEventTypes.filter(isAuditEventType);

      if (validEventTypes.length !== normalizedEventTypes.length) {
        res.status(400).json({
          success: false,
          message: "Invalid eventType value provided.",
        });
        return;
      }

      filter.eventType =
        validEventTypes.length === 1 ? validEventTypes[0] : validEventTypes;
    }

    const rawSeverities = normalizeListParam(req.query.severity);
    if (rawSeverities.length) {
      const normalizedSeverities = rawSeverities.map((value) =>
        value.toUpperCase()
      );
      const validSeverities = normalizedSeverities.filter(isAuditSeverity);

      if (validSeverities.length !== normalizedSeverities.length) {
        res.status(400).json({
          success: false,
          message: "Invalid severity value provided.",
        });
        return;
      }

      filter.severity =
        validSeverities.length === 1 ? validSeverities[0] : validSeverities;
    }

    if (req.query.userId && typeof req.query.userId === "string") {
      filter.userId = req.query.userId;
    }

    if (req.query.ipAddress && typeof req.query.ipAddress === "string") {
      filter.ipAddress = req.query.ipAddress;
    }

    if (req.query.success !== undefined) {
      if (req.query.success === "true" || req.query.success === "false") {
        filter.success = req.query.success === "true";
      } else {
        res.status(400).json({
          success: false,
          message: "success parameter must be true or false.",
        });
        return;
      }
    }

    if (req.query.startDate) {
      if (typeof req.query.startDate !== "string") {
        res
          .status(400)
          .json({ success: false, message: "startDate must be a string." });
        return;
      }
      const startDate = new Date(req.query.startDate);
      if (Number.isNaN(startDate.getTime())) {
        res
          .status(400)
          .json({ success: false, message: "Invalid startDate value." });
        return;
      }
      filter.startDate = startDate;
    }

    if (req.query.endDate) {
      if (typeof req.query.endDate !== "string") {
        res
          .status(400)
          .json({ success: false, message: "endDate must be a string." });
        return;
      }
      const endDate = new Date(req.query.endDate);
      if (Number.isNaN(endDate.getTime())) {
        res
          .status(400)
          .json({ success: false, message: "Invalid endDate value." });
        return;
      }
      filter.endDate = endDate;
    }

    const result = await service.getAuditLogs(filter);

    res.json({
      success: true,
      data: result.logs,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.max(Math.ceil(result.total / limit), 1),
        hasMore: result.hasMore,
      },
    });
  })
);

router.get(
  "/alerts",
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.ADMIN),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const service = await getAuditLogService();
    const hoursParam = parseInt(req.query.hours as string, 10);
    const hours =
      Number.isNaN(hoursParam) || hoursParam < 1
        ? 24
        : Math.min(hoursParam, 168);

    const alerts = await service.getSecurityAlerts(hours);

    res.json({
      success: true,
      data: alerts,
      windowHours: hours,
      count: alerts.length,
    });
  })
);

router.get(
  "/stats",
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.ADMIN),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const service = await getAuditLogService();
    const daysParam = parseInt(req.query.days as string, 10);
    const days =
      Number.isNaN(daysParam) || daysParam < 1 ? 30 : Math.min(daysParam, 365);

    const stats = await service.getAuditStatistics(days);

    res.json({
      success: true,
      data: stats,
      windowDays: days,
    });
  })
);

router.use(errorHandler);

export default router;
