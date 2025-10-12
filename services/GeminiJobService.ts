import { Buffer } from "buffer";
import fetch from "node-fetch";

export interface InferredJobSkill {
  skillName: string;
  requiredLevel: number; // Between 0.0 and 10.0
  evidence: string;
}

interface GeminiCandidateResponse {
  candidates?: {
    content?: {
      parts?: { text: string }[];
    };
  }[];
}

export async function parseJobWithGemini(
  jobName: string,
  jobDescription: string
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

  const requestPayload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY environment variable is not set. AI job analysis will fail.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    }
  );

  const result = (await response.json()) as GeminiCandidateResponse;

  const contentText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!contentText) {
    throw new Error("No content returned by Gemini");
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
