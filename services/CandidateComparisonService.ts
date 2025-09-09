import { CandidateService } from "./CandidateService";
import { Candidate, CandidateData } from "../Models/Candidate";
import { SkillData, SkillWithMasterData } from "../Models/Skill";
import { PersonalityData } from "../Models/PersonalityTypes";
import { SkillMasterRepository } from "../repositories/SkillMasterRepository";
import { connectDB } from "../mongo_db";

export interface CandidateComparisonData {
  candidate1: CandidateData;
  candidate2: CandidateData;
  comparison: {
    personalInfo: {
      ageComparison: {
        candidate1Age: number;
        candidate2Age: number;
        ageDifference: number;
      };
      experienceComparison: {
        candidate1Experience: number;
        candidate2Experience: number;
        experienceDifference: number;
      };
      certificationComparison: {
        candidate1Certification: number;
        candidate2Certification: number;
        certificationDifference: number;
      };
    };
    skills: {
      commonSkills: SkillWithMasterData[];
      uniqueToCandidate1: SkillWithMasterData[];
      uniqueToCandidate2: SkillWithMasterData[];
      skillScoreComparison: {
        skillName: string;
        candidate1Score: number;
        candidate2Score: number;
        scoreDifference: number;
      }[];
    };
    personality: {
      candidate1PersonalityScore: number;
      candidate2PersonalityScore: number;
      personalityDifference: number;
      categoryComparisons: {
        category: string;
        candidate1Score: number;
        candidate2Score: number;
        difference: number;
      }[];
    };
    overallComparison: {
      totalSkillsComparison: {
        candidate1Total: number;
        candidate2Total: number;
        difference: number;
      };
      averageSkillScoreComparison: {
        candidate1Average: number;
        candidate2Average: number;
        difference: number;
      };
      recommendedCandidate: "candidate1" | "candidate2" | "tie";
      recommendation: string;
    };
  };
}

export class CandidateComparisonService {
  private candidateService: CandidateService;
  private skillMasterRepo: SkillMasterRepository | null = null;

  constructor() {
    this.candidateService = new CandidateService();
  }

  private async init(): Promise<void> {
    if (!this.skillMasterRepo) {
      const db = await connectDB();
      this.skillMasterRepo = new SkillMasterRepository(db);
    }
  }

  public async compareCandidates(
    candidateId1: string,
    candidateId2: string
  ): Promise<CandidateComparisonData> {
    // Initialize repositories
    await this.init();

    // Fetch both candidates
    const candidate1 = await this.candidateService.getCandidate(candidateId1);
    const candidate2 = await this.candidateService.getCandidate(candidateId2);

    if (!candidate1 || !candidate2) {
      throw new Error("One or both candidates not found");
    }

    // Get personality data
    const personality1 = await this.candidateService.getCandidatePersonality(
      candidateId1
    );
    const personality2 = await this.candidateService.getCandidatePersonality(
      candidateId2
    );

    // Perform comparisons
    const comparison = await this.performComparison(
      candidate1,
      candidate2,
      personality1,
      personality2
    );

    return {
      candidate1,
      candidate2,
      comparison,
    };
  }

  private async performComparison(
    candidate1: CandidateData,
    candidate2: CandidateData,
    personality1: PersonalityData | null,
    personality2: PersonalityData | null
  ) {
    // Personal info comparison
    const personalInfo = this.comparePersonalInfo(candidate1, candidate2);

    // Skills comparison
    const skills = await this.compareSkills(
      candidate1.skills || [],
      candidate2.skills || []
    );

    // Personality comparison
    const personality = this.comparePersonality(personality1, personality2);

    // Overall comparison
    const overallComparison = this.calculateOverallComparison(
      candidate1,
      candidate2,
      skills,
      personality
    );

    return {
      personalInfo,
      skills,
      personality,
      overallComparison,
    };
  }

  private comparePersonalInfo(
    candidate1: CandidateData,
    candidate2: CandidateData
  ) {
    // Calculate ages
    const candidate1Age = this.calculateAge(candidate1.birthdate);
    const candidate2Age = this.calculateAge(candidate2.birthdate);

    // Count experience and certification
    const candidate1Experience = candidate1.experience?.length || 0;
    const candidate2Experience = candidate2.experience?.length || 0;
    const candidate1Certification = candidate1.certification?.length || 0;
    const candidate2Certification = candidate2.certification?.length || 0;

    return {
      ageComparison: {
        candidate1Age,
        candidate2Age,
        ageDifference: Math.abs(candidate1Age - candidate2Age),
      },
      experienceComparison: {
        candidate1Experience,
        candidate2Experience,
        experienceDifference: candidate1Experience - candidate2Experience,
      },
      certificationComparison: {
        candidate1Certification,
        candidate2Certification,
        certificationDifference:
          candidate1Certification - candidate2Certification,
      },
    };
  }

  private async compareSkills(skills1: SkillData[], skills2: SkillData[]) {
    const skillMap1 = new Map(skills1.map((s) => [s.skillId, s]));
    const skillMap2 = new Map(skills2.map((s) => [s.skillId, s]));

    const allSkillIds = new Set([...skillMap1.keys(), ...skillMap2.keys()]);

    const commonSkills: SkillWithMasterData[] = [];
    const uniqueToCandidate1: SkillWithMasterData[] = [];
    const uniqueToCandidate2: SkillWithMasterData[] = [];
    const skillScoreComparison: {
      skillName: string;
      candidate1Score: number;
      candidate2Score: number;
      scoreDifference: number;
    }[] = [];

    // Resolve skill names for all skills
    for (const skillId of allSkillIds) {
      const skill1 = skillMap1.get(skillId);
      const skill2 = skillMap2.get(skillId);

      // Get skill name from master data
      let skillName = skillId; // fallback to skillId
      try {
        if (this.skillMasterRepo) {
          const masterSkill = await this.skillMasterRepo.findById(skillId);
          if (masterSkill) {
            skillName = masterSkill.skillName;
          }
        }
      } catch (error) {
        console.warn(`Could not resolve skill name for ${skillId}:`, error);
      }

      if (skill1 && skill2) {
        // Common skill
        const skillWithMaster: SkillWithMasterData = {
          ...skill1,
          skillName,
          isAccepted: true,
        };
        commonSkills.push(skillWithMaster);
        skillScoreComparison.push({
          skillName,
          candidate1Score: skill1.score || 0,
          candidate2Score: skill2.score || 0,
          scoreDifference: (skill1.score || 0) - (skill2.score || 0),
        });
      } else if (skill1 && !skill2) {
        const skillWithMaster: SkillWithMasterData = {
          ...skill1,
          skillName,
          isAccepted: true,
        };
        uniqueToCandidate1.push(skillWithMaster);
      } else if (!skill1 && skill2) {
        const skillWithMaster: SkillWithMasterData = {
          ...skill2,
          skillName,
          isAccepted: true,
        };
        uniqueToCandidate2.push(skillWithMaster);
      }
    }

    return {
      commonSkills,
      uniqueToCandidate1,
      uniqueToCandidate2,
      skillScoreComparison,
    };
  }

  private comparePersonality(
    personality1: PersonalityData | null,
    personality2: PersonalityData | null
  ) {
    if (!personality1 || !personality2) {
      return {
        candidate1PersonalityScore: 0,
        candidate2PersonalityScore: 0,
        personalityDifference: 0,
        categoryComparisons: [],
      };
    }

    // Calculate overall personality scores
    const candidate1Score = this.calculatePersonalityScore(personality1);
    const candidate2Score = this.calculatePersonalityScore(personality2);

    // Compare by categories
    const categoryComparisons = this.comparePersonalityCategories(
      personality1,
      personality2
    );

    return {
      candidate1PersonalityScore: candidate1Score,
      candidate2PersonalityScore: candidate2Score,
      personalityDifference: candidate1Score - candidate2Score,
      categoryComparisons,
    };
  }

  private calculatePersonalityScore(personality: PersonalityData): number {
    const categories = [
      personality.cognitiveAndProblemSolving,
      personality.communicationAndTeamwork,
      personality.workEthicAndReliability,
      personality.growthAndLeadership,
      personality.cultureAndPersonalityFit,
      personality.bonusTraits,
    ];

    let totalScore = 0;
    let totalTraits = 0;

    categories.forEach((category) => {
      if (category) {
        Object.values(category).forEach((trait: any) => {
          if (trait && typeof trait.score === "number") {
            totalScore += trait.score || 0;
            totalTraits++;
          }
        });
      }
    });

    return totalTraits > 0 ? Number((totalScore / totalTraits).toFixed(1)) : 0;
  }

  private comparePersonalityCategories(
    personality1: PersonalityData,
    personality2: PersonalityData
  ) {
    const categories = [
      {
        name: "Cognitive & Problem Solving",
        cat1: personality1.cognitiveAndProblemSolving,
        cat2: personality2.cognitiveAndProblemSolving,
      },
      {
        name: "Communication & Teamwork",
        cat1: personality1.communicationAndTeamwork,
        cat2: personality2.communicationAndTeamwork,
      },
      {
        name: "Work Ethic & Reliability",
        cat1: personality1.workEthicAndReliability,
        cat2: personality2.workEthicAndReliability,
      },
      {
        name: "Growth & Leadership",
        cat1: personality1.growthAndLeadership,
        cat2: personality2.growthAndLeadership,
      },
      {
        name: "Culture & Personality Fit",
        cat1: personality1.cultureAndPersonalityFit,
        cat2: personality2.cultureAndPersonalityFit,
      },
      {
        name: "Bonus Traits",
        cat1: personality1.bonusTraits,
        cat2: personality2.bonusTraits,
      },
    ];

    return categories.map(({ name, cat1, cat2 }) => {
      const score1 = this.calculateCategoryScore(cat1);
      const score2 = this.calculateCategoryScore(cat2);
      return {
        category: name,
        candidate1Score: score1,
        candidate2Score: score2,
        difference: score1 - score2,
      };
    });
  }

  private calculateCategoryScore(category: any): number {
    if (!category) return 0;

    const traits = Object.values(category);
    const validTraits = traits.filter(
      (trait: any) => trait && typeof trait.score === "number"
    );

    if (validTraits.length === 0) return 0;

    const totalScore = validTraits.reduce(
      (sum: number, trait: any) => sum + (trait.score || 0),
      0
    );
    return Number((totalScore / validTraits.length).toFixed(1));
  }

  private calculateOverallComparison(
    candidate1: CandidateData,
    candidate2: CandidateData,
    skillsComparison: any,
    personalityComparison: any
  ) {
    const candidate1Skills = candidate1.skills || [];
    const candidate2Skills = candidate2.skills || [];

    // Total skills comparison
    const totalSkillsComparison = {
      candidate1Total: candidate1Skills.length,
      candidate2Total: candidate2Skills.length,
      difference: candidate1Skills.length - candidate2Skills.length,
    };

    // Average skill score comparison
    const candidate1AvgScore =
      this.calculateAverageSkillScore(candidate1Skills);
    const candidate2AvgScore =
      this.calculateAverageSkillScore(candidate2Skills);

    const averageSkillScoreComparison = {
      candidate1Average: candidate1AvgScore,
      candidate2Average: candidate2AvgScore,
      difference: candidate1AvgScore - candidate2AvgScore,
    };

    // Determine recommended candidate
    const { recommendedCandidate, recommendation } =
      this.determineRecommendation(
        candidate1,
        candidate2,
        skillsComparison,
        personalityComparison,
        averageSkillScoreComparison
      );

    return {
      totalSkillsComparison,
      averageSkillScoreComparison,
      recommendedCandidate,
      recommendation,
    };
  }

  private calculateAverageSkillScore(skills: SkillData[]): number {
    if (skills.length === 0) return 0;

    const validSkills = skills.filter((s) => s.score && s.score > 0);
    if (validSkills.length === 0) return 0;

    const totalScore = validSkills.reduce(
      (sum, skill) => sum + (skill.score || 0),
      0
    );
    return Number((totalScore / validSkills.length).toFixed(1));
  }

  private determineRecommendation(
    candidate1: CandidateData,
    candidate2: CandidateData,
    skillsComparison: any,
    personalityComparison: any,
    averageSkillScoreComparison: any
  ): {
    recommendedCandidate: "candidate1" | "candidate2" | "tie";
    recommendation: string;
  } {
    let candidate1Score = 0;
    let candidate2Score = 0;
    let factors: string[] = [];

    // Factor 1: Average skill score (weight: 40%)
    if (
      averageSkillScoreComparison.candidate1Average >
      averageSkillScoreComparison.candidate2Average
    ) {
      candidate1Score += 4;
      factors.push(`${candidate1.name} has higher average skill scores`);
    } else if (
      averageSkillScoreComparison.candidate2Average >
      averageSkillScoreComparison.candidate1Average
    ) {
      candidate2Score += 4;
      factors.push(`${candidate2.name} has higher average skill scores`);
    }

    // Factor 2: Personality score (weight: 30%)
    if (
      personalityComparison.candidate1PersonalityScore >
      personalityComparison.candidate2PersonalityScore
    ) {
      candidate1Score += 3;
      factors.push(`${candidate1.name} has better personality assessment`);
    } else if (
      personalityComparison.candidate2PersonalityScore >
      personalityComparison.candidate1PersonalityScore
    ) {
      candidate2Score += 3;
      factors.push(`${candidate2.name} has better personality assessment`);
    }

    // Factor 3: Total skills count (weight: 20%)
    if (
      skillsComparison.uniqueToCandidate1.length >
      skillsComparison.uniqueToCandidate2.length
    ) {
      candidate1Score += 2;
      factors.push(`${candidate1.name} has more unique skills`);
    } else if (
      skillsComparison.uniqueToCandidate2.length >
      skillsComparison.uniqueToCandidate1.length
    ) {
      candidate2Score += 2;
      factors.push(`${candidate2.name} has more unique skills`);
    }

    // Factor 4: Experience count (weight: 10%)
    const exp1 = candidate1.experience?.length || 0;
    const exp2 = candidate2.experience?.length || 0;
    if (exp1 > exp2) {
      candidate1Score += 1;
      factors.push(`${candidate1.name} has more work experience`);
    } else if (exp2 > exp1) {
      candidate2Score += 1;
      factors.push(`${candidate2.name} has more work experience`);
    }

    // Determine winner
    let recommendedCandidate: "candidate1" | "candidate2" | "tie";
    let recommendation: string;

    if (candidate1Score > candidate2Score) {
      recommendedCandidate = "candidate1";
      recommendation = `${
        candidate1.name
      } is recommended. Key factors: ${factors
        .filter((f) => f.includes(candidate1.name))
        .join(", ")}.`;
    } else if (candidate2Score > candidate1Score) {
      recommendedCandidate = "candidate2";
      recommendation = `${
        candidate2.name
      } is recommended. Key factors: ${factors
        .filter((f) => f.includes(candidate2.name))
        .join(", ")}.`;
    } else {
      recommendedCandidate = "tie";
      recommendation = `Both candidates are equally matched. Consider other factors like cultural fit, interview performance, and specific role requirements.`;
    }

    return { recommendedCandidate, recommendation };
  }

  private calculateAge(birthdate: Date): number {
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age;
  }
}
