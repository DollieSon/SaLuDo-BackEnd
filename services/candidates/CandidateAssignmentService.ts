import { PersonalInfoRepository } from "../../repositories/CandidateRepository";
import { UserRepository } from "../../repositories/UserRepository";
import { Candidate } from "../../Models/Candidate";
import { AuditLogger } from "../../utils/AuditLogger";
import { AuditEventType } from "../../types/AuditEventTypes";
import { NotificationService } from "../NotificationService";
import { NotificationType } from "../../Models/enums/NotificationTypes";
import {
  ERROR_MESSAGES,
  LOG_MESSAGES,
  ACTIONS,
  DEFAULT_VALUES,
  METADATA_FIELDS,
  NOTIFICATION_ERROR_MESSAGES,
} from "../../constants/CandidateServiceConstants";

export class CandidateAssignmentService {
  constructor(
    private personalInfoRepo: PersonalInfoRepository,
    private userRepo: UserRepository,
    private notificationService: NotificationService | null = null,
    private getCandidateCallback: (candidateId: string) => Promise<Candidate | null>
  ) {}

  async assignHRUserToCandidate(
    candidateId: string,
    hrUserId: string,
    assignedBy: string
  ): Promise<void> {
    try {
      const personalInfo = await this.personalInfoRepo.findById(candidateId);
      if (!personalInfo) {
        throw new Error("Candidate not found");
      }

      // Initialize assignedHRUserIds if it doesn't exist
      if (!personalInfo.assignedHRUserIds) {
        personalInfo.assignedHRUserIds = [];
      }

      // Check if HR user is already assigned
      if (personalInfo.assignedHRUserIds.includes(hrUserId)) {
        throw new Error(ERROR_MESSAGES.HR_USER_ALREADY_ASSIGNED);
      }

      // Get HR user details for audit
      const hrUser = await this.userRepo.findById(hrUserId);
      const assignedByUser = await this.userRepo.findById(assignedBy);

      // Add HR user to assignment list
      personalInfo.assignedHRUserIds.push(hrUserId);
      personalInfo.lastAssignedAt = new Date();
      personalInfo.lastAssignedBy = assignedBy;
      personalInfo.dateUpdated = new Date();

      await this.personalInfoRepo.update(candidateId, personalInfo);

      // Log candidate assignment
      await AuditLogger.logCandidateOperation({
        eventType: AuditEventType.CANDIDATE_ASSIGNED,
        candidateId: candidateId,
        candidateName: personalInfo.name,
        userId: assignedBy,
        userEmail: assignedByUser?.email || DEFAULT_VALUES.UNKNOWN_EMAIL,
        action: ACTIONS.ASSIGNED,
        metadata: {
          assignedToUserId: hrUserId,
          assignedToUserName: hrUser
            ? `${hrUser.firstName} ${hrUser.lastName}`
            : DEFAULT_VALUES.UNKNOWN_USER,
          assignedToUserEmail: hrUser?.email || DEFAULT_VALUES.UNKNOWN_EMAIL,
          totalAssignments: personalInfo.assignedHRUserIds.length,
        },
      });

      // Notify the assigned HR user
      if (this.notificationService && hrUser) {
        try {
          await this.notificationService.notifyCandidateEvent(
            NotificationType.CANDIDATE_ASSIGNED,
            hrUserId,
            candidateId,
            personalInfo.name,
            {
              assignedBy: assignedByUser
                ? `${assignedByUser.firstName} ${assignedByUser.lastName}`
                : DEFAULT_VALUES.UNKNOWN,
              roleApplied: personalInfo.roleApplied || DEFAULT_VALUES.ROLE_APPLIED,
              status: personalInfo.status,
            }
          );
        } catch (notifError) {
          console.error(
            NOTIFICATION_ERROR_MESSAGES.CANDIDATE_ASSIGNED,
            notifError
          );
        }
      }
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_ASSIGNING_HR_USER, error);
      throw error;
    }
  }

  async unassignHRUserFromCandidate(
    candidateId: string,
    hrUserId: string
  ): Promise<void> {
    try {
      const personalInfo = await this.personalInfoRepo.findById(candidateId);
      if (!personalInfo) {
        throw new Error(ERROR_MESSAGES.CANDIDATE_NOT_FOUND);
      }

      // Initialize assignedHRUserIds if it doesn't exist
      if (!personalInfo.assignedHRUserIds) {
        personalInfo.assignedHRUserIds = [];
      }

      // Remove HR user from assignment list
      const index = personalInfo.assignedHRUserIds.indexOf(hrUserId);
      if (index === -1) {
        throw new Error(ERROR_MESSAGES.HR_USER_NOT_ASSIGNED);
      }

      // Get HR user details for audit before removal
      const hrUser = await this.userRepo.findById(hrUserId);

      personalInfo.assignedHRUserIds.splice(index, 1);
      personalInfo.dateUpdated = new Date();

      await this.personalInfoRepo.update(candidateId, personalInfo);

      // Log candidate unassignment
      await AuditLogger.logCandidateOperation({
        eventType: AuditEventType.CANDIDATE_UNASSIGNED,
        candidateId: candidateId,
        candidateName: personalInfo.name,
        userId: hrUserId,
        userEmail: hrUser?.email || DEFAULT_VALUES.UNKNOWN_EMAIL,
        action: ACTIONS.UNASSIGNED,
        metadata: {
          unassignedUserId: hrUserId,
          unassignedUserName: hrUser
            ? `${hrUser.firstName} ${hrUser.lastName}`
            : DEFAULT_VALUES.UNKNOWN_USER,
          unassignedUserEmail: hrUser?.email || DEFAULT_VALUES.UNKNOWN_EMAIL,
          remainingAssignments: personalInfo.assignedHRUserIds.length,
        },
      });
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_UNASSIGNING_HR_USER, error);
      throw error;
    }
  }

  async getCandidateAssignments(candidateId: string): Promise<string[]> {
    try {
      const personalInfo = await this.personalInfoRepo.findById(candidateId);
      if (!personalInfo) {
        throw new Error(ERROR_MESSAGES.CANDIDATE_NOT_FOUND);
      }
      return personalInfo.assignedHRUserIds || [];
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_ASSIGNMENTS, error);
      throw error;
    }
  }

  async getCandidatesAssignedToHRUser(hrUserId: string): Promise<Candidate[]> {
    try {
      const personalInfos = await this.personalInfoRepo.findAll();
      const assignedCandidates: Candidate[] = [];

      for (const personalInfo of personalInfos) {
        if (
          personalInfo.assignedHRUserIds &&
          personalInfo.assignedHRUserIds.includes(hrUserId)
        ) {
          const candidate = await this.getCandidateCallback(
            personalInfo.candidateId
          );
          if (candidate) {
            assignedCandidates.push(candidate);
          }
        }
      }

      return assignedCandidates;
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_ASSIGNED_CANDIDATES, error);
      throw error;
    }
  }

  async getUnassignedCandidates(): Promise<Candidate[]> {
    try {
      const personalInfos = await this.personalInfoRepo.findAll();
      const unassignedCandidates: Candidate[] = [];

      for (const personalInfo of personalInfos) {
        if (personalInfo.assignedHRUserIds.length === 0) {
          const candidate = await this.getCandidateCallback(
            personalInfo.candidateId
          );
          if (candidate) {
            unassignedCandidates.push(candidate);
          }
        }
      }

      return unassignedCandidates;
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_UNASSIGNED_CANDIDATES, error);
      throw error;
    }
  }

  async isHRUserAssignedToCandidate(
    candidateId: string,
    hrUserId: string
  ): Promise<boolean> {
    try {
      const personalInfo = await this.personalInfoRepo.findById(candidateId);
      if (!personalInfo) {
        return false;
      }
      return (
        personalInfo.assignedHRUserIds &&
        personalInfo.assignedHRUserIds.includes(hrUserId)
      );
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_CHECKING_ASSIGNMENT, error);
      return false;
    }
  }
}
