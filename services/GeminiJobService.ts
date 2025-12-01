import { Buffer } from "buffer";
import fetch from "node-fetch";
import { InferredJobSkill, GeminiResponse } from './types/GeminiTypes';
import { GeminiClientService } from './GeminiClientService';
import { AIServiceType } from '../Models/AIMetrics';

export async function parseJobWithGemini(
  jobName: string,
  jobDescription: string,
  jobId?: string,
  userId?: string
): Promise<InferredJobSkill[]> {
  const prompt = `You are an AI assistant that helps parse job descriptions and extract the required skills.

Return a JSON array of skill objects like this:
[
  {
    skillName: string,         // name of the required skill
    requiredLevel: number,     // between 0.0 and 10.0 based on how important the skill is
    evidence: string           // evidence should tell us why you chose this skill
  }
]

Do not return any explanation or preamble. Only the JSON array. Give atleast 10 skills, the more the better.

Job Title: ${jobName}

Job Description:
${jobDescription}`;

  // Call Gemini API using centralized client with metrics tracking
  const geminiClient = GeminiClientService.getInstance();
  const result = await geminiClient.callGemini(prompt, {
    service: AIServiceType.JOB_ANALYSIS,
    jobId,
    userId
  });

  const contentText = result.rawText;

  if (!contentText) {
    throw new Error("No content returned by Gemini.");
  }

  try {
    // Clean out Markdown-style code fences if present
    const cleaned = contentText
      .replace(/^```(?:json)?\s*|```[\s\n]*$/gi, "") // robustly remove opening and closing code fences
      .trim();

    console.log("Cleaned Gemini response:", cleaned);
    const parsed: InferredJobSkill[] = JSON.parse(cleaned);
    return parsed;
  } catch (err) {
    throw new Error("Invalid JSON returned by Gemini: " + contentText);
  }
}
