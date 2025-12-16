import { Job, JobData, CreateJobData, UpdateJobData, JobSearchCriteria, JobSummary } from '../Models/Job';
import { JobWithSkillNames, JobSkillRequirement } from '../Models/JobTypes';
import { JobRepository } from '../repositories/JobRepository';
import { SkillMasterRepository } from '../repositories/SkillMasterRepository';
import { connectDB } from '../mongo_db';
import { ObjectId } from 'mongodb';
import { AuditLogger } from '../utils/AuditLogger';
import { AuditEventType } from '../types/AuditEventTypes';
import { NotificationService } from './NotificationService';
import { NotificationType } from '../Models/enums/NotificationTypes';
import { getAllHRUsers } from '../utils/NotificationHelpers';

export class JobService {
    private jobRepo: JobRepository;
    private skillMasterRepo: SkillMasterRepository | null = null;
    private notificationService: NotificationService | null = null;

    constructor() {
        this.jobRepo = new JobRepository();
    }

    private async initSkillMasterRepo(): Promise<void> {
        if (!this.skillMasterRepo) {
            const db = await connectDB();
            this.skillMasterRepo = new SkillMasterRepository(db);
        }
    }

    private async initNotificationService(): Promise<void> {
        if (!this.notificationService) {
            const db = await connectDB();
            const { NotificationRepository } = await import('../repositories/NotificationRepository');
            const { NotificationPreferencesRepository } = await import('../repositories/NotificationPreferencesRepository');
            const { WebhookRepository } = await import('../repositories/WebhookRepository');
            
            const notificationRepo = new NotificationRepository(db.collection('notifications'));
            const preferencesRepo = new NotificationPreferencesRepository(db.collection('notificationPreferences'));
            const webhookRepo = new WebhookRepository(db.collection('webhooks'));
            this.notificationService = new NotificationService(notificationRepo, preferencesRepo, webhookRepo);
        }
    }

    async createJob(jobData: CreateJobData, userId?: string, userEmail?: string): Promise<JobData> {
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
            
            // Log audit event
            await AuditLogger.logJobOperation({
                eventType: AuditEventType.JOB_CREATED,
                jobId: savedJob._id || 'unknown',
                jobTitle: savedJob.jobName,
                userId,
                userEmail,
                action: `Created new job: ${savedJob.jobName}`,
                newValue: {
                    jobName: savedJob.jobName,
                    jobDescription: savedJob.jobDescription,
                    skills: savedJob.skills
                },
                metadata: {
                    skillCount: savedJob.skills?.length || 0
                }
            });

            // Notify all HR users about new job posting
            await this.initNotificationService();
            if (this.notificationService) {
                try {
                    const hrUsers = await getAllHRUsers();
                    for (const hrUser of hrUsers) {
                        await this.notificationService.notifyJobEvent(
                            NotificationType.JOB_POSTED,
                            hrUser.userId,
                            savedJob._id || 'unknown',
                            savedJob.jobName,
                            {
                                skillCount: savedJob.skills?.length || 0,
                                description: savedJob.jobDescription.substring(0, 200)
                            }
                        );
                    }
                } catch (notifError) {
                    console.error('Failed to send JOB_POSTED notification:', notifError);
                }
            }
            
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

    async updateJob(jobId: string, updateData: UpdateJobData, userId?: string, userEmail?: string): Promise<void> {
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

            // Track changes for audit
            const changes: Record<string, any> = {};
            if (updateData.jobName) changes.jobName = updateData.jobName;
            if (updateData.jobDescription) changes.jobDescription = updateData.jobDescription;
            if (updateData.skills) changes.skills = updateData.skills;

            // Update in database
            await this.jobRepo.update(jobId, updateData);
            
            // Log general update audit
            if (Object.keys(changes).length > 0) {
                await AuditLogger.logJobOperation({
                    eventType: AuditEventType.JOB_UPDATED,
                    jobId,
                    jobTitle: existingJob.jobName,
                    userId,
                    userEmail,
                    action: `Updated job: ${existingJob.jobName}`,
                    newValue: changes
                });

                // Notify all HR users about job update
                await this.initNotificationService();
                if (this.notificationService) {
                    try {
                        const hrUsers = await getAllHRUsers();
                        for (const hrUser of hrUsers) {
                            await this.notificationService.notifyJobEvent(
                                NotificationType.JOB_UPDATED,
                                hrUser.userId,
                                jobId,
                                updateData.jobName || existingJob.jobName,
                                {
                                    updatedFields: Object.keys(changes),
                                    skillCount: updateData.skills?.length || existingJob.skills?.length || 0
                                }
                            );
                        }
                    } catch (notifError) {
                        console.error('Failed to send JOB_UPDATED notification:', notifError);
                    }
                }
            }
        } catch (error) {
            console.error('Error updating job:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to update job');
        }
    }

    async deleteJob(jobId: string, userId?: string, userEmail?: string): Promise<void> {
        try {
            // Check if job exists
            const existingJob = await this.jobRepo.findById(jobId);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            await this.jobRepo.delete(jobId);
            
            // Log audit event
            await AuditLogger.logJobOperation({
                eventType: AuditEventType.JOB_DELETED,
                jobId,
                jobTitle: existingJob.jobName,
                userId,
                userEmail,
                action: `Deleted job: ${existingJob.jobName}`,
                oldValue: {
                    jobName: existingJob.jobName,
                    jobDescription: existingJob.jobDescription
                }
            });

            // Notify all HR users that job is closed/deleted
            await this.initNotificationService();
            if (this.notificationService) {
                try {
                    const hrUsers = await getAllHRUsers();
                    for (const hrUser of hrUsers) {
                        await this.notificationService.notifyJobEvent(
                            NotificationType.JOB_CLOSED,
                            hrUser.userId,
                            jobId,
                            existingJob.jobName,
                            {
                                closedBy: userId,
                                skillCount: existingJob.skills?.length || 0
                            }
                        );
                    }
                } catch (notifError) {
                    console.error('Failed to send JOB_CLOSED notification:', notifError);
                }
            }
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

    async addSkillToJob(jobId: string, skillId: string, requiredLevel: number, evidence?: string, addedBy?: string): Promise<void> {
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

            // Check for duplicate skill using atomic operation to prevent race conditions
            const db = await connectDB();
            const result = await db.collection('jobs').updateOne(
                { 
                    _id: new ObjectId(jobId),
                    'skills.skillId': { $ne: skillId } // Only update if skill doesn't exist
                },
                { 
                    $push: { 
                        skills: {
                            skillId,
                            requiredLevel,
                            evidence,
                            addedBy: addedBy || 'HUMAN',
                            addedAt: new Date()
                        }
                    } as any
                }
            );

            if (result.matchedCount === 0) {
                // Either job not found or skill already exists
                const jobCheck = await db.collection('jobs').findOne({ _id: new ObjectId(jobId) } as any);
                if (!jobCheck) {
                    throw new Error('Job not found');
                }
                throw new Error('Skill already exists in this job. Use update instead.');
            }
        } catch (error) {
            console.error('Error adding skill to job:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to add skill to job');
        }
    }

    async addSkillsToJob(jobId: string, skillRequirements: JobSkillRequirement[], addedBy?: string): Promise<void> {
        try {
            // Initialize skill master repo
            await this.initSkillMasterRepo();
            
            // Validate inputs
            if (!Array.isArray(skillRequirements) || skillRequirements.length === 0) {
                throw new Error('Skills array is required and must contain at least one skill');
            }

            // Check if job exists
            const existingJob = await this.jobRepo.findById(jobId);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            // Validate all skills first before adding any
            const validatedSkills: JobSkillRequirement[] = [];
            
            for (const skillReq of skillRequirements) {
                // Validate required level
                if (skillReq.requiredLevel < 0.0 || skillReq.requiredLevel > 10.0) {
                    throw new Error(`Required level must be between 0.0 and 10.0 for skill: ${skillReq.skillId}`);
                }

                // Validate skill exists in SkillMaster
                const skill = await this.skillMasterRepo!.findById(skillReq.skillId);
                if (!skill) {
                    throw new Error(`Skill not found in master database: ${skillReq.skillId}`);
                }

                validatedSkills.push({
                    skillId: skillReq.skillId,
                    requiredLevel: skillReq.requiredLevel,
                    evidence: skillReq.evidence
                });
            }

            // Create job instance and add all skills
            const job = Job.fromObject(existingJob);
            
            // Add each validated skill to the job
            for (const skillData of validatedSkills) {
                job.addSkill({
                    skillId: skillData.skillId,
                    requiredLevel: skillData.requiredLevel,
                    evidence: skillData.evidence
                }, addedBy);
            }

            // Update in database with all skills at once
            await this.jobRepo.update(jobId, { skills: job.skills });
            
        } catch (error) {
            console.error('Error adding skills to job:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to add skills to job');
        }
    }

    // Helper method to add skills by skillName instead of skillId
    // Uses SkillMaster's getOrCreate to automatically create missing skills
    async addSkillsToJobByName(jobId: string, skillRequirements: Array<{skillName: string, requiredLevel: number, evidence?: string}>, addedBy?: string): Promise<void> {
        try {
            // Initialize skill master repo
            await this.initSkillMasterRepo();
            
            // Validate inputs
            if (!Array.isArray(skillRequirements) || skillRequirements.length === 0) {
                throw new Error('Skills array is required and must contain at least one skill');
            }

            // Check if job exists
            const existingJob = await this.jobRepo.findById(jobId);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            // Convert skillNames to skillIds using getOrCreate
            const skillRequirementsWithIds: JobSkillRequirement[] = [];
            
            for (const skillReq of skillRequirements) {
                // Validate required level
                if (skillReq.requiredLevel < 0.0 || skillReq.requiredLevel > 10.0) {
                    throw new Error(`Required level must be between 0.0 and 10.0 for skill: ${skillReq.skillName}`);
                }

                // Get or create the skill in SkillMaster
                const skillMaster = await this.skillMasterRepo!.getOrCreate(skillReq.skillName);
                
                skillRequirementsWithIds.push({
                    skillId: skillMaster.skillId,
                    requiredLevel: skillReq.requiredLevel,
                    evidence: skillReq.evidence
                });
            }

            // Use the existing addSkillsToJob method with the converted skill IDs
            await this.addSkillsToJob(jobId, skillRequirementsWithIds, addedBy);
            
        } catch (error) {
            console.error('Error adding skills to job by name:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to add skills to job by name');
        }
    }

    async removeSkillFromJob(jobId: string, skillId: string): Promise<void> {
        try {
            // Check if job exists
            const existingJob = await this.jobRepo.findById(jobId);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            // Create job instance and soft delete skill
            const job = Job.fromObject(existingJob);
            job.softDeleteSkill(skillId);

            // Update in database
            await this.jobRepo.update(jobId, { skills: job.skills });
        } catch (error) {
            console.error('Error soft deleting skill from job:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to remove skill from job');
        }
    }

    // Method to restore a soft deleted job skill
    async restoreSkillToJob(jobId: string, skillId: string): Promise<void> {
        try {
            // Check if job exists
            const existingJob = await this.jobRepo.findById(jobId);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            // Create job instance and restore skill
            const job = Job.fromObject(existingJob);
            job.restoreSkill(skillId);

            // Update in database
            await this.jobRepo.update(jobId, { skills: job.skills });
        } catch (error) {
            console.error('Error restoring skill to job:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to restore skill to job');
        }
    }

    // Method to hard delete (permanently remove) a job skill
    async hardRemoveSkillFromJob(jobId: string, skillId: string): Promise<void> {
        try {
            // Check if job exists
            const existingJob = await this.jobRepo.findById(jobId);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            // Create job instance and hard remove skill
            const job = Job.fromObject(existingJob);
            job.removeSkill(skillId);

            // Update in database
            await this.jobRepo.update(jobId, { skills: job.skills });
        } catch (error) {
            console.error('Error hard removing skill from job:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to permanently remove skill from job');
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

    // Method to get active (non-deleted) skills for a job
    async getJobActiveSkills(jobId: string): Promise<JobSkillRequirement[]> {
        try {
            const existingJob = await this.jobRepo.findById(jobId);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            const job = Job.fromObject(existingJob);
            return job.getActiveSkills();
        } catch (error) {
            console.error('Error getting active job skills:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to retrieve active job skills');
        }
    }
}
