import { connectDB } from '../mongo_db';
import { ResumeRepository } from '../repositories/CandidateRepository';
import { Experience, CreateExperienceData, ExperienceData } from '../Models/Experience';
import { ObjectId } from 'mongodb';
export class ExperienceService {
    private resumeRepo: ResumeRepository;
    constructor() {
        this.resumeRepo = null as any;
    }
    async init(): Promise<void> {
        const db = await connectDB();
        this.resumeRepo = new ResumeRepository(db);
    }
    async addExperience(candidateId: string, experienceData: any): Promise<void> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const experienceId = new ObjectId().toString();
            const addedBy = experienceData.addedBy || 'AI';
            
            const experience = new Experience(
                experienceId,
                experienceData.title,
                experienceData.role,
                experienceData.description,
                addedBy
            );
            const updatedExperience = [...resumeData.experience.map(e => Experience.fromObject(e)), experience];
            await this.resumeRepo.update(candidateId, {
                experience: updatedExperience.map(e => e.toObject())
            });
        } catch (error) {
            console.error('Error adding experience:', error);
            throw new Error('Failed to add experience');
        }
    }
    async updateExperience(candidateId: string, experienceId: string, updatedExperience: any): Promise<void> {
        await this.init();
        try {
            // Use atomic MongoDB update with positional operator to avoid race conditions
            const db = await connectDB();
            const updateFields: any = {};
            
            if (updatedExperience.title !== undefined) {
                updateFields['experience.$.title'] = updatedExperience.title;
            }
            if (updatedExperience.role !== undefined) {
                updateFields['experience.$.role'] = updatedExperience.role;
            }
            if (updatedExperience.description !== undefined) {
                updateFields['experience.$.description'] = updatedExperience.description;
            }
            if (updatedExperience.addedBy !== undefined) {
                updateFields['experience.$.addedBy'] = updatedExperience.addedBy;
            }
            if (updatedExperience.company !== undefined) {
                updateFields['experience.$.company'] = updatedExperience.company;
            }
            if (updatedExperience.startDate !== undefined) {
                updateFields['experience.$.startDate'] = updatedExperience.startDate;
            }
            if (updatedExperience.endDate !== undefined) {
                updateFields['experience.$.endDate'] = updatedExperience.endDate;
            }
            if (updatedExperience.isCurrent !== undefined) {
                updateFields['experience.$.isCurrent'] = updatedExperience.isCurrent;
            }
            
            updateFields['experience.$.updatedAt'] = new Date();
            updateFields['dateUpdated'] = new Date();
            
            const result = await db.collection('resume').updateOne(
                { 
                    candidateId,
                    'experience.experienceId': experienceId
                },
                { $set: updateFields }
            );
            
            if (result.matchedCount === 0) {
                throw new Error('Experience not found');
            }
        } catch (error) {
            console.error('Error updating experience:', error);
            throw new Error('Failed to update experience');
        }
    }
    async deleteExperience(candidateId: string, experienceId: string): Promise<void> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const experiences = resumeData.experience.map(e => Experience.fromObject(e));
            const experienceToDelete = experiences.find(e => e.experienceId === experienceId);
            
            if (!experienceToDelete) {
                throw new Error('Experience not found');
            }

            // Soft delete by setting isDeleted to true
            experienceToDelete.isDeleted = true;
            experienceToDelete.updatedAt = new Date();

            await this.resumeRepo.update(candidateId, {
                experience: experiences.map(e => e.toObject())
            });
        } catch (error) {
            console.error('Error soft deleting experience:', error);
            throw new Error('Failed to delete experience');
        }
    }

    // Method to restore a soft deleted experience
    async restoreExperience(candidateId: string, experienceId: string): Promise<void> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const experiences = resumeData.experience.map(e => Experience.fromObject(e));
            const experienceToRestore = experiences.find(e => e.experienceId === experienceId);
            
            if (!experienceToRestore) {
                throw new Error('Experience not found');
            }

            // Restore by setting isDeleted to false
            experienceToRestore.isDeleted = false;
            experienceToRestore.updatedAt = new Date();

            await this.resumeRepo.update(candidateId, {
                experience: experiences.map(e => e.toObject())
            });
        } catch (error) {
            console.error('Error restoring experience:', error);
            throw new Error('Failed to restore experience');
        }
    }

    // Method to hard delete (permanently remove) an experience
    async hardDeleteExperience(candidateId: string, experienceId: string): Promise<void> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const experiences = resumeData.experience.map(e => Experience.fromObject(e));
            const filteredExperiences = experiences.filter(e => e.experienceId !== experienceId);
            
            if (filteredExperiences.length === experiences.length) {
                throw new Error('Experience not found');
            }

            await this.resumeRepo.update(candidateId, {
                experience: filteredExperiences.map(e => e.toObject())
            });
        } catch (error) {
            console.error('Error hard deleting experience:', error);
            throw new Error('Failed to permanently delete experience');
        }
    }
    async getExperience(candidateId: string, includeDeleted: boolean = false): Promise<Experience[]> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                return [];
            }
            const experiences = resumeData.experience.map(e => Experience.fromObject(e));
            
            // Filter out soft deleted items by default
            if (!includeDeleted) {
                return experiences.filter(e => !e.isDeleted);
            }
            
            return experiences;
        } catch (error) {
            console.error('Error getting experience:', error);
            throw new Error('Failed to retrieve experience');
        }
    }
    async getExperienceWithDescriptions(candidateId: string): Promise<Experience[]> {
        await this.init();
        try {
            const experiences = await this.getExperience(candidateId);
            return experiences.filter(exp => exp.hasDescription());
        } catch (error) {
            console.error('Error getting experience with descriptions:', error);
            throw new Error('Failed to retrieve experience with descriptions');
        }
    }
    async getTotalExperienceYears(candidateId: string): Promise<number> {
        await this.init();
        try {
            const experiences = await this.getExperience(candidateId);
            // This is a simplified calculation - in reality you'd want to parse dates
            // from the experience descriptions or add start/end dates to the Experience model
            return experiences.length * 2; // Assuming 2 years per experience on average
        } catch (error) {
            console.error('Error calculating total experience:', error);
            throw new Error('Failed to calculate total experience');
        }
    }
}
