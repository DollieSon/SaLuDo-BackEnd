import { connectDB } from '../mongo_db';
import { ResumeRepository } from '../repositories/CandidateRepository';
import { Skill, CreateSkillData, SkillData } from '../Models/Skill';
import { ObjectId } from 'mongodb';

/**
 * Service class that's absolutely slaying at skill management 
 * This bad boy handles all the skill flex and assessment vibes
 * Like bestie, your skills are about to be managed to perfection fr fr 
 */
export class SkillService {
    private resumeRepo: ResumeRepository;

    constructor() {
        this.resumeRepo = null as any;
    }

    /**
     * Initialize the service with database connection
     * Connecting to the database like we're linking up with the skill matrix 
     */
    async init(): Promise<void> {
        const db = await connectDB();
        this.resumeRepo = new ResumeRepository(db);
    }

    /**
     * Adds a skill to a candidate
     * Manifesting some new skill energy into this candidate's arsenal 
     */
    async addSkill(candidateId: string, skillData: CreateSkillData): Promise<void> {
        await this.init();

        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }

            const skillId = new ObjectId().toString();
            const skill = new Skill(
                skillId,
                skillData.skillName,
                skillData.evidenceReason,
                skillData.score,
                skillData.addedBy
            );

            const updatedSkills = [...resumeData.skills.map(s => Skill.fromObject(s)), skill];
            
            await this.resumeRepo.update(candidateId, {
                skills: updatedSkills.map(s => s.toObject())
            });
        } catch (error) {
            console.error('Error adding skill:', error);
            throw new Error('Failed to add skill');
        }
    }

    /**
     * Updates a specific skill
     */
    async updateSkill(candidateId: string, skillId: string, updatedSkill: Partial<SkillData>): Promise<void> {
        await this.init();

        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }

            const skills = resumeData.skills.map(s => Skill.fromObject(s));
            const skillIndex = skills.findIndex(s => s.skillId === skillId);
            
            if (skillIndex === -1) {
                throw new Error('Skill not found');
            }

            const skill = skills[skillIndex];
            if (updatedSkill.skillName) skill.skillName = updatedSkill.skillName;
            if (updatedSkill.evidenceReason) skill.evidenceReason = updatedSkill.evidenceReason;
            if (updatedSkill.score !== undefined) skill.score = updatedSkill.score;
            if (updatedSkill.addedBy) skill.addedBy = updatedSkill.addedBy;

            await this.resumeRepo.update(candidateId, {
                skills: skills.map(s => s.toObject())
            });
        } catch (error) {
            console.error('Error updating skill:', error);
            throw new Error('Failed to update skill');
        }
    }

    /**
     * Deletes a specific skill
     */
    async deleteSkill(candidateId: string, skillId: string): Promise<void> {
        await this.init();

        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }

            const skills = resumeData.skills.map(s => Skill.fromObject(s));
            const filteredSkills = skills.filter(s => s.skillId !== skillId);

            if (filteredSkills.length === skills.length) {
                throw new Error('Skill not found');
            }

            await this.resumeRepo.update(candidateId, {
                skills: filteredSkills.map(s => s.toObject())
            });
        } catch (error) {
            console.error('Error deleting skill:', error);
            throw new Error('Failed to delete skill');
        }
    }

    /**
     * Gets all skills for a candidate
     */
    async getSkills(candidateId: string): Promise<Skill[]> {
        await this.init();

        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                return [];
            }

            return resumeData.skills.map(s => Skill.fromObject(s));
        } catch (error) {
            console.error('Error getting skills:', error);
            throw new Error('Failed to retrieve skills');
        }
    }

    /**
     * Gets skills above a certain score threshold
     */
    async getSkillsAboveThreshold(candidateId: string, threshold: number): Promise<Skill[]> {
        await this.init();

        try {
            const skills = await this.getSkills(candidateId);
            return skills.filter(skill => skill.isAboveThreshold(threshold));
        } catch (error) {
            console.error('Error getting skills above threshold:', error);
            throw new Error('Failed to retrieve skills above threshold');
        }
    }

    /**
     * Searches skills by name across all candidates
     */
    async searchSkillsByName(skillName: string): Promise<{ candidateId: string; skills: Skill[] }[]> {
        await this.init();

        try {
            const resumeDataList = await this.resumeRepo.findBySkill(skillName);
            
            return resumeDataList.map(resumeData => ({
                candidateId: resumeData.candidateId,
                skills: resumeData.skills
                    .map(s => Skill.fromObject(s))
                    .filter(skill => skill.skillName.toLowerCase().includes(skillName.toLowerCase()))
            }));
        } catch (error) {
            console.error('Error searching skills:', error);
            throw new Error('Failed to search skills');
        }
    }
}
