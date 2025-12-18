import { CandidateStatus } from "../Candidate";

/**
 * Represents a single entry in a candidate's status change history
 * Provides complete audit trail of all status transitions
 */
export interface StatusHistoryEntry {
  /** Unique identifier for this status change entry */
  historyId: string;
  
  /** The new status that was set */
  status: CandidateStatus;
  
  /** The previous status before this change (null for initial status) */
  previousStatus: CandidateStatus | null;
  
  /** Timestamp when the status was changed */
  changedAt: Date;
  
  /** User ID who made the status change */
  changedBy: string;
  
  /** Name of user who made the change (cached for display) */
  changedByName?: string;
  
  /** Email of user who made the change (cached for display) */
  changedByEmail?: string;
  
  /** Reason or explanation for the status change */
  reason?: string;
  
  /** Additional notes or context about the change */
  notes?: string;
  
  /** Whether this was an automated change (vs manual) */
  isAutomated?: boolean;
  
  /** Source system or trigger that initiated the change */
  source?: 'manual' | 'automation' | 'bulk_action' | 'api' | 'migration';
}

/**
 * Time spent in a particular status
 */
export interface TimeInStage {
  status: CandidateStatus;
  durationMs: number;
  durationDays: number;
  startDate: Date;
  endDate: Date | null; // null if currently in this stage
}

/**
 * Analytics data for candidate's time in various stages
 */
export interface CandidateTimeAnalytics {
  candidateId: string;
  candidateName: string;
  currentStatus: CandidateStatus;
  
  /** Time spent in current stage */
  timeInCurrentStage: {
    durationMs: number;
    durationDays: number;
    durationHours: number;
    startDate: Date;
  };
  
  /** Breakdown of time spent in each stage */
  stageBreakdown: TimeInStage[];
  
  /** Total time in hiring process */
  totalTimeInProcess: {
    durationMs: number;
    durationDays: number;
    startDate: Date;
  };
  
  /** Number of status changes */
  totalStatusChanges: number;
  
  /** Whether candidate is stuck (exceeds threshold) */
  isStuck: boolean;
  stuckThresholdDays: number;
}

/**
 * Aggregate analytics across multiple candidates
 */
export interface SystemWideTimeAnalytics {
  /** Average time spent in each stage */
  averageTimePerStage: Record<CandidateStatus, number>;
  
  /** Median time spent in each stage */
  medianTimePerStage: Record<CandidateStatus, number>;
  
  /** Stages that are bottlenecks (exceed threshold) */
  bottleneckStages: Array<{
    status: CandidateStatus;
    averageDays: number;
    medianDays: number;
    candidatesAffected: number;
  }>;
  
  /** Candidates stuck beyond threshold */
  stuckCandidates: Array<{
    candidateId: string;
    candidateName: string;
    status: CandidateStatus;
    daysInStage: number;
  }>;
  
  /** Conversion funnel metrics */
  conversionFunnel: Array<{
    status: CandidateStatus;
    candidateCount: number;
    conversionRate: number; // % that moved to next stage
    dropOffRate: number; // % that didn't proceed
    averageDaysInStage: number;
  }>;
  
  /** Overall metrics */
  totalCandidates: number;
  averageTimeToHire: number; // Days from Applied to Hired
  totalStatusChanges: number;
}

/**
 * Request payload for creating a status change
 */
export interface CreateStatusChangeRequest {
  status: CandidateStatus;
  reason?: string;
  notes?: string;
}
