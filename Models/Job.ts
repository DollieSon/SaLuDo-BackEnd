import { ObjectId } from 'mongodb';
import { JobData, CreateJobData, JobSkillRequirement, JobSummary } from './JobTypes';

export class Job {
    public _id?: string;
    public jobName: string;
    public jobDescription: string;
    public skills: JobSkillRequirement[];
    public createdAt: Date;
    public updatedAt: Date;

    constructor(
        jobName: string,
        jobDescription: string,
        skills: JobSkillRequirement[] = [], // Default to empty array
        _id?: string,
        createdAt?: Date,
        updatedAt?: Date
    ) {
        this._id = _id;
        this.jobName = jobName;
        this.jobDescription = jobDescription;
        this.skills = skills;
        this.createdAt = createdAt || new Date();
        this.updatedAt = updatedAt || new Date();

        this.validateJob();
    }

    private validateJob(): void {
        if (!this.jobName || this.jobName.trim().length === 0) {
            throw new Error('Job name is required');
        }
        
        if (!this.jobDescription || this.jobDescription.trim().length === 0) {
            throw new Error('Job description is required');
        }

        // Skills are now optional, so we only validate if they exist
        // Validate skills if provided
        if (this.skills && this.skills.length > 0) {
            this.skills.forEach((skill, index) => {
                if (!skill.skillId || skill.skillId.trim().length === 0) {
                    throw new Error(`Skill ID is required for skill at index ${index}`);
                }
                
                if (skill.requiredLevel < 0.0 || skill.requiredLevel > 10.0) {
                    throw new Error(`Required level must be between 0.0 and 10.0 for skill: ${skill.skillId}`);
                }
            });
        }
    }

    static create(jobData: CreateJobData): Job {
        return new Job(
            jobData.jobName,
            jobData.jobDescription,
            jobData.skills || [] // Use empty array if skills not provided
        );
    }

    static fromObject(obj: JobData): Job {
        return new Job(
            obj.jobName,
            obj.jobDescription,
            obj.skills,
            obj._id,
            new Date(obj.createdAt),
            new Date(obj.updatedAt)
        );
    }

    toObject(): JobData {
        return {
            _id: this._id,
            jobName: this.jobName,
            jobDescription: this.jobDescription,
            skills: this.skills,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    toSummary(): JobSummary {
        return {
            _id: this._id!,
            jobName: this.jobName,
            skillsCount: this.skills.length,
            createdAt: this.createdAt
        };
    }

    updateJob(updateData: Partial<CreateJobData>): void {
        if (updateData.jobName !== undefined) {
            this.jobName = updateData.jobName;
        }
        
        if (updateData.jobDescription !== undefined) {
            this.jobDescription = updateData.jobDescription;
        }
        
        if (updateData.skills !== undefined) {
            this.skills = updateData.skills;
        }

        this.updatedAt = new Date();
        this.validateJob();
    }

    addSkill(skill: JobSkillRequirement): void {
        // Check if skill already exists
        const existingSkillIndex = this.skills.findIndex(
            s => s.skillId === skill.skillId
        );
        
        if (existingSkillIndex !== -1) {
            // Update existing skill
            this.skills[existingSkillIndex] = skill;
        } else {
            // Add new skill
            this.skills.push(skill);
        }
        
        this.updatedAt = new Date();
    }

    removeSkill(skillId: string): void {
        this.skills = this.skills.filter(skill => skill.skillId !== skillId);
        this.updatedAt = new Date();
    }

    hasSkill(skillId: string): boolean {
        return this.skills.some(skill => skill.skillId === skillId);
    }

    getSkillRequiredLevel(skillId: string): number | null {
        const skill = this.skills.find(s => s.skillId === skillId);
        return skill ? skill.requiredLevel : null;
    }

    getSkillsCount(): number {
        return this.skills.length;
    }
}

// Re-export types for convenience
export type { JobData, CreateJobData, JobSkillRequirement, JobSummary, UpdateJobData, JobSearchCriteria } from './JobTypes';
