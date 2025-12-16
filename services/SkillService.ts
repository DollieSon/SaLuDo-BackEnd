import { connectDB } from "../mongo_db";
import { ResumeRepository } from "../repositories/CandidateRepository";
import { SkillMasterRepository } from "../repositories/SkillMasterRepository";
import { Skill, CreateSkillData, SkillData, AddedBy } from "../Models/Skill";
import { SkillMaster } from "../Models/SkillMaster";
import { ObjectId } from "mongodb";
export class SkillService {
  private resumeRepo: ResumeRepository;
  private skillMasterRepo: SkillMasterRepository;
  constructor() {
    this.resumeRepo = null as any;
    this.skillMasterRepo = null as any;
  }
  async init(): Promise<void> {
    const db = await connectDB();
    this.resumeRepo = new ResumeRepository(db);
    this.skillMasterRepo = new SkillMasterRepository(db);
  }
  async addSkill(
    candidateId: string,
    skillData: CreateSkillData
  ): Promise<{ skillId: string; masterSkillId: string }> {
    await this.init();
    try {
      const resumeData = await this.resumeRepo.findById(candidateId);
      if (!resumeData) {
        throw new Error("Candidate resume data not found");
      }
      // Get or create skill in master database
      const masterSkill = await this.skillMasterRepo.getOrCreate(
        skillData.skillName
      );
      // Create new skill entry for candidate
      const skillId = new ObjectId().toString();
      const skill = new Skill(
        skillId,
        masterSkill.skillId,
        skillData.evidence || "",
        skillData.score || 5,
        skillData.addedBy || AddedBy.HUMAN
      );
      const updatedSkills = [
        ...resumeData.skills.map((s) => Skill.fromObject(s)),
        skill,
      ];
      await this.resumeRepo.update(candidateId, {
        skills: updatedSkills.map((s) => s.toObject()),
      });
      return {
        skillId: skill.skillId,
        masterSkillId: masterSkill.skillId,
      };
    } catch (error) {
      console.error("Error adding skill:", error);
      throw new Error("Failed to add skill");
    }
  }
  async addSkillsBulk(
    candidateId: string,
    skillsData: CreateSkillData[]
  ): Promise<Array<{ skillId: string; masterSkillId: string }>> {
    await this.init();
    try {
      const resumeData = await this.resumeRepo.findById(candidateId);
      if (!resumeData) {
        throw new Error("Candidate resume data not found");
      }
      const results: Array<{ skillId: string; masterSkillId: string }> = [];
      const newSkills: Skill[] = [];
      // Process each skill
      for (const skillData of skillsData) {
        // Get or create skill in master database
        const masterSkill = await this.skillMasterRepo.getOrCreate(
          skillData.skillName
        );
        // Create new skill entry for candidate
        const skillId = new ObjectId().toString();
        const skill = new Skill(
          skillId,
          masterSkill.skillId,
          skillData.evidence || "",
          skillData.score || 5,
          skillData.addedBy || AddedBy.HUMAN
        );
        newSkills.push(skill);
        results.push({
          skillId: skill.skillId,
          masterSkillId: masterSkill.skillId,
        });
      }
      // Update candidate with all new skills
      const existingSkills = resumeData.skills.map((s) => Skill.fromObject(s));
      const updatedSkills = [...existingSkills, ...newSkills];
      await this.resumeRepo.update(candidateId, {
        skills: updatedSkills.map((s) => s.toObject()),
      });
      return results;
    } catch (error) {
      console.error("Error adding skills in bulk:", error);
      throw new Error("Failed to add skills in bulk");
    }
  }
  async updateSkill(
    candidateId: string,
    candidateSkillId: string,
    updatedSkill: Partial<SkillData>
  ): Promise<void> {
    await this.init();
    try {
      // Use atomic MongoDB update with positional operator to avoid race conditions
      const db = await connectDB();
      const updateFields: any = {};
      
      if (updatedSkill.evidence !== undefined) {
        updateFields['skills.$.evidence'] = updatedSkill.evidence;
      }
      if (updatedSkill.score !== undefined) {
        updateFields['skills.$.score'] = updatedSkill.score;
      }
      if (updatedSkill.addedBy !== undefined) {
        updateFields['skills.$.addedBy'] = updatedSkill.addedBy;
      }
      
      updateFields['dateUpdated'] = new Date();
      
      const result = await db.collection('resume').updateOne(
        { 
          candidateId,
          'skills.candidateSkillId': candidateSkillId
        },
        { $set: updateFields }
      );
      
      if (result.matchedCount === 0) {
        throw new Error('Skill not found');
      }
    } catch (error) {
      console.error("Error updating skill:", error);
      throw new Error("Failed to update skill");
    }
  }
  async deleteSkill(
    candidateId: string,
    candidateSkillId: string
  ): Promise<void> {
    await this.init();
    try {
      const resumeData = await this.resumeRepo.findById(candidateId);
      if (!resumeData) {
        throw new Error("Candidate resume data not found");
      }
      const skills = resumeData.skills.map((s) => Skill.fromObject(s));
      const skillToDelete = skills.find(
        (s) => s.candidateSkillId === candidateSkillId
      );

      if (!skillToDelete) {
        throw new Error("Skill not found");
      }

      // Soft delete by setting isDeleted to true
      skillToDelete.isDeleted = true;

      await this.resumeRepo.update(candidateId, {
        skills: skills.map((s) => s.toObject()),
      });
    } catch (error) {
      console.error("Error soft deleting skill:", error);
      throw new Error("Failed to delete skill");
    }
  }

  // Method to restore a soft deleted skill
  async restoreSkill(
    candidateId: string,
    candidateSkillId: string
  ): Promise<void> {
    await this.init();
    try {
      const resumeData = await this.resumeRepo.findById(candidateId);
      if (!resumeData) {
        throw new Error("Candidate resume data not found");
      }
      const skills = resumeData.skills.map((s) => Skill.fromObject(s));
      const skillToRestore = skills.find(
        (s) => s.candidateSkillId === candidateSkillId
      );

      if (!skillToRestore) {
        throw new Error("Skill not found");
      }

      // Restore by setting isDeleted to false
      skillToRestore.isDeleted = false;

      await this.resumeRepo.update(candidateId, {
        skills: skills.map((s) => s.toObject()),
      });
    } catch (error) {
      console.error("Error restoring skill:", error);
      throw new Error("Failed to restore skill");
    }
  }

  // Method to hard delete (permanently remove) a skill
  async hardDeleteSkill(
    candidateId: string,
    candidateSkillId: string
  ): Promise<void> {
    await this.init();
    try {
      const resumeData = await this.resumeRepo.findById(candidateId);
      if (!resumeData) {
        throw new Error("Candidate resume data not found");
      }
      const skills = resumeData.skills.map((s) => Skill.fromObject(s));
      const filteredSkills = skills.filter(
        (s) => s.candidateSkillId !== candidateSkillId
      );

      if (filteredSkills.length === skills.length) {
        throw new Error("Skill not found");
      }

      await this.resumeRepo.update(candidateId, {
        skills: filteredSkills.map((s) => s.toObject()),
      });
    } catch (error) {
      console.error("Error hard deleting skill:", error);
      throw new Error("Failed to permanently delete skill");
    }
  }
  async getSkills(
    candidateId: string,
    includeUnaccepted: boolean = true,
    includeDeleted: boolean = false
  ): Promise<Array<Skill & { skillName: string; isAccepted: boolean }>> {
    await this.init();
    try {
      const resumeData = await this.resumeRepo.findById(candidateId);
      if (!resumeData) {
        return [];
      }
      let candidateSkills = resumeData.skills.map((s) => Skill.fromObject(s));

      // Filter out soft deleted skills by default
      if (!includeDeleted) {
        candidateSkills = candidateSkills.filter((s) => !s.isDeleted);
      }

      const enrichedSkills: Array<
        Skill & { skillName: string; isAccepted: boolean }
      > = [];
      // Enrich with master skill data
      for (const skill of candidateSkills) {
        const masterSkill = await this.skillMasterRepo.findById(skill.skillId);
        if (masterSkill && (includeUnaccepted || masterSkill.isAccepted)) {
          // Create enriched skill object
          const enrichedSkill = Object.assign(skill, {
            skillName: masterSkill.skillName,
            isAccepted: masterSkill.isAccepted,
          });
          enrichedSkills.push(enrichedSkill);
        }
      }
      return enrichedSkills;
    } catch (error) {
      console.error("Error getting skills:", error);
      throw new Error("Failed to retrieve skills");
    }
  }
  async getSkillsAboveThreshold(
    candidateId: string,
    threshold: number,
    includeUnaccepted: boolean = true
  ): Promise<Array<Skill & { skillName: string; isAccepted: boolean }>> {
    await this.init();
    try {
      const skills = await this.getSkills(candidateId, includeUnaccepted);
      return skills.filter((skill) => skill.score >= threshold);
    } catch (error) {
      console.error("Error getting skills above threshold:", error);
      throw new Error("Failed to retrieve skills above threshold");
    }
  }
  async searchSkillsByName(skillName: string): Promise<SkillMaster[]> {
    await this.init();
    try {
      return await this.skillMasterRepo.searchByName(skillName);
    } catch (error) {
      console.error("Error searching skills:", error);
      throw new Error("Failed to search skills");
    }
  }
  async getCandidatesWithSkill(
    skillName: string
  ): Promise<
    Array<{
      candidateId: string;
      skills: Array<Skill & { skillName: string; isAccepted: boolean }>;
    }>
  > {
    await this.init();
    try {
      // First find the skill in master database
      const masterSkills = await this.skillMasterRepo.searchByName(skillName);
      if (masterSkills.length === 0) {
        return [];
      }
      const skillIds = masterSkills.map((skill: SkillMaster) => skill.skillId);
      const results: Array<{
        candidateId: string;
        skills: Array<Skill & { skillName: string; isAccepted: boolean }>;
      }> = [];
      // Find all candidates with these skills
      const allCandidates = await this.resumeRepo.findAll();
      for (const candidate of allCandidates) {
        const candidateSkills = candidate.skills
          .map((s) => Skill.fromObject(s))
          .filter((skill) => skillIds.includes(skill.skillId));
        if (candidateSkills.length > 0) {
          const enrichedSkills: Array<
            Skill & { skillName: string; isAccepted: boolean }
          > = [];
          for (const skill of candidateSkills) {
            const masterSkill = masterSkills.find(
              (ms: SkillMaster) => ms.skillId === skill.skillId
            );
            if (masterSkill) {
              const enrichedSkill = Object.assign(skill, {
                skillName: masterSkill.skillName,
                isAccepted: masterSkill.isAccepted,
              });
              enrichedSkills.push(enrichedSkill);
            }
          }
          results.push({
            candidateId: candidate.candidateId,
            skills: enrichedSkills,
          });
        }
      }
      return results;
    } catch (error) {
      console.error("Error getting candidates with skill:", error);
      throw new Error("Failed to find candidates with skill");
    }
  }
  async getSkillMaster(skillId: string): Promise<SkillMaster | null> {
    await this.init();
    try {
      return await this.skillMasterRepo.findById(skillId);
    } catch (error) {
      console.error("Error getting skill master:", error);
      throw new Error("Failed to retrieve skill master data");
    }
  }
  async updateSkillMaster(
    skillId: string,
    updateData: { skillName?: string; isAccepted?: boolean }
  ): Promise<void> {
    await this.init();
    try {
      await this.skillMasterRepo.update(skillId, updateData);
    } catch (error) {
      console.error("Error updating skill master:", error);
      throw new Error("Failed to update skill master data");
    }
  }
  async getAllSkillMaster(): Promise<SkillMaster[]> {
    await this.init();
    try {
      return await this.skillMasterRepo.findAll();
    } catch (error) {
      console.error("Error getting all skill master data:", error);
      throw new Error("Failed to retrieve skill master data");
    }
  }

  async getUsedSkillMaster(): Promise<SkillMaster[]> {
    await this.init();
    try {
      // Get all candidates
      const allCandidates = await this.resumeRepo.findAll();

      // Collect all unique skill IDs used by candidates
      const usedSkillIds = new Set<string>();
      for (const candidate of allCandidates) {
        if (candidate.skills && Array.isArray(candidate.skills)) {
          candidate.skills.forEach((skillData) => {
            if (skillData.skillId) {
              usedSkillIds.add(skillData.skillId);
            }
          });
        }
      }

      // Get all skill master records
      const allSkills = await this.skillMasterRepo.findAll();

      // Filter to only skills that are used by at least one candidate
      return allSkills.filter((skill) => usedSkillIds.has(skill.skillId));
    } catch (error) {
      console.error("Error getting used skill master data:", error);
      throw new Error("Failed to retrieve used skill master data");
    }
  }

  async mergeSkills(
    targetSkillId: string,
    sourceSkillIds: string[]
  ): Promise<{
    mergedCount: number;
    updatedCandidates: number;
    targetSkill: SkillMaster;
  }> {
    await this.init();
    try {
      // Validate that target skill exists
      const targetSkill = await this.skillMasterRepo.findById(targetSkillId);
      if (!targetSkill) {
        throw new Error("Target skill not found");
      }

      // Validate that all source skills exist
      for (const sourceSkillId of sourceSkillIds) {
        const sourceSkill = await this.skillMasterRepo.findById(sourceSkillId);
        if (!sourceSkill) {
          throw new Error(`Source skill ${sourceSkillId} not found`);
        }
      }

      // Find all candidates with any of the source skills
      const allCandidates = await this.resumeRepo.findAll();
      let updatedCandidatesCount = 0;

      for (const candidate of allCandidates) {
        let hasChanges = false;
        const updatedSkills = candidate.skills.map((skillData) => {
          const skill = Skill.fromObject(skillData);

          // If this skill references one of the source skills, update it to target skill
          if (sourceSkillIds.includes(skill.skillId)) {
            skill.skillId = targetSkillId;
            hasChanges = true;
          }

          return skill.toObject();
        });

        // Remove duplicates (in case candidate had both source and target skills)
        const uniqueSkills = updatedSkills.reduce((acc, skill) => {
          const existingIndex = acc.findIndex(
            (s) => s.skillId === skill.skillId
          );
          if (existingIndex >= 0) {
            // Keep the one with higher score or more recent evidence
            const existing = Skill.fromObject(acc[existingIndex]);
            const current = Skill.fromObject(skill);

            if (
              current.score > existing.score ||
              (current.score === existing.score &&
                current.evidence.length > existing.evidence.length)
            ) {
              acc[existingIndex] = skill;
            }
          } else {
            acc.push(skill);
          }
          return acc;
        }, [] as any[]);

        if (hasChanges) {
          await this.resumeRepo.update(candidate.candidateId, {
            skills: uniqueSkills,
          });
          updatedCandidatesCount++;
        }
      }

      // Remove source skills from master database
      for (const sourceSkillId of sourceSkillIds) {
        await this.skillMasterRepo.hardDelete(sourceSkillId);
      }

      return {
        mergedCount: sourceSkillIds.length,
        updatedCandidates: updatedCandidatesCount,
        targetSkill: targetSkill,
      };
    } catch (error) {
      console.error("Error merging skills:", error);
      throw new Error("Failed to merge skills");
    }
  }
}
