import { Buffer } from "buffer";
import { PersonalityData } from "../Models/PersonalityTypes";
import { AuditLogger } from "../utils/AuditLogger";
import { AuditEventType } from "../types/AuditEventTypes";
import { GeminiClientService } from "./GeminiClientService";
import { AIServiceType } from "../Models/AIMetrics";
import fetch from "node-fetch";
import FormData from "form-data";

/**
 * Video analysis result structure
 */
export interface VideoAnalysisResult {
  personality?: PersonalityData;
  communicationSkills: {
    clarity: number; // 0.0-10.0
    articulateness: number;
    pace: number;
    confidence: number;
    evidence: string;
  };
  nonVerbalCues: {
    eyeContact: number; // 0.0-10.0
    bodyLanguage: number;
    facialExpressions: number;
    overallPresence: number;
    evidence: string;
  };
  contentQuality: {
    relevance: number; // 0.0-10.0
    depth: number;
    structure: number;
    examples: number;
    evidence: string;
  };
  overallImpression: {
    score: number; // 0.0-10.0
    strengths: string[];
    areasForImprovement: string[];
    summary: string;
  };
  transcribedText?: string; // Text extracted from video audio
}

/**
 * Helper to clean Gemini's JSON response
 */
function cleanGeminiJson(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```$/, "")
    .trim();
}

/**
 * Analyze an introduction video using Gemini's video file API
 * @param videoBuffer - The video file buffer
 * @param mimeType - The MIME type of the video file
 * @param candidateId - Optional candidate ID for tracking
 * @param candidateName - Optional candidate name for tracking
 * @param userId - Optional user ID for audit logging
 * @param userEmail - Optional user email for audit logging
 * @returns Video analysis result with personality, communication, and non-verbal cues
 */
export async function analyzeIntroductionVideoWithGemini(
  videoBuffer: Buffer,
  mimeType: string,
  candidateId?: string,
  candidateName?: string,
  userId?: string,
  userEmail?: string
): Promise<VideoAnalysisResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY not configured");
  }

  try {
    // Step 1: Upload video file to Gemini File API
    console.log("=== Uploading video to Gemini File API ===");
    const formData = new FormData();
    formData.append("file", videoBuffer, {
      filename: "video.mp4",
      contentType: mimeType,
    });

    const uploadResponse = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Failed to upload video: ${errorText}`);
    }

    const uploadResult: any = await uploadResponse.json();
    const fileUri = uploadResult.file.uri;
    console.log("=== Video uploaded, URI:", fileUri, "===");

    // Step 2: Wait for file processing (Gemini needs time to process video)
    console.log("=== Waiting for video processing ===");
    await waitForFileProcessing(fileUri, apiKey);

    // Step 3: Analyze video with Gemini
    const prompt = `You are an AI that analyzes introduction videos for candidate evaluation. 

Analyze this introduction video and provide a comprehensive assessment. Return ONLY valid JSON in this exact structure:

{
  "communicationSkills": {
    "clarity": 0.0,
    "articulateness": 0.0,
    "pace": 0.0,
    "confidence": 0.0,
    "evidence": "Detailed analysis of communication skills"
  },
  "nonVerbalCues": {
    "eyeContact": 0.0,
    "bodyLanguage": 0.0,
    "facialExpressions": 0.0,
    "overallPresence": 0.0,
    "evidence": "Detailed analysis of non-verbal communication"
  },
  "contentQuality": {
    "relevance": 0.0,
    "depth": 0.0,
    "structure": 0.0,
    "examples": 0.0,
    "evidence": "Detailed analysis of content quality"
  },
  "overallImpression": {
    "score": 0.0,
    "strengths": ["strength1", "strength2", "strength3"],
    "areasForImprovement": ["area1", "area2", "area3"],
    "summary": "3-5 sentence overall impression"
  },
  "transcribedText": "Full transcription of what was said in the video IN THE ORIGINAL LANGUAGE SPOKEN (do not translate)"
}

Score each metric from 0.0 to 10.0 based on the video content. Provide specific evidence and observations for each category. 

IMPORTANT: Transcribe the audio in the exact language spoken in the video. Do NOT translate it to another language.`;

    const geminiClient = GeminiClientService.getInstance();
    const result = await geminiClient.callGemini(
      prompt,
      {
        service: AIServiceType.VIDEO_ANALYSIS,
        candidateId,
        userId,
      },
      fileUri
    ); // Pass file URI for video analysis

    const contentText = result.rawText;

    if (!contentText) {
      throw new Error("No content returned by Gemini");
    }

    // Parse the response
    const cleaned = cleanGeminiJson(contentText);
    const parsed: VideoAnalysisResult = JSON.parse(cleaned);

    // Log successful video analysis
    if (candidateId) {
      await AuditLogger.logAIOperation({
        eventType: AuditEventType.VIDEO_ANALYSIS_COMPLETED,
        candidateId,
        userId,
        userEmail,
        action: `AI successfully analyzed introduction video for ${
          candidateName || candidateId
        }`,
        success: true,
        metadata: {
          candidateName,
          videoType: "introduction",
          overallScore: parsed.overallImpression.score,
          metricsId: result.metricsId,
        },
      });
    }

    // Clean up the uploaded file
    await deleteGeminiFile(fileUri, apiKey);

    return parsed;
  } catch (err) {
    // Log failed video analysis
    if (candidateId) {
      await AuditLogger.logAIOperation({
        eventType: AuditEventType.AI_ANALYSIS_FAILED,
        candidateId,
        userId,
        userEmail,
        action: `AI failed to analyze introduction video for ${
          candidateName || candidateId
        }`,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        metadata: {
          candidateName,
          operation: "video_analysis",
          videoType: "introduction",
        },
      });
    }
    throw err;
  }
}

/**
 * Analyze an interview video using Gemini's video file API
 * Similar to introduction video but focuses on interview-specific aspects
 */
export async function analyzeInterviewVideoWithGemini(
  videoBuffer: Buffer,
  mimeType: string,
  candidateId?: string,
  candidateName?: string,
  interviewRound?: string,
  userId?: string,
  userEmail?: string
): Promise<VideoAnalysisResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY not configured");
  }

  try {
    // Step 1: Upload video file to Gemini File API
    console.log("=== Uploading interview video to Gemini File API ===");
    const formData = new FormData();
    formData.append("file", videoBuffer, {
      filename: "interview.mp4",
      contentType: mimeType,
    });

    const uploadResponse = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Failed to upload video: ${errorText}`);
    }

    const uploadResult: any = await uploadResponse.json();
    const fileUri = uploadResult.file.uri;
    console.log("=== Interview video uploaded, URI:", fileUri, "===");

    // Step 2: Wait for file processing
    console.log("=== Waiting for video processing ===");
    await waitForFileProcessing(fileUri, apiKey);

    // Step 3: Analyze video with Gemini (interview-focused prompt)
    const prompt = `You are an AI that analyzes interview videos for candidate evaluation${
      interviewRound ? ` (${interviewRound} round)` : ""
    }. 

Analyze this interview video and provide a comprehensive assessment of the candidate's performance. Return ONLY valid JSON in this exact structure:

{
  "communicationSkills": {
    "clarity": 0.0,
    "articulateness": 0.0,
    "pace": 0.0,
    "confidence": 0.0,
    "evidence": "Detailed analysis of how well the candidate communicated their thoughts"
  },
  "nonVerbalCues": {
    "eyeContact": 0.0,
    "bodyLanguage": 0.0,
    "facialExpressions": 0.0,
    "overallPresence": 0.0,
    "evidence": "Detailed analysis of non-verbal communication and professionalism"
  },
  "contentQuality": {
    "relevance": 0.0,
    "depth": 0.0,
    "structure": 0.0,
    "examples": 0.0,
    "evidence": "Detailed analysis of answer quality, technical depth, and problem-solving approach"
  },
  "overallImpression": {
    "score": 0.0,
    "strengths": ["strength1", "strength2", "strength3"],
    "areasForImprovement": ["area1", "area2", "area3"],
    "summary": "3-5 sentence overall impression of the interview performance"
  },
  "transcribedText": "Full transcription of the interview conversation IN THE ORIGINAL LANGUAGE SPOKEN (do not translate)"
}

Score each metric from 0.0 to 10.0. Provide specific examples and observations from the video. Focus on both technical competence and soft skills.

IMPORTANT: Transcribe the audio in the exact language spoken in the video. Do NOT translate it to another language.`;

    const geminiClient = GeminiClientService.getInstance();
    const result = await geminiClient.callGemini(
      prompt,
      {
        service: AIServiceType.VIDEO_ANALYSIS,
        candidateId,
        userId,
      },
      fileUri
    ); // Pass file URI for video analysis

    const contentText = result.rawText;

    if (!contentText) {
      throw new Error("No content returned by Gemini");
    }

    // Parse the response
    const cleaned = cleanGeminiJson(contentText);
    const parsed: VideoAnalysisResult = JSON.parse(cleaned);

    // Log successful video analysis
    if (candidateId) {
      await AuditLogger.logAIOperation({
        eventType: AuditEventType.VIDEO_ANALYSIS_COMPLETED,
        candidateId,
        userId,
        userEmail,
        action: `AI successfully analyzed interview video for ${
          candidateName || candidateId
        }`,
        success: true,
        metadata: {
          candidateName,
          videoType: "interview",
          interviewRound,
          overallScore: parsed.overallImpression.score,
          metricsId: result.metricsId,
        },
      });
    }

    // Clean up the uploaded file
    await deleteGeminiFile(fileUri, apiKey);

    return parsed;
  } catch (err) {
    // Log failed video analysis
    if (candidateId) {
      await AuditLogger.logAIOperation({
        eventType: AuditEventType.AI_ANALYSIS_FAILED,
        candidateId,
        userId,
        userEmail,
        action: `AI failed to analyze interview video for ${
          candidateName || candidateId
        }`,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        metadata: {
          candidateName,
          operation: "video_analysis",
          videoType: "interview",
          interviewRound,
        },
      });
    }
    throw err;
  }
}

/**
 * Wait for Gemini to finish processing the uploaded video file
 */
async function waitForFileProcessing(
  fileUri: string,
  apiKey: string,
  maxAttempts: number = 300
): Promise<void> {
  const fileName = fileUri.split("/").pop();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/files/${fileName}?key=${apiKey}`,
      { method: "GET" }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("File status check failed:", errorText);
      throw new Error(
        `Failed to check file processing status: ${response.status}`
      );
    }

    const fileData: any = await response.json();
    console.log(
      `=== Attempt ${attempt + 1}/${maxAttempts}: File state = ${
        fileData.state
      } ===`
    );

    if (fileData.state === "ACTIVE") {
      console.log("=== Video processing complete ===");
      return;
    } else if (fileData.state === "FAILED") {
      throw new Error("Video processing failed");
    }

    // Wait 3 seconds before checking again
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error("Video processing timeout after 3 minutes");
}

/**
 * Delete uploaded file from Gemini File API
 */
async function deleteGeminiFile(
  fileUri: string,
  apiKey: string
): Promise<void> {
  try {
    const fileName = fileUri.split("/").pop();
    await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`,
      { method: "DELETE" }
    );
    console.log("=== Cleaned up uploaded video file ===");
  } catch (err) {
    console.error("Failed to delete Gemini file:", err);
    // Non-fatal error, just log it
  }
}
