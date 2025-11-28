import { InterviewRepository } from "../../repositories/CandidateRepository";
import { Personality, PersonalityData } from "../../Models/Personality";
import {
  ERROR_MESSAGES,
  LOG_MESSAGES,
  SCORE_RANGE,
  PERSONALITY_CATEGORY_MAP,
  PERSONALITY_SUBCATEGORY_MAP,
} from "../../constants/CandidateServiceConstants";

export class CandidatePersonalityService {
  constructor(private interviewRepo: InterviewRepository) {}

  async getCandidatePersonality(
    candidateId: string
  ): Promise<Personality | null> {
    try {
      const interviewData = await this.interviewRepo.findById(candidateId);
      if (!interviewData?.personality) {
        return null;
      }
      return Personality.fromObject(interviewData.personality);
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_GETTING_PERSONALITY, error);
      throw new Error(ERROR_MESSAGES.FAILED_TO_RETRIEVE_PERSONALITY);
    }
  }

  async updateCandidatePersonalityTrait(
    candidateId: string,
    category: string,
    subcategory: string,
    traitData: { score: number; evidence: string }
  ): Promise<void> {
    try {
      // Validate category and subcategory
      this.validatePersonalityCategory(category, subcategory);

      // Validate score
      if (traitData.score < SCORE_RANGE.MIN || traitData.score > SCORE_RANGE.MAX) {
        throw new Error(ERROR_MESSAGES.INVALID_SCORE_RANGE);
      }

      // Get current personality data
      const interviewData = await this.interviewRepo.findById(candidateId);
      if (!interviewData) {
        throw new Error(ERROR_MESSAGES.CANDIDATE_NOT_FOUND);
      }

      // Get current personality or create new one
      const personality = interviewData.personality
        ? Personality.fromObject(interviewData.personality)
        : new Personality();

      // Update the specific trait
      this.updatePersonalityTrait(
        personality,
        category,
        subcategory,
        traitData
      );

      // Save updated personality
      await this.interviewRepo.update(candidateId, {
        personality: personality.toObject(),
        dateUpdated: new Date(),
      });
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_UPDATING_PERSONALITY_TRAIT, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(ERROR_MESSAGES.FAILED_TO_UPDATE_PERSONALITY_TRAIT);
    }
  }

  async updateCandidatePersonality(
    candidateId: string,
    personalityData: PersonalityData
  ): Promise<void> {
    try {
      console.log("=== DEBUG: updateCandidatePersonality START ===");
      console.log("candidateId:", candidateId);
      console.log("personalityData type:", typeof personalityData);
      console.log("personalityData keys:", Object.keys(personalityData || {}));

      // Check if personalityData has the expected structure
      if (!personalityData || typeof personalityData !== "object") {
        throw new Error(ERROR_MESSAGES.INVALID_PERSONALITY_DATA);
      }

      const interviewData = await this.interviewRepo.findById(candidateId);
      if (!interviewData) {
        throw new Error(ERROR_MESSAGES.CANDIDATE_NOT_FOUND);
      }

      console.log("Current interview personality:", interviewData.personality);

      // Create personality instance to validate data
      console.log("Creating Personality instance...");
      const personality = new Personality(personalityData);
      console.log("Personality instance created successfully");

      const personalityObject = personality.toObject();
      console.log(
        "Personality toObject() result:",
        JSON.stringify(personalityObject, null, 2)
      );

      // Save updated personality
      console.log("Updating personality in database...");
      await this.interviewRepo.update(candidateId, {
        personality: personalityObject,
        dateUpdated: new Date(),
      });
      console.log("=== DEBUG: updateCandidatePersonality END ===");
    } catch (error) {
      console.error(LOG_MESSAGES.ERROR_UPDATING_PERSONALITY, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(ERROR_MESSAGES.FAILED_TO_UPDATE_PERSONALITY);
    }
  }

  private validatePersonalityCategory(
    category: string,
    subcategory: string
  ): void {
    const normalizedCategory = category.toLowerCase().replace(/[^a-z]/g, "");
    if (!PERSONALITY_CATEGORY_MAP[normalizedCategory]) {
      throw new Error(
        `${ERROR_MESSAGES.INVALID_CATEGORY}: ${category}. Valid categories are: cognitive, communication, workethic, growth, culture, bonus`
      );
    }
  }

  private updatePersonalityTrait(
    personality: Personality,
    category: string,
    subcategory: string,
    traitData: { score: number; evidence: string }
  ): void {
    const normalizedCategory = category.toLowerCase().replace(/[^a-z]/g, "");
    const normalizedSubcategory = subcategory
      .toLowerCase()
      .replace(/[^a-z]/g, "");

    const categoryKey = PERSONALITY_CATEGORY_MAP[normalizedCategory] as keyof Personality;
    const subcategoryKey = PERSONALITY_SUBCATEGORY_MAP[normalizedSubcategory];

    if (!categoryKey || !subcategoryKey) {
      throw new Error(
        `${ERROR_MESSAGES.INVALID_TRAIT}: ${category}.${subcategory}`
      );
    }

    const categoryData = personality[categoryKey] as any;
    if (!categoryData || !categoryData[subcategoryKey]) {
      throw new Error(`${ERROR_MESSAGES.INVALID_TRAIT}: ${category}.${subcategory}`);
    }

    // Update the trait
    const currentTrait = categoryData[subcategoryKey];
    categoryData[subcategoryKey] = {
      ...currentTrait,
      score: traitData.score,
      evidence: traitData.evidence,
      updatedAt: new Date(),
    };
  }
}
