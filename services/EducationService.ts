import { connectDB } from '../mongo_db';
import { ResumeRepository } from '../repositories/CandidateRepository';
import { Education, CreateEducationData, EducationData } from '../Models/Education';
import { ObjectId } from 'mongodb';
export class EducationService {
    private resumeRepo: ResumeRepository;
    constructor() {
        this.resumeRepo = null as any;
    }
    async init(): Promise<void> {
        const db = await connectDB();
        this.resumeRepo = new ResumeRepository(db);
    }
    async addEducation(candidateId: string, educationData: CreateEducationData): Promise<void> {
        await this.init();
        try {
            // Validate education data
            this.validateEducationData(educationData);
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const educationId = new ObjectId().toString();
            const education = new Education(
                educationId,
                educationData.institution,
                educationData.startDate,
                educationData.endDate,
                educationData.description
            );
            const updatedEducation = [...resumeData.education.map(e => Education.fromObject(e)), education];
            await this.resumeRepo.update(candidateId, {
                education: updatedEducation.map(e => e.toObject())
            });
        } catch (error) {
            console.error('Error adding education:', error);
            throw new Error('Failed to add education');
        }
    }
    async updateEducation(candidateId: string, educationId: string, updatedEducation: Partial<EducationData>): Promise<void> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const educations = resumeData.education.map(e => Education.fromObject(e));
            const eduIndex = educations.findIndex(e => e.educationId === educationId);
            if (eduIndex === -1) {
                throw new Error('Education not found');
            }
            const edu = educations[eduIndex];
            if (updatedEducation.institution) edu.institution = updatedEducation.institution;
            if (updatedEducation.startDate) edu.startDate = updatedEducation.startDate;
            if (updatedEducation.endDate !== undefined) edu.endDate = updatedEducation.endDate;
            if (updatedEducation.description !== undefined) edu.description = updatedEducation.description;
            edu.updatedAt = new Date();
            await this.resumeRepo.update(candidateId, {
                education: educations.map(e => e.toObject())
            });
        } catch (error) {
            console.error('Error updating education:', error);
            throw new Error('Failed to update education');
        }
    }
    async deleteEducation(candidateId: string, educationId: string): Promise<void> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const educations = resumeData.education.map(e => Education.fromObject(e));
            const filteredEducations = educations.filter(e => e.educationId !== educationId);
            if (filteredEducations.length === educations.length) {
                throw new Error('Education not found');
            }
            await this.resumeRepo.update(candidateId, {
                education: filteredEducations.map(e => e.toObject())
            });
        } catch (error) {
            console.error('Error deleting education:', error);
            throw new Error('Failed to delete education');
        }
    }
    async getEducation(candidateId: string): Promise<Education[]> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                return [];
            }
            return resumeData.education.map(e => Education.fromObject(e));
        } catch (error) {
            console.error('Error getting education:', error);
            throw new Error('Failed to retrieve education');
        }
    }
    async getOngoingEducation(candidateId: string): Promise<Education[]> {
        await this.init();
        try {
            const educations = await this.getEducation(candidateId);
            return educations.filter(edu => edu.isOngoing());
        } catch (error) {
            console.error('Error getting ongoing education:', error);
            throw new Error('Failed to retrieve ongoing education');
        }
    }
    async getHighestEducation(candidateId: string): Promise<Education | null> {
        await this.init();
        try {
            const educations = await this.getEducation(candidateId);
            if (educations.length === 0) return null;
            // Return the most recent education based on start date
            return educations.reduce((latest, current) => {
                return current.startDate > latest.startDate ? current : latest;
            });
        } catch (error) {
            console.error('Error getting latest education:', error);
            throw new Error('Failed to retrieve latest education');
        }
    }
    // Private helper methods
    private validateEducationData(data: CreateEducationData): void {
        if (!data.institution.trim()) {
            throw new Error('Institution name is required');
        }
        if (data.startDate > new Date()) {
            throw new Error('Start date cannot be in the future');
        }
        if (data.endDate && data.endDate < data.startDate) {
            throw new Error('End date cannot be before start date');
        }
    }
}
