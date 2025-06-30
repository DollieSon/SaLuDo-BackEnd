import { connectDB } from '../mongo_db';
import { ResumeRepository } from '../repositories/CandidateRepository';
import { Experience, CreateExperienceData, ExperienceData } from '../Models/Experience';
import { ObjectId } from 'mongodb';

/**
 * Service class for experience management
 */
export class ExperienceService {
    private resumeRepo: ResumeRepository;

    constructor() {
        this.resumeRepo = null as any;
    }

    /**
     * Initialize the service with database connection
     */
    async init(): Promise<void> {
        const db = await connectDB();
        this.resumeRepo = new ResumeRepository(db);
    }

    /**
     * Adds experience to a candidate
     */
    async addExperience(candidateId: string, experienceData: CreateExperienceData): Promise<void> {
        await this.init();

        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }

            const experienceId = new ObjectId().toString();
            const experience = new Experience(
                experienceId,
                experienceData.title,
                experienceData.role,
                experienceData.description
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

    /**
     * Updates specific experience
     */
    async updateExperience(candidateId: string, experienceId: string, updatedExperience: Partial<ExperienceData>): Promise<void> {
        await this.init();

        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }

            const experiences = resumeData.experience.map(e => Experience.fromObject(e));
            const expIndex = experiences.findIndex(e => e.experienceId === experienceId);
            
            if (expIndex === -1) {
                throw new Error('Experience not found');
            }

            const exp = experiences[expIndex];
            if (updatedExperience.title) exp.title = updatedExperience.title;
            if (updatedExperience.role) exp.role = updatedExperience.role;
            if (updatedExperience.description !== undefined) exp.description = updatedExperience.description;
            exp.updatedAt = new Date();

            await this.resumeRepo.update(candidateId, {
                experience: experiences.map(e => e.toObject())
            });
        } catch (error) {
            console.error('Error updating experience:', error);
            throw new Error('Failed to update experience');
        }
    }

    /**
     * Deletes specific experience
     */
    async deleteExperience(candidateId: string, experienceId: string): Promise<void> {
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
            console.error('Error deleting experience:', error);
            throw new Error('Failed to delete experience');
        }
    }

    /**
     * Gets all experience for a candidate
     */
    async getExperience(candidateId: string): Promise<Experience[]> {
        await this.init();

        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                return [];
            }

            return resumeData.experience.map(e => Experience.fromObject(e));
        } catch (error) {
            console.error('Error getting experience:', error);
            throw new Error('Failed to retrieve experience');
        }
    }

    /**
     * Gets experience with descriptions
     */
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

    /**
     * Calculates total years of experience for a candidate
     */
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
