import { connectDB } from "../mongo_db";
import { PersonalInfoRepository } from "../repositories/CandidateRepository";
import { Candidate, CandidateStatus } from "../Models/Candidate";
import {
  CandidateTimeAnalytics,
  SystemWideTimeAnalytics,
  StatusHistoryEntry,
} from "../Models/interfaces/StatusHistory";
import { CandidateService } from "./CandidateService";

/**
 * Service for calculating time-in-stage analytics and metrics
 */
export class TimeAnalyticsService {
  private personalInfoRepo: PersonalInfoRepository;
  private candidateService: CandidateService;
  private readonly DEFAULT_STUCK_THRESHOLD_DAYS = 14;

  constructor() {
    this.personalInfoRepo = null as any;
    this.candidateService = new CandidateService();
  }

  async init(): Promise<void> {
    const db = await connectDB();
    this.personalInfoRepo = new PersonalInfoRepository(db);
    await this.candidateService.init();
  }

  /**
   * Get time analytics for a single candidate
   */
  async getCandidateTimeAnalytics(
    candidateId: string,
    stuckThresholdDays: number = this.DEFAULT_STUCK_THRESHOLD_DAYS
  ): Promise<CandidateTimeAnalytics | null> {
    await this.init();

    const candidate = await this.candidateService.getCandidate(candidateId);
    if (!candidate) return null;

    const timeInCurrentStageMs = candidate.getTimeInCurrentStage();
    const totalTimeMs = candidate.getTotalTimeInProcess();
    const stageBreakdown = candidate.getStageBreakdown();
    const timeInCurrentStageDays = timeInCurrentStageMs / (1000 * 60 * 60 * 24);

    return {
      candidateId: candidate.candidateId,
      candidateName: candidate.name,
      currentStatus: candidate.status,
      timeInCurrentStage: {
        durationMs: timeInCurrentStageMs,
        durationDays: Math.floor(timeInCurrentStageDays),
        durationHours: Math.floor(timeInCurrentStageMs / (1000 * 60 * 60)),
        startDate:
          candidate.statusHistory.length > 0
            ? candidate.statusHistory[candidate.statusHistory.length - 1]
                .changedAt
            : candidate.dateCreated,
      },
      stageBreakdown,
      totalTimeInProcess: {
        durationMs: totalTimeMs,
        durationDays: Math.floor(totalTimeMs / (1000 * 60 * 60 * 24)),
        startDate:
          candidate.statusHistory.length > 0
            ? candidate.statusHistory[0].changedAt
            : candidate.dateCreated,
      },
      totalStatusChanges: candidate.getStatusChangeCount(),
      isStuck: candidate.isStuckInCurrentStage(stuckThresholdDays),
      stuckThresholdDays,
    };
  }

  /**
   * Get system-wide time analytics
   */
  async getSystemWideTimeAnalytics(
    stuckThresholdDays: number = this.DEFAULT_STUCK_THRESHOLD_DAYS
  ): Promise<SystemWideTimeAnalytics> {
    await this.init();

    // Get all non-deleted candidates
    const allPersonalInfo = await this.personalInfoRepo.findAll();
    const candidates = await Promise.all(
      allPersonalInfo
        .filter((info) => !info.isDeleted)
        .map((info) => this.candidateService.getCandidate(info.candidateId))
    );

    const validCandidates = candidates.filter((c) => c !== null) as Candidate[];

    // Calculate average time per stage
    const stageTimeMap = new Map<CandidateStatus, number[]>();
    validCandidates.forEach((candidate) => {
      const breakdown = candidate.getStageBreakdown();
      breakdown.forEach((stage) => {
        if (!stageTimeMap.has(stage.status)) {
          stageTimeMap.set(stage.status, []);
        }
        stageTimeMap.get(stage.status)!.push(stage.durationDays);
      });
    });

    const averageTimePerStage: Record<string, number> = {};
    const medianTimePerStage: Record<string, number> = {};

    stageTimeMap.forEach((durations, status) => {
      const avg =
        durations.reduce((sum, d) => sum + d, 0) / durations.length;
      averageTimePerStage[status] = Math.round(avg * 10) / 10;

      // Calculate median
      const sorted = [...durations].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianTimePerStage[status] =
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
    });

    // Identify bottleneck stages
    const bottleneckStages = Object.entries(averageTimePerStage)
      .filter(([_, avgDays]) => avgDays > stuckThresholdDays / 2)
      .map(([status, avgDays]) => ({
        status: status as CandidateStatus,
        averageDays: avgDays,
        medianDays: medianTimePerStage[status] || 0,
        candidatesAffected: stageTimeMap.get(status as CandidateStatus)
          ?.length || 0,
      }))
      .sort((a, b) => b.averageDays - a.averageDays);

    // Find stuck candidates
    const stuckCandidates = validCandidates
      .filter((c) => c.isStuckInCurrentStage(stuckThresholdDays))
      .map((c) => ({
        candidateId: c.candidateId,
        candidateName: c.name,
        status: c.status,
        daysInStage: Math.floor(
          c.getTimeInCurrentStage() / (1000 * 60 * 60 * 24)
        ),
      }))
      .sort((a, b) => b.daysInStage - a.daysInStage);

    // Calculate conversion funnel
    const statusCounts = new Map<CandidateStatus, number>();
    validCandidates.forEach((c) => {
      statusCounts.set(c.status, (statusCounts.get(c.status) || 0) + 1);
    });

    const conversionFunnel = Object.values(CandidateStatus).map((status) => {
      const count = statusCounts.get(status) || 0;
      const avgDays = averageTimePerStage[status] || 0;
      
      // Simple conversion calculation (can be enhanced)
      const totalCandidates = validCandidates.length;
      const conversionRate = totalCandidates > 0 ? (count / totalCandidates) * 100 : 0;
      const dropOffRate = 100 - conversionRate;

      return {
        status,
        candidateCount: count,
        conversionRate: Math.round(conversionRate * 10) / 10,
        dropOffRate: Math.round(dropOffRate * 10) / 10,
        averageDaysInStage: avgDays,
      };
    });

    // Calculate average time to hire
    const hiredCandidates = validCandidates.filter(
      (c) => c.status === CandidateStatus.HIRED
    );
    const avgTimeToHire =
      hiredCandidates.length > 0
        ? hiredCandidates.reduce(
            (sum, c) =>
              sum + c.getTotalTimeInProcess() / (1000 * 60 * 60 * 24),
            0
          ) / hiredCandidates.length
        : 0;

    const totalStatusChanges = validCandidates.reduce(
      (sum, c) => sum + c.getStatusChangeCount(),
      0
    );

    return {
      averageTimePerStage: averageTimePerStage as Record<CandidateStatus, number>,
      medianTimePerStage: medianTimePerStage as Record<CandidateStatus, number>,
      bottleneckStages,
      stuckCandidates,
      conversionFunnel,
      totalCandidates: validCandidates.length,
      averageTimeToHire: Math.round(avgTimeToHire * 10) / 10,
      totalStatusChanges,
    };
  }

  /**
   * Get candidates stuck in a specific stage
   */
  async getCandidatesStuckInStage(
    status: CandidateStatus,
    thresholdDays: number = this.DEFAULT_STUCK_THRESHOLD_DAYS
  ): Promise<
    Array<{
      candidateId: string;
      candidateName: string;
      daysInStage: number;
      status: CandidateStatus;
    }>
  > {
    await this.init();

    const allPersonalInfo = await this.personalInfoRepo.findAll();
    const candidates = await Promise.all(
      allPersonalInfo
        .filter((info) => !info.isDeleted && info.status === status)
        .map((info) => this.candidateService.getCandidate(info.candidateId))
    );

    const validCandidates = candidates.filter((c) => c !== null) as Candidate[];

    return validCandidates
      .filter((c) => c.isStuckInCurrentStage(thresholdDays))
      .map((c) => ({
        candidateId: c.candidateId,
        candidateName: c.name,
        daysInStage: Math.floor(
          c.getTimeInCurrentStage() / (1000 * 60 * 60 * 24)
        ),
        status: c.status,
      }))
      .sort((a, b) => b.daysInStage - a.daysInStage);
  }

  /**
   * Get average time between two specific statuses
   */
  async getAverageTimeBetweenStatuses(
    fromStatus: CandidateStatus,
    toStatus: CandidateStatus
  ): Promise<number> {
    await this.init();

    const allPersonalInfo = await this.personalInfoRepo.findAll();
    const candidates = await Promise.all(
      allPersonalInfo
        .filter((info) => !info.isDeleted)
        .map((info) => this.candidateService.getCandidate(info.candidateId))
    );

    const validCandidates = candidates.filter((c) => c !== null) as Candidate[];
    const durations: number[] = [];

    validCandidates.forEach((candidate) => {
      const history = candidate.statusHistory;
      let fromTime: Date | null = null;

      for (const entry of history) {
        if (entry.status === fromStatus) {
          fromTime = entry.changedAt;
        }
        if (entry.status === toStatus && fromTime) {
          const duration =
            new Date(entry.changedAt).getTime() - new Date(fromTime).getTime();
          durations.push(duration / (1000 * 60 * 60 * 24)); // Convert to days
          fromTime = null;
        }
      }
    });

    if (durations.length === 0) return 0;

    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    return Math.round(avg * 10) / 10;
  }
}
