import { Db } from 'mongodb';
import { BaseRepository } from './BaseRepository';
import { PersonalInfoData, ResumeData, InterviewData, CandidateStatus } from '../Models/Candidate';

/**
 * Repository for candidate personal information
 * This is where we keep all the basic personal tea safe and sound 
 */
export class PersonalInfoRepository extends BaseRepository<PersonalInfoData, Omit<PersonalInfoData, 'candidateId' | 'dateCreated' | 'dateUpdated'>, PersonalInfoData> {
    constructor(db: Db) {
        super(db, 'personalInfo');
    }

    async create(data: Omit<PersonalInfoData, 'candidateId' | 'dateCreated' | 'dateUpdated'>): Promise<PersonalInfoData> {
        const candidateId = this.generateId();
        const now = new Date();
        
        const personalInfo: PersonalInfoData = {
            candidateId,
            ...data,
            dateCreated: now,
            dateUpdated: now,
            isDeleted: false
        };

        await this.getCollection().insertOne(personalInfo);
        return personalInfo;
    }

    async findById(candidateId: string): Promise<PersonalInfoData | null> {
        const result = await this.getCollection().findOne({ candidateId });
        return result as PersonalInfoData | null;
    }

    async update(candidateId: string, data: Partial<PersonalInfoData>): Promise<void> {
        await this.getCollection().updateOne(
            { candidateId },
            { $set: { ...data, dateUpdated: new Date() } }
        );
    }

    async delete(candidateId: string): Promise<void> {
        await this.getCollection().updateOne(
            { candidateId },
            { $set: { isDeleted: true, dateUpdated: new Date() } }
        );
    }

    async findAll(): Promise<PersonalInfoData[]> {
        const results = await this.getCollection()
            .find({ isDeleted: { $ne: true } })
            .toArray();
        return results as unknown as PersonalInfoData[];
    }

    async findByStatus(status: CandidateStatus): Promise<PersonalInfoData[]> {
        const results = await this.getCollection()
            .find({ status, isDeleted: { $ne: true } })
            .toArray();
        return results as unknown as PersonalInfoData[];
    }

    async findByEmail(email: string): Promise<PersonalInfoData[]> {
        const results = await this.getCollection()
            .find({ email: { $in: [email] }, isDeleted: { $ne: true } })
            .toArray();
        return results as unknown as PersonalInfoData[];
    }
}

/**
 * Repository for candidate resume data
 * Where all the career flex and skills live their best life
 */
export class ResumeRepository extends BaseRepository<ResumeData, Omit<ResumeData, 'dateUpdated'>, ResumeData> {
    constructor(db: Db) {
        super(db, 'resume');
    }

    async create(data: Omit<ResumeData, 'dateUpdated'>): Promise<ResumeData> {
        const resumeData: ResumeData = {
            ...data,
            dateUpdated: new Date()
        };

        await this.getCollection().insertOne(resumeData);
        return resumeData;
    }

    async findById(candidateId: string): Promise<ResumeData | null> {
        const result = await this.getCollection().findOne({ candidateId });
        return result as ResumeData | null;
    }

    async update(candidateId: string, data: Partial<ResumeData>): Promise<void> {
        await this.getCollection().updateOne(
            { candidateId },
            { $set: { ...data, dateUpdated: new Date() } }
        );
    }

    async delete(candidateId: string): Promise<void> {
        await this.getCollection().deleteOne({ candidateId });
    }

    async findAll(): Promise<ResumeData[]> {
        const results = await this.getCollection().find({}).toArray();
        return results as unknown as ResumeData[];
    }

    async findBySkill(skillName: string): Promise<ResumeData[]> {
        const results = await this.getCollection()
            .find({ 'skills.skillName': { $regex: skillName, $options: 'i' } })
            .toArray();
        return results as unknown as ResumeData[];
    }
}

/**
 * Repository for candidate interview data
 * This is where all the interview tea and personality vibes get stored bestie
 */
export class InterviewRepository extends BaseRepository<InterviewData, Omit<InterviewData, 'dateUpdated'>, InterviewData> {
    constructor(db: Db) {
        super(db, 'interview');
    }

    async create(data: Omit<InterviewData, 'dateUpdated'>): Promise<InterviewData> {
        const interviewData: InterviewData = {
            ...data,
            dateUpdated: new Date()
        };

        await this.getCollection().insertOne(interviewData);
        return interviewData;
    }

    async findById(candidateId: string): Promise<InterviewData | null> {
        const result = await this.getCollection().findOne({ candidateId });
        return result as InterviewData | null;
    }

    async update(candidateId: string, data: Partial<InterviewData>): Promise<void> {
        await this.getCollection().updateOne(
            { candidateId },
            { $set: { ...data, dateUpdated: new Date() } }
        );
    }

    async delete(candidateId: string): Promise<void> {
        await this.getCollection().deleteOne({ candidateId });
    }

    async findAll(): Promise<InterviewData[]> {
        const results = await this.getCollection().find({}).toArray();
        return results as unknown as InterviewData[];
    }

    async findWithTranscripts(): Promise<InterviewData[]> {
        const results = await this.getCollection()
            .find({ transcripts: { $exists: true, $not: { $size: 0 } } })
            .toArray();
        return results as unknown as InterviewData[];
    }
}
