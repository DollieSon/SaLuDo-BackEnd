// Job-related types and interfaces

export interface JobSkillRequirement {
    skillId: string;           
    requiredLevel: number;     //0.0 - 10.0
    evidence?: string;         // Optional evidence/justification for the skill requirement
}

export interface JobData {
    _id?: string;              // MongoDB ObjectId as string
    jobName: string;
    jobDescription: string;
    skills: JobSkillRequirement[];
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateJobData {
    jobName: string;
    jobDescription: string;
    skills?: JobSkillRequirement[];  // Made optional - skills can be added later
}

export interface UpdateJobData {
    jobName?: string;
    jobDescription?: string;
    skills?: JobSkillRequirement[];
}

export interface JobSearchCriteria {
    skillIds?: string[];
    skillNames?: string[];
    jobName?: string;
    page?: number;
    limit?: number;
}

export interface JobSummary {
    _id: string;
    jobName: string;
    skillsCount: number;
    createdAt: Date;
}

export interface JobSkillWithMaster extends JobSkillRequirement {
    skillName: string;         // From SkillMaster join
    isAccepted: boolean;      // From SkillMaster join
}

export interface JobWithSkillNames extends Omit<JobData, 'skills'> {
    skills: JobSkillWithMaster[];
}

export interface JobMatchScore {
    _id: string;
    jobName: string;
    matchPercentage: number;
    matchingSkills: number;
    totalRequiredSkills: number;
    missingSkills: string[];
    skillGaps: {
        skillName: string;
        required: number;
        current: number;
        gap: number;
    }[];
}