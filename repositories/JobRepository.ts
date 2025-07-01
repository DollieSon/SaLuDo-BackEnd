import { Job, JobData, JobSearchCriteria, CreateJobData, UpdateJobData } from '../Models/Job';
import { JobWithSkillNames, JobSkillWithMaster } from '../Models/JobTypes';
import { connectDB } from '../mongo_db';
import { Collection, Db, ObjectId } from 'mongodb';

export class JobRepository {
    protected collectionName = 'jobs';
    private db: Db | null = null;
    private collection: Collection<JobData> | null = null;

    async init(): Promise<void> {
        if (!this.db) {
            this.db = await connectDB();
            this.collection = this.db.collection<JobData>(this.collectionName);
            
            // Create indexes for better performance
            await this.createIndexes();
        }
    }

    private async createIndexes(): Promise<void> {
        if (!this.collection) return;

        try {
            // Index on jobName for text search
            await this.collection.createIndex({ jobName: 'text', jobDescription: 'text' });
            
            // Index on skills.skillId for skill-based queries
            await this.collection.createIndex({ 'skills.skillId': 1 });
            
            // Index on createdAt for sorting
            await this.collection.createIndex({ createdAt: -1 });
            
            console.log('Job indexes created successfully');
        } catch (error) {
            console.error('Error creating job indexes:', error);
        }
    }

    async create(jobData: JobData): Promise<JobData> {
        await this.init();
        
        try {
            const result = await this.collection!.insertOne(jobData);
            return {
                ...jobData,
                _id: result.insertedId.toString()
            };
        } catch (error) {
            console.error('Error creating job:', error);
            throw new Error('Failed to create job');
        }
    }

    async findById(jobId: string): Promise<JobData | null> {
        await this.init();
        
        try {
            const result = await this.collection!.findOne({ _id: new ObjectId(jobId) } as any);
            if (result) {
                return {
                    ...result,
                    _id: result._id.toString()
                };
            }
            return null;
        } catch (error) {
            console.error('Error finding job by ID:', error);
            throw new Error('Failed to find job');
        }
    }

    async findAll(page: number = 1, limit: number = 10): Promise<JobData[]> {
        await this.init();
        
        try {
            const skip = (page - 1) * limit;
            const results = await this.collection!
                .find({})
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray();
            
            return results.map(job => ({
                ...job,
                _id: job._id.toString()
            }));
        } catch (error) {
            console.error('Error finding all jobs:', error);
            throw new Error('Failed to retrieve jobs');
        }
    }

    async update(jobId: string, updateData: Partial<JobData>): Promise<void> {
        await this.init();
        
        try {
            const result = await this.collection!.updateOne(
                { _id: new ObjectId(jobId) } as any,
                { 
                    $set: { 
                        ...updateData, 
                        updatedAt: new Date() 
                    } 
                }
            );
            
            if (result.matchedCount === 0) {
                throw new Error('Job not found');
            }
        } catch (error) {
            console.error('Error updating job:', error);
            throw new Error('Failed to update job');
        }
    }

    async delete(jobId: string): Promise<void> {
        await this.init();
        
        try {
            const result = await this.collection!.deleteOne({ _id: new ObjectId(jobId) } as any);
            
            if (result.deletedCount === 0) {
                throw new Error('Job not found');
            }
        } catch (error) {
            console.error('Error deleting job:', error);
            throw new Error('Failed to delete job');
        }
    }

    async search(criteria: JobSearchCriteria): Promise<JobData[]> {
        await this.init();
        
        try {
            const query: any = {};
            
            // Search by job name (text search)
            if (criteria.jobName) {
                query.$text = { $search: criteria.jobName };
            }
            
            // Search by skill IDs
            if (criteria.skillIds && criteria.skillIds.length > 0) {
                query['skills.skillId'] = { $in: criteria.skillIds };
            }
            
            const page = criteria.page || 1;
            const limit = criteria.limit || 10;
            const skip = (page - 1) * limit;
            
            const results = await this.collection!
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray();
            
            return results.map(job => ({
                ...job,
                _id: job._id.toString()
            }));
        } catch (error) {
            console.error('Error searching jobs:', error);
            throw new Error('Failed to search jobs');
        }
    }

    async findBySkillId(skillId: string): Promise<JobData[]> {
        await this.init();
        
        try {
            const results = await this.collection!
                .find({ 'skills.skillId': skillId })
                .sort({ createdAt: -1 })
                .toArray();
            
            return results.map(job => ({
                ...job,
                _id: job._id.toString()
            }));
        } catch (error) {
            console.error('Error finding jobs by skill ID:', error);
            throw new Error('Failed to find jobs by skill');
        }
    }

    async findWithSkillNames(jobId: string): Promise<JobWithSkillNames | null> {
        await this.init();
        
        try {
            const pipeline = [
                { $match: { _id: new ObjectId(jobId) } },
                {
                    $lookup: {
                        from: 'skillsmaster',
                        localField: 'skills.skillId',
                        foreignField: 'skillId',
                        as: 'skillMasterData'
                    }
                },
                {
                    $addFields: {
                        skills: {
                            $map: {
                                input: '$skills',
                                as: 'skill',
                                in: {
                                    $mergeObjects: [
                                        '$$skill',
                                        {
                                            skillName: {
                                                $let: {
                                                    vars: {
                                                        master: {
                                                            $arrayElemAt: [
                                                                {
                                                                    $filter: {
                                                                        input: '$skillMasterData',
                                                                        cond: { $eq: ['$$this.skillId', '$$skill.skillId'] }
                                                                    }
                                                                },
                                                                0
                                                            ]
                                                        }
                                                    },
                                                    in: '$$master.skillName'
                                                }
                                            },
                                            isAccepted: {
                                                $let: {
                                                    vars: {
                                                        master: {
                                                            $arrayElemAt: [
                                                                {
                                                                    $filter: {
                                                                        input: '$skillMasterData',
                                                                        cond: { $eq: ['$$this.skillId', '$$skill.skillId'] }
                                                                    }
                                                                },
                                                                0
                                                            ]
                                                        }
                                                    },
                                                    in: '$$master.isAccepted'
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                },
                { $project: { skillMasterData: 0 } }
            ];
            
            const results = await this.collection!.aggregate(pipeline).toArray();
            if (results.length > 0) {
                const result = results[0] as any;
                return {
                    ...result,
                    _id: result._id.toString()
                } as JobWithSkillNames;
            }
            return null;
        } catch (error) {
            console.error('Error finding job with skill names:', error);
            throw new Error('Failed to find job with skill details');
        }
    }

    async getTotalCount(): Promise<number> {
        await this.init();
        
        try {
            return await this.collection!.countDocuments();
        } catch (error) {
            console.error('Error getting total job count:', error);
            throw new Error('Failed to get job count');
        }
    }

    async searchTotalCount(criteria: JobSearchCriteria): Promise<number> {
        await this.init();
        
        try {
            const query: any = {};
            
            if (criteria.jobName) {
                query.$text = { $search: criteria.jobName };
            }
            
            if (criteria.skillIds && criteria.skillIds.length > 0) {
                query['skills.skillId'] = { $in: criteria.skillIds };
            }
            
            return await this.collection!.countDocuments(query);
        } catch (error) {
            console.error('Error getting search count:', error);
            throw new Error('Failed to get search count');
        }
    }
}
