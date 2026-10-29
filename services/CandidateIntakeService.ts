// =======================
// CANDIDATE INTAKE SERVICE
// =======================
// Purpose: Create a candidate from a resume upload, run AI resume parsing and
//          notify assigned users. Shared by the authenticated staff route and
//          the rate-limited public application route.
// Related: routes/candidates.ts, routes/public.ts
// =======================

import { CandidateService } from "./CandidateService";
import { SkillService } from "./SkillService";
import { EducationService } from "./EducationService";
import { ExperienceService } from "./ExperienceService";
import { CertificationService } from "./CertificationService";
import { StrengthWeaknessService } from "./StrengthWeaknessService";
import { parseResumeWithGemini } from "./GeminiResumeService";
import { AddedBy } from "../Models/Skill";
import { SocialLink } from "../Models/Candidate";
import { AuditLogger } from "../utils/AuditLogger";
import { AuditEventType } from "../types/AuditEventTypes";
import { connectDB } from "../mongo_db";

const candidateService = new CandidateService();
const skillService = new SkillService();
const educationService = new EducationService();
const experienceService = new ExperienceService();
const certificationService = new CertificationService();
const strengthWeaknessService = new StrengthWeaknessService();

export interface CandidateIntakeInput {
  name: string;
  emailArray: string[];
  birthdate: string;
  jobId: string | null;
  file: Express.Multer.File;
  socialLinks: SocialLink[];
  userId?: string;
  userEmail?: string;
  // Keep the candidate and return normally when AI parsing fails
  continueOnAnalysisError?: boolean;
}

export const createCandidateWithResume = async ({
  name,
  emailArray,
  birthdate,
  jobId,
  file,
  socialLinks,
  userId,
  userEmail,
  continueOnAnalysisError = false,
}: CandidateIntakeInput) => {
  const candidate = await candidateService.addCandidate(
    name,
    emailArray,
    new Date(birthdate),
    jobId,
    file,
    userId,
    userEmail,
    socialLinks
  );

  try {
    // Use Gemini to parse resume
    const parsedData = await parseResumeWithGemini(
      file.buffer,
      candidate.candidateId,
      name,
      userId,
      userEmail
    );

    // Save parsed data
    if (parsedData.skills.length) {
      await skillService.addSkillsBulk(
        candidate.candidateId,
        parsedData.skills.map((skill) => ({
          ...skill,
          addedBy: AddedBy.AI,
        }))
      );

      // Log skill analysis completion
      await AuditLogger.logAIOperation({
        eventType: AuditEventType.SKILL_ANALYSIS_COMPLETED,
        candidateId: candidate.candidateId,
        userId: userId,
        userEmail: userEmail,
        action: `AI completed skill analysis for ${name}`,
        success: true,
        metadata: {
          candidateName: name,
          skillCount: parsedData.skills.length,
          averageScore:
            parsedData.skills.reduce((sum, s) => sum + (s.score || 0), 0) /
            parsedData.skills.length,
        },
      });
    }
    for (const edu of parsedData.education)
      await educationService.addEducation(candidate.candidateId, edu);
    for (const exp of parsedData.experience)
      await experienceService.addExperience(candidate.candidateId, exp);
    for (const cert of parsedData.certifications)
      await certificationService.addCertification(candidate.candidateId, cert);
    for (const strength of parsedData.strengths)
      await strengthWeaknessService.addStrength(
        candidate.candidateId,
        strength
      );
    for (const weakness of parsedData.weaknesses)
      await strengthWeaknessService.addWeakness(
        candidate.candidateId,
        weakness
      );

    // Notify assigned HR users that AI analysis is complete
    try {
      const { NotificationService } = await import(
        "../services/NotificationService"
      );
      const { NotificationRepository } = await import(
        "../repositories/NotificationRepository"
      );
      const { NotificationPreferencesRepository } = await import(
        "../repositories/NotificationPreferencesRepository"
      );
      const { WebhookRepository } = await import(
        "../repositories/WebhookRepository"
      );
      const { getAssignedHRUsers } = await import(
        "../utils/NotificationHelpers"
      );
      const { NotificationType } = await import(
        "../Models/enums/NotificationTypes"
      );
      const db = await connectDB();

      const notificationRepo = new NotificationRepository(
        db.collection("notifications")
      );
      const preferencesRepo = new NotificationPreferencesRepository(
        db.collection("notificationPreferences")
      );
      const webhookRepo = new WebhookRepository(db.collection("webhooks"));
      const notificationService = new NotificationService(
        notificationRepo,
        preferencesRepo,
        webhookRepo
      );

      const assignedUsers = await getAssignedHRUsers(candidate.candidateId);
      for (const hrUser of assignedUsers) {
        await notificationService.notifyCandidateEvent(
          NotificationType.CANDIDATE_AI_ANALYSIS_COMPLETE,
          hrUser.userId,
          candidate.candidateId,
          name,
          {
            skillsFound: parsedData.skills.length,
            educationFound: parsedData.education.length,
            experienceFound: parsedData.experience.length,
            certificationsFound: parsedData.certifications.length,
          }
        );
      }
    } catch (notifError) {
      console.error(
        "Failed to send CANDIDATE_AI_ANALYSIS_COMPLETE notification:",
        notifError
      );
    }
  } catch (analysisError) {
    // Public applications are kept even if AI analysis fails (so applicants
    // don't resubmit and create duplicates); staff requests still surface it
    if (!continueOnAnalysisError) throw analysisError;
    console.error(
      `AI resume analysis failed for candidate ${candidate.candidateId}:`,
      analysisError instanceof Error ? analysisError.message : analysisError
    );
  }

  return candidate;
};
