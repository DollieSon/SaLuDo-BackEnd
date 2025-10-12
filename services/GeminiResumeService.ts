import pdfParse from 'pdf-parse';
import { Buffer } from 'buffer';

interface ParsedData {
  skills: {
    skillName: string;
    score: number;
    evidence: string;
    addedBy: string;
  }[];
  education: any[];
  experience: any[];
  certifications: any[];
  strengths: any[];
  weaknesses: any[];
}

// Helper to clean Gemini's ```json\n...\n``` wrapping
function cleanGeminiJson(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')  // Remove starting ```json
    .replace(/```$/, '')          // Remove ending ```
    .trim();
}

export async function parseResumeWithGemini(buffer: Buffer): Promise<ParsedData> {
  // 1. Convert resume file to plain text
  const textContent = await pdfParse(buffer).then(data => data.text);

  // 2. Build Gemini request
  const requestPayload = {
    contents: [
      {
        parts: [
          {
            text: `You are a ai resume parser. Extract from this resume text the following structured fields as JSON:
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
${textContent}`
          }
        ]
      }
    ]
  };

  // 3. Call Gemini API
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload)
    }
  );

  const result = await response.json();
  const contentText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!contentText) {
    throw new Error('No content returned by Gemini');
  }

  try {
    const cleanedText = cleanGeminiJson(contentText);
    const parsed = JSON.parse(cleanedText);
    return parsed;
  } catch (err) {
    throw new Error('Invalid JSON returned by Gemini: ' + contentText);
  }
}
