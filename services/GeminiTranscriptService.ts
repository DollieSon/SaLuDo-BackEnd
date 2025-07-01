// geminiTranscriptService.ts
import fetch from 'node-fetch';
import { PersonalityData, Trait } from '../Models/PersonalityTypes';

function cleanGeminiJson(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/```$/, '')
    .trim();
}

export async function analyzeTranscriptWithGemini(transcriptText: string): Promise<PersonalityData> {
  const prompt = `You are an AI that evaluates interview transcripts to infer personality traits. 

Using the transcript below, assess the candidate's traits using the following JSON structure. 
For each trait, return:
- score: from 0.0 to 10.0 (floating point) based on how evident the trait is.
- evidence: should tell me why you chose this trait.
- createdAt, updatedAt: current timestamps (you can use the same value).

Respond ONLY with valid JSON. No commentary.

Transcript:
"""
${transcriptText}
"""`;

  const requestPayload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
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
    const cleaned = cleanGeminiJson(contentText);
    const parsed: PersonalityData = JSON.parse(cleaned);
    return parsed;
  } catch (err) {
    throw new Error('Invalid JSON returned by Gemini: ' + contentText);
  }
}
