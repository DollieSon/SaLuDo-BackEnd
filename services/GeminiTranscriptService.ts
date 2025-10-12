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
- traitName: the name of the trait (e.g., "Analytical Thinking")
- score: from 0.0 to 10.0 (floating point) based on how evident the trait is.
- evidence: should tell me why you chose this score.
- createdAt, updatedAt: current timestamps (use current ISO string).

Respond ONLY with valid JSON that exactly matches this structure:

{
  "cognitiveAndProblemSolving": {
    "analyticalThinking": {
      "traitName": "Analytical Thinking",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "curiosity": {
      "traitName": "Curiosity",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "creativity": {
      "traitName": "Creativity",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "attentionToDetail": {
      "traitName": "Attention to Detail",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "criticalThinking": {
      "traitName": "Critical Thinking",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "resourcefulness": {
      "traitName": "Resourcefulness",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  },
  "communicationAndTeamwork": {
    "clearCommunication": {
      "traitName": "Clear Communication",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "activeListening": {
      "traitName": "Active Listening",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "collaboration": {
      "traitName": "Collaboration",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "empathy": {
      "traitName": "Empathy",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "conflictResolution": {
      "traitName": "Conflict Resolution",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  },
  "workEthicAndReliability": {
    "dependability": {
      "traitName": "Dependability",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "accountability": {
      "traitName": "Accountability",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "persistence": {
      "traitName": "Persistence",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "timeManagement": {
      "traitName": "Time Management",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "organization": {
      "traitName": "Organization",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  },
  "growthAndLeadership": {
    "initiative": {
      "traitName": "Initiative",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "selfMotivation": {
      "traitName": "Self-Motivation",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "leadership": {
      "traitName": "Leadership",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "adaptability": {
      "traitName": "Adaptability",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "coachability": {
      "traitName": "Coachability",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  },
  "cultureAndPersonalityFit": {
    "positiveAttitude": {
      "traitName": "Positive Attitude",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "humility": {
      "traitName": "Humility",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "confidence": {
      "traitName": "Confidence",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "integrity": {
      "traitName": "Integrity",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "professionalism": {
      "traitName": "Professionalism",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "openMindedness": {
      "traitName": "Open-Mindedness",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "enthusiasm": {
      "traitName": "Enthusiasm",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  },
  "bonusTraits": {
    "customerFocus": {
      "traitName": "Customer Focus",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "visionaryThinking": {
      "traitName": "Visionary Thinking",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "culturalAwareness": {
      "traitName": "Cultural Awareness",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "senseOfHumor": {
      "traitName": "Sense of Humor",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "grit": {
      "traitName": "Grit",
      "score": 0.0,
      "evidence": "No evidence found",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}

Analyze the transcript and fill in appropriate scores (0.0-10.0) and evidence for each trait. Use current timestamp for createdAt and updatedAt.

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

  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY environment variable is not set. AI transcript processing will fail.');
  }

  console.log('=== DEBUG: Sending request to Gemini ===');
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload)
    }
  );

  const result = await response.json();
  console.log('=== DEBUG: Gemini raw response status:', response.status);
  
  const contentText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log('=== DEBUG: Gemini content text length:', contentText?.length || 0);
  console.log('=== DEBUG: Gemini content preview:', contentText?.substring(0, 500) || 'No content');

  if (!contentText) {
    throw new Error('No content returned by Gemini');
  }

  try {
    const cleaned = cleanGeminiJson(contentText);
    console.log('=== DEBUG: Cleaned JSON preview:', cleaned.substring(0, 500));
    
    const parsed: PersonalityData = JSON.parse(cleaned);
    
    // Validate the structure
    if (!parsed.cognitiveAndProblemSolving || !parsed.communicationAndTeamwork) {
      throw new Error('Invalid personality data structure returned by Gemini');
    }
    
    // Convert string dates to Date objects if needed
    const processedData = processPersonalityData(parsed);
    
    console.log('=== DEBUG: Successfully parsed personality data ===');
    return processedData;
  } catch (err) {
    console.error('=== DEBUG: Error parsing Gemini response:', err);
    console.error('=== DEBUG: Raw content:', contentText);
    throw new Error('Invalid JSON returned by Gemini: ' + contentText);
  }
}

// Helper function to process the personality data and ensure proper Date objects
function processPersonalityData(data: any): PersonalityData {
  const processCategory = (category: any) => {
    const processed: any = {};
    for (const [key, trait] of Object.entries(category)) {
      if (trait && typeof trait === 'object') {
        processed[key] = {
          ...(trait as any),
          createdAt: new Date((trait as any).createdAt),
          updatedAt: new Date((trait as any).updatedAt),
          score: parseFloat((trait as any).score) || 0
        };
      }
    }
    return processed;
  };

  return {
    cognitiveAndProblemSolving: processCategory(data.cognitiveAndProblemSolving),
    communicationAndTeamwork: processCategory(data.communicationAndTeamwork),
    workEthicAndReliability: processCategory(data.workEthicAndReliability),
    growthAndLeadership: processCategory(data.growthAndLeadership),
    cultureAndPersonalityFit: processCategory(data.cultureAndPersonalityFit),
    bonusTraits: processCategory(data.bonusTraits)
  };
}
