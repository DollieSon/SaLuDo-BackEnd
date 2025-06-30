import { connectDB } from '../mongo_db';
import { ResumeRepository } from '../repositories/CandidateRepository';
import { SkillMasterRepository } from '../repositories/SkillMasterRepository';
import { Skill, CreateSkillData, SkillData, AddedBy } from '../Models/Skill';
import { SkillMaster } from '../Models/SkillMaster';
import { ObjectId } from 'mongodb';
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
    async addSkill(candidateId: string, skillData: CreateSkillData): Promise<{ skillId: string; masterSkillId: string }> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            // Get or create skill in master database
            const masterSkill = await this.skillMasterRepo.getOrCreate(skillData.skillName);
            // Create new skill entry for candidate
            const skillId = new ObjectId().toString();
            const skill = new Skill(
                skillId,
                masterSkill.skillId,
                skillData.evidence || '',
                skillData.score || 5,
                skillData.addedBy || AddedBy.HUMAN
            );
            const updatedSkills = [...resumeData.skills.map(s => Skill.fromObject(s)), skill];
            await this.resumeRepo.update(candidateId, {
                skills: updatedSkills.map(s => s.toObject())
            });
            return {
                skillId: skill.skillId,
                masterSkillId: masterSkill.skillId
            };
        } catch (error) {
            console.error('Error adding skill:', error);
            throw new Error('Failed to add skill');
        }
    }
    async addSkillsBulk(candidateId: string, skillsData: CreateSkillData[]): Promise<Array<{ skillId: string; masterSkillId: string }>> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const results: Array<{ skillId: string; masterSkillId: string }> = [];
            const newSkills: Skill[] = [];
            // Process each skill
            for (const skillData of skillsData) {
                // Get or create skill in master database
                const masterSkill = await this.skillMasterRepo.getOrCreate(skillData.skillName);
                // Create new skill entry for candidate
                const skillId = new ObjectId().toString();
                const skill = new Skill(
                    skillId,
                    masterSkill.skillId,
                    skillData.evidence || '',
                    skillData.score || 5,
                    skillData.addedBy || AddedBy.HUMAN
                );
                newSkills.push(skill);
                results.push({
                    skillId: skill.skillId,
                    masterSkillId: masterSkill.skillId
                });
            }
            // Update candidate with all new skills
            const existingSkills = resumeData.skills.map(s => Skill.fromObject(s));
            const updatedSkills = [...existingSkills, ...newSkills];
            await this.resumeRepo.update(candidateId, {
                skills: updatedSkills.map(s => s.toObject())
            });
            return results;
        } catch (error) {
            console.error('Error adding skills in bulk:', error);
            throw new Error('Failed to add skills in bulk');
        }
    }
    async updateSkill(candidateId: string, candidateSkillId: string, updatedSkill: Partial<SkillData>): Promise<void> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const skills = resumeData.skills.map(s => Skill.fromObject(s));
            const skillIndex = skills.findIndex(s => s.candidateSkillId === candidateSkillId);
            if (skillIndex === -1) {
                throw new Error('Skill not found');
            }
            const skill = skills[skillIndex];
            // Update allowed properties
            if (updatedSkill.evidence !== undefined) skill.evidence = updatedSkill.evidence;
            if (updatedSkill.score !== undefined) skill.score = updatedSkill.score;
            if (updatedSkill.addedBy !== undefined) skill.addedBy = updatedSkill.addedBy;
            await this.resumeRepo.update(candidateId, {
                skills: skills.map(s => s.toObject())
            });
        } catch (error) {
            console.error('Error updating skill:', error);
            throw new Error('Failed to update skill');
        }
    }
    async deleteSkill(candidateId: string, candidateSkillId: string): Promise<void> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const skills = resumeData.skills.map(s => Skill.fromObject(s));
            const filteredSkills = skills.filter(s => s.candidateSkillId !== candidateSkillId);
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
    async getSkills(candidateId: string, includeUnaccepted: boolean = true): Promise<Array<Skill & { skillName: string; isAccepted: boolean }>> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                return [];
            }
            const candidateSkills = resumeData.skills.map(s => Skill.fromObject(s));
            const enrichedSkills: Array<Skill & { skillName: string; isAccepted: boolean }> = [];
            // Enrich with master skill data
            for (const skill of candidateSkills) {
                const masterSkill = await this.skillMasterRepo.findById(skill.skillId);
                if (masterSkill && (includeUnaccepted || masterSkill.isAccepted)) {
                    // Create enriched skill object
                    const enrichedSkill = Object.assign(skill, {
                        skillName: masterSkill.skillName,
                        isAccepted: masterSkill.isAccepted
                    });
                    enrichedSkills.push(enrichedSkill);
                }
            }
            return enrichedSkills;
        } catch (error) {
            console.error('Error getting skills:', error);
            throw new Error('Failed to retrieve skills');
        }
    }
    async getSkillsAboveThreshold(candidateId: string, threshold: number, includeUnaccepted: boolean = true): Promise<Array<Skill & { skillName: string; isAccepted: boolean }>> {
        await this.init();
        try {
            const skills = await this.getSkills(candidateId, includeUnaccepted);
            return skills.filter(skill => skill.score >= threshold);
        } catch (error) {
            console.error('Error getting skills above threshold:', error);
            throw new Error('Failed to retrieve skills above threshold');
        }
    }
    async searchSkillsByName(skillName: string): Promise<SkillMaster[]> {
        await this.init();
        try {
            return await this.skillMasterRepo.searchByName(skillName);
        } catch (error) {
            console.error('Error searching skills:', error);
            throw new Error('Failed to search skills');
        }
    }
    async getCandidatesWithSkill(skillName: string): Promise<Array<{ candidateId: string; skills: Array<Skill & { skillName: string; isAccepted: boolean }> }>> {
        await this.init();
        try {
            // First find the skill in master database
            const masterSkills = await this.skillMasterRepo.searchByName(skillName);
            if (masterSkills.length === 0) {
                return [];
            }
            const skillIds = masterSkills.map((skill: SkillMaster) => skill.skillId);
            const results: Array<{ candidateId: string; skills: Array<Skill & { skillName: string; isAccepted: boolean }> }> = [];
            // Find all candidates with these skills
            const allCandidates = await this.resumeRepo.findAll();
            for (const candidate of allCandidates) {
                const candidateSkills = candidate.skills
                    .map(s => Skill.fromObject(s))
                    .filter(skill => skillIds.includes(skill.skillId));
                if (candidateSkills.length > 0) {
                    const enrichedSkills: Array<Skill & { skillName: string; isAccepted: boolean }> = [];
                    for (const skill of candidateSkills) {
                        const masterSkill = masterSkills.find((ms: SkillMaster) => ms.skillId === skill.skillId);
                        if (masterSkill) {
                            const enrichedSkill = Object.assign(skill, {
                                skillName: masterSkill.skillName,
                                isAccepted: masterSkill.isAccepted
                            });
                            enrichedSkills.push(enrichedSkill);
                        }
                    }
                    results.push({
                        candidateId: candidate.candidateId,
                        skills: enrichedSkills
                    });
                }
            }
            return results;
        } catch (error) {
            console.error('Error getting candidates with skill:', error);
            throw new Error('Failed to find candidates with skill');
        }
    }
    async getSkillMaster(skillId: string): Promise<SkillMaster | null> {
        await this.init();
        try {
            return await this.skillMasterRepo.findById(skillId);
        } catch (error) {
            console.error('Error getting skill master:', error);
            throw new Error('Failed to retrieve skill master data');
        }
    }
    async updateSkillMaster(skillId: string, updateData: { skillName?: string; isAccepted?: boolean }): Promise<void> {
        await this.init();
        try {
            await this.skillMasterRepo.update(skillId, updateData);
        } catch (error) {
            console.error('Error updating skill master:', error);
            throw new Error('Failed to update skill master data');
        }
    }
}
