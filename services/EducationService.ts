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
    async addEducation(candidateId: string, educationData: any): Promise<void> {
        await this.init();
        try {
            // Validate education data
            this.validateEducationData(educationData);
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const educationId = new ObjectId().toString();
            const addedBy = educationData.addedBy || 'AI';
            const education = new Education(
                educationId,
                educationData.institution,
                educationData.startDate,
                educationData.endDate,
                educationData.description,
                addedBy
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
    async updateEducation(candidateId: string, educationId: string, updatedEducation: any): Promise<void> {
        await this.init();
        try {
            // Use atomic MongoDB update with positional operator to avoid race conditions
            const db = await connectDB();
            const updateFields: any = {};
            
            if (updatedEducation.institution !== undefined) {
                updateFields['education.$.institution'] = updatedEducation.institution;
            }
            if (updatedEducation.degree !== undefined) {
                updateFields['education.$.degree'] = updatedEducation.degree;
            }
            if (updatedEducation.fieldOfStudy !== undefined) {
                updateFields['education.$.fieldOfStudy'] = updatedEducation.fieldOfStudy;
            }
            if (updatedEducation.startDate !== undefined) {
                updateFields['education.$.startDate'] = updatedEducation.startDate;
            }
            if (updatedEducation.endDate !== undefined) {
                updateFields['education.$.endDate'] = updatedEducation.endDate;
            }
            if (updatedEducation.description !== undefined) {
                updateFields['education.$.description'] = updatedEducation.description;
            }
            if (updatedEducation.addedBy !== undefined) {
                updateFields['education.$.addedBy'] = updatedEducation.addedBy;
            }
            
            updateFields['education.$.updatedAt'] = new Date();
            updateFields['dateUpdated'] = new Date();
            
            const result = await db.collection('resume').updateOne(
                { 
                    candidateId,
                    'education.educationId': educationId
                },
                { $set: updateFields }
            );
            
            if (result.matchedCount === 0) {
                throw new Error('Education not found');
            }
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
            const educationToDelete = educations.find(e => e.educationId === educationId);
            
            if (!educationToDelete) {
                throw new Error('Education not found');
            }

            // Soft delete by setting isDeleted to true
            educationToDelete.isDeleted = true;
            educationToDelete.updatedAt = new Date();

            await this.resumeRepo.update(candidateId, {
                education: educations.map(e => e.toObject())
            });
        } catch (error) {
            console.error('Error soft deleting education:', error);
            throw new Error('Failed to delete education');
        }
    }

    // Method to restore a soft deleted education
    async restoreEducation(candidateId: string, educationId: string): Promise<void> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const educations = resumeData.education.map(e => Education.fromObject(e));
            const educationToRestore = educations.find(e => e.educationId === educationId);
            
            if (!educationToRestore) {
                throw new Error('Education not found');
            }

            // Restore by setting isDeleted to false
            educationToRestore.isDeleted = false;
            educationToRestore.updatedAt = new Date();

            await this.resumeRepo.update(candidateId, {
                education: educations.map(e => e.toObject())
            });
        } catch (error) {
            console.error('Error restoring education:', error);
            throw new Error('Failed to restore education');
        }
    }

    // Method to hard delete (permanently remove) an education
    async hardDeleteEducation(candidateId: string, educationId: string): Promise<void> {
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
            console.error('Error hard deleting education:', error);
            throw new Error('Failed to permanently delete education');
        }
    }
    async getEducation(candidateId: string, includeDeleted: boolean = false): Promise<Education[]> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                return [];
            }
            const educations = resumeData.education.map(e => Education.fromObject(e));
            
            // Filter out soft deleted items by default
            if (!includeDeleted) {
                return educations.filter(e => !e.isDeleted);
            }
            
            return educations;
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
