import { Job, JobData, CreateJobData, UpdateJobData, JobSearchCriteria, JobSummary } from '../Models/Job';
import { JobWithSkillNames } from '../Models/JobTypes';
import { JobRepository } from '../repositories/JobRepository';
import { SkillMasterRepository } from '../repositories/SkillMasterRepository';
import { connectDB } from '../mongo_db';

export class JobService {
    private jobRepo: JobRepository;
    private skillMasterRepo: SkillMasterRepository | null = null;

    constructor() {
        this.jobRepo = new JobRepository();
    }

    private async initSkillMasterRepo(): Promise<void> {
        if (!this.skillMasterRepo) {
            const db = await connectDB();
            this.skillMasterRepo = new SkillMasterRepository(db);
        }
    }

    async createJob(jobData: CreateJobData): Promise<JobData> {
        try {
            // Initialize skill master repo
            await this.initSkillMasterRepo();
            
            // Validate that all skill IDs exist in SkillMaster (only if skills provided)
            if (jobData.skills && jobData.skills.length > 0) {
                await this.validateSkillIds(jobData.skills.map(s => s.skillId));
            }
            
            // Create job instance
            const job = Job.create(jobData);
            
            // Save to database
            const savedJob = await this.jobRepo.create(job.toObject());
            
            return savedJob;
        } catch (error) {
            console.error('Error creating job:', error);
            throw new Error('Failed to create job');
        }
    }

    async getJob(jobId: string): Promise<JobData | null> {
        try {
            const jobData = await this.jobRepo.findById(jobId);
            return jobData;
        } catch (error) {
            console.error('Error getting job:', error);
            throw new Error('Failed to retrieve job');
        }
    }

    async getJobWithSkillNames(jobId: string): Promise<JobWithSkillNames | null> {
        try {
            const jobWithSkills = await this.jobRepo.findWithSkillNames(jobId);
            return jobWithSkills;
        } catch (error) {
            console.error('Error getting job with skill names:', error);
            throw new Error('Failed to retrieve job with skill details');
        }
    }

    async getAllJobs(page: number = 1, limit: number = 10): Promise<{ jobs: JobData[], total: number, totalPages: number }> {
        try {
            const jobs = await this.jobRepo.findAll(page, limit);
            const total = await this.jobRepo.getTotalCount();
            const totalPages = Math.ceil(total / limit);
            
            return { jobs, total, totalPages };
        } catch (error) {
            console.error('Error getting all jobs:', error);
            throw new Error('Failed to retrieve jobs');
        }
    }

    async updateJob(jobId: string, updateData: UpdateJobData): Promise<void> {
        try {
            // Check if job exists
            const existingJob = await this.jobRepo.findById(jobId);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            // Validate skill IDs if skills are being updated
            if (updateData.skills) {
                await this.validateSkillIds(updateData.skills.map(s => s.skillId));
            }

            // Create job instance to validate the update
            const job = Job.fromObject(existingJob);
            job.updateJob(updateData);

            // Update in database
            await this.jobRepo.update(jobId, updateData);
        } catch (error) {
            console.error('Error updating job:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to update job');
        }
    }

    async deleteJob(jobId: string): Promise<void> {
        try {
            // Check if job exists
            const existingJob = await this.jobRepo.findById(jobId);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            await this.jobRepo.delete(jobId);
        } catch (error) {
            console.error('Error deleting job:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to delete job');
        }
    }

    async searchJobs(criteria: JobSearchCriteria): Promise<{ jobs: JobData[], total: number, totalPages: number }> {
        try {
            // Initialize skill master repo
            await this.initSkillMasterRepo();
            
            // If searching by skill names, convert to skill IDs
            if (criteria.skillNames && criteria.skillNames.length > 0) {
                const skillIds = await this.skillMasterRepo!.findIdsByNames(criteria.skillNames);
                criteria.skillIds = [...(criteria.skillIds || []), ...skillIds];
                delete criteria.skillNames; // Remove skillNames from criteria
            }

            const jobs = await this.jobRepo.search(criteria);
            const total = await this.jobRepo.searchTotalCount(criteria);
            const limit = criteria.limit || 10;
            const totalPages = Math.ceil(total / limit);
            
            return { jobs, total, totalPages };
        } catch (error) {
            console.error('Error searching jobs:', error);
            throw new Error('Failed to search jobs');
        }
    }

    async getJobsBySkill(skillId: string): Promise<JobData[]> {
        try {
            // Initialize skill master repo
            await this.initSkillMasterRepo();
            
            // Validate skill exists
            const skill = await this.skillMasterRepo!.findById(skillId);
            if (!skill) {
                throw new Error('Skill not found');
            }

            const jobs = await this.jobRepo.findBySkillId(skillId);
            return jobs;
        } catch (error) {
            console.error('Error getting jobs by skill:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to retrieve jobs by skill');
        }
    }

    async getJobsBySkillName(skillName: string): Promise<JobData[]> {
        try {
            // Initialize skill master repo
            await this.initSkillMasterRepo();
            
            // Find skill by name first
            const skill = await this.skillMasterRepo!.findByName(skillName);
            if (!skill) {
                throw new Error('Skill not found');
            }

            return await this.getJobsBySkill(skill.skillId);
        } catch (error) {
            console.error('Error getting jobs by skill name:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to retrieve jobs by skill name');
        }
    }

    async addSkillToJob(jobId: string, skillId: string, requiredLevel: number, evidence?: string): Promise<void> {
        try {
            // Initialize skill master repo
            await this.initSkillMasterRepo();
            
            // Validate inputs
            if (requiredLevel < 0.0 || requiredLevel > 10.0) {
                throw new Error('Required level must be between 0.0 and 10.0');
            }

            // Check if job exists
            const existingJob = await this.jobRepo.findById(jobId);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            // Validate skill exists
            const skill = await this.skillMasterRepo!.findById(skillId);
            if (!skill) {
                throw new Error('Skill not found');
            }

            // Create job instance and add skill
            const job = Job.fromObject(existingJob);
            job.addSkill({ skillId, requiredLevel, evidence });

            // Update in database
            await this.jobRepo.update(jobId, { skills: job.skills });
        } catch (error) {
            console.error('Error adding skill to job:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to add skill to job');
        }
    }

    async removeSkillFromJob(jobId: string, skillId: string): Promise<void> {
        try {
            // Check if job exists
            const existingJob = await this.jobRepo.findById(jobId);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            // Create job instance and remove skill
            const job = Job.fromObject(existingJob);
            job.removeSkill(skillId);

            // Update in database
            await this.jobRepo.update(jobId, { skills: job.skills });
        } catch (error) {
            console.error('Error removing skill from job:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to remove skill from job');
        }
    }

    async getJobSummaries(page: number = 1, limit: number = 10): Promise<{ summaries: JobSummary[], total: number, totalPages: number }> {
        try {
            const jobs = await this.jobRepo.findAll(page, limit);
            const summaries = jobs.map(jobData => {
                const job = Job.fromObject(jobData);
                return job.toSummary();
            });
            
            const total = await this.jobRepo.getTotalCount();
            const totalPages = Math.ceil(total / limit);
            
            return { summaries, total, totalPages };
        } catch (error) {
            console.error('Error getting job summaries:', error);
            throw new Error('Failed to retrieve job summaries');
        }
    }

    private async validateSkillIds(skillIds: string[]): Promise<void> {
        await this.initSkillMasterRepo();
        
        for (const skillId of skillIds) {
            const skill = await this.skillMasterRepo!.findById(skillId);
            if (!skill) {
                throw new Error(`Skill with ID ${skillId} not found`);
            }
        }
    }
}
