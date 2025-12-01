import pdfParse from 'pdf-parse';
import { Buffer } from 'buffer';
import { ParsedResumeData, GeminiResponse } from './types/GeminiTypes';
import { AuditLogger } from '../utils/AuditLogger';
import { AuditEventType } from '../types/AuditEventTypes';
import { GeminiClientService } from './GeminiClientService';
import { AIServiceType } from '../Models/AIMetrics';

// Helper to clean Gemini's ```json\n...\n``` wrapping
function cleanGeminiJson(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')  // Remove starting ```json
    .replace(/```$/, '')          // Remove ending ```
    .trim();
}

export async function parseResumeWithGemini(
  buffer: Buffer, 
  candidateId?: string, 
  candidateName?: string,
  userId?: string,
  userEmail?: string
): Promise<ParsedResumeData> {
  // 1. Convert resume file to plain text
  const textContent = await pdfParse(buffer).then(data => data.text);

  // 2. Build prompt
  const prompt = `You are a ai resume parser. Extract from this resume text the following structured fields as JSON:
{
  skills: [{ skillName, score (0.0-10.0 (use floating point number for more accuracy) should show how confident you are in your evaluation), evidence (evidence should tell us why you chose this skill), addedBy: "AI" }(Give atleast 10 skills, the more the better.)],
  education: [{ institution, startDate, endDate, description(give me the reason why you chose this education) }],
  experience: [{ title, role, description(give me the reason why you chose this experience) }],
  certifications: [{ name, issuingOrganization, issueDate, description(give me the reason why you chose this certification) }],
  strengths: [{ name, description(give me the reason why you gave them this strength), type: "Strength" }],
  weaknesses: [{ name, description(give me the reason why you gave them this strength), type: "Weakness" }]
  generalAssessment: string // a 3-5 sentence professional summary based on the resume
}

Resume:
${textContent}`;

  // 3. Call Gemini API using centralized client with metrics tracking
  const geminiClient = GeminiClientService.getInstance();
  const result = await geminiClient.callGemini(prompt, {
    service: AIServiceType.RESUME_PARSING,
    candidateId,
    userId
  });

  const contentText = result.rawText;

  if (!contentText) {
    throw new Error('No content returned by Gemini.');
  }

  try {
    const cleanedText = cleanGeminiJson(contentText);
    const parsed = JSON.parse(cleanedText);
    
    // Log successful resume parsing
    if (candidateId) {
      await AuditLogger.logAIOperation({
        eventType: AuditEventType.CANDIDATE_RESUME_PARSED,
        candidateId,
        userId,
        userEmail,
        action: `AI successfully parsed resume for ${candidateName || candidateId}`,
        success: true,
        metadata: {
          candidateName,
          skillCount: parsed.skills?.length || 0,
          educationCount: parsed.education?.length || 0,
          experienceCount: parsed.experience?.length || 0,
          certificationCount: parsed.certifications?.length || 0,
          metricsId: result.metricsId
        }
      });
    }
    
    return parsed;
  } catch (err) {
    // Log failed resume parsing
    if (candidateId) {
      await AuditLogger.logAIOperation({
        eventType: AuditEventType.AI_ANALYSIS_FAILED,
        candidateId,
        userId,
        userEmail,
        action: `AI failed to parse resume for ${candidateName || candidateId}`,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        metadata: { candidateName, operation: 'resume_parsing' }
      });
    }
    throw new Error('Invalid JSON returned by Gemini: ' + contentText);
  }
}
