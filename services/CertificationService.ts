import { connectDB } from '../mongo_db';
import { ResumeRepository } from '../repositories/CandidateRepository';
import { Certification, CreateCertificationData, CertificationData } from '../Models/Certification';
import { ObjectId } from 'mongodb';

/**
 * Service class that's absolutely serving certification management energy 🏆
 * This bad boy handles all the credential flex and certificate vibes
 * Like bestie, your professional badges are about to be managed to perfection fr fr ✨
 */
export class CertificationService {
    private resumeRepo: ResumeRepository;

    constructor() {
        this.resumeRepo = null as any;
    }

    /**
     * Initialize the service with database connection
     * Connecting to the certification database like we're accessing the achievement vault 🏅⚡
     */
    async init(): Promise<void> {
        const db = await connectDB();
        this.resumeRepo = new ResumeRepository(db);
    }

    /**
     * Adds certification to a candidate
     * Blessing this candidate with some certified excellence vibes 🎯🏆
     */
    async addCertification(candidateId: string, certificationData: CreateCertificationData): Promise<void> {
        await this.init();

        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }

            const certificationId = new ObjectId().toString();
            const certification = new Certification(
                certificationId,
                certificationData.name,
                certificationData.issuingOrganization,
                certificationData.issueDate,
                certificationData.description
            );

            const updatedCertifications = [...resumeData.certification.map(c => Certification.fromObject(c)), certification];
            
            await this.resumeRepo.update(candidateId, {
                certification: updatedCertifications.map(c => c.toObject())
            });
        } catch (error) {
            console.error('Error adding certification:', error);
            throw new Error('Failed to add certification');
        }
    }

    /**
     * Updates specific certification
     */
    async updateCertification(candidateId: string, certificationId: string, updatedCertification: Partial<CertificationData>): Promise<void> {
        await this.init();

        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }

            const certifications = resumeData.certification.map(c => Certification.fromObject(c));
            const certIndex = certifications.findIndex(c => c.certificationId === certificationId);
            
            if (certIndex === -1) {
                throw new Error('Certification not found');
            }

            const cert = certifications[certIndex];
            if (updatedCertification.name) cert.name = updatedCertification.name;
            if (updatedCertification.issuingOrganization) cert.issuingOrganization = updatedCertification.issuingOrganization;
            if (updatedCertification.issueDate) cert.issueDate = updatedCertification.issueDate;
            if (updatedCertification.description !== undefined) cert.description = updatedCertification.description;
            cert.updatedAt = new Date();

            await this.resumeRepo.update(candidateId, {
                certification: certifications.map(c => c.toObject())
            });
        } catch (error) {
            console.error('Error updating certification:', error);
            throw new Error('Failed to update certification');
        }
    }

    /**
     * Deletes specific certification
     */
    async deleteCertification(candidateId: string, certificationId: string): Promise<void> {
        await this.init();

        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }

            const certifications = resumeData.certification.map(c => Certification.fromObject(c));
            const filteredCertifications = certifications.filter(c => c.certificationId !== certificationId);

            if (filteredCertifications.length === certifications.length) {
                throw new Error('Certification not found');
            }

            await this.resumeRepo.update(candidateId, {
                certification: filteredCertifications.map(c => c.toObject())
            });
        } catch (error) {
            console.error('Error deleting certification:', error);
            throw new Error('Failed to delete certification');
        }
    }

    /**
     * Gets all certifications for a candidate
     */
    async getCertifications(candidateId: string): Promise<Certification[]> {
        await this.init();

        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                return [];
            }

            return resumeData.certification.map(c => Certification.fromObject(c));
        } catch (error) {
            console.error('Error getting certifications:', error);
            throw new Error('Failed to retrieve certifications');
        }
    }





    /**
     * Gets certifications by issuing organization
     */
    async getCertificationsByOrganization(candidateId: string, organization: string): Promise<Certification[]> {
        await this.init();

        try {
            const certifications = await this.getCertifications(candidateId);
            return certifications.filter(cert => 
                cert.issuingOrganization.toLowerCase().includes(organization.toLowerCase())
            );
        } catch (error) {
            console.error('Error getting certifications by organization:', error);
            throw new Error('Failed to retrieve certifications by organization');
        }
    }



    /**
     * Searches certifications by name across all candidates
     */
    async searchCertificationsByName(certificationName: string): Promise<{ candidateId: string; certifications: Certification[] }[]> {
        await this.init();

        try {
            // This would need to be implemented based on your search requirements
            // For now, this is a placeholder
            const allResumeData = await this.resumeRepo.findAll();
            
            return allResumeData.map(resumeData => ({
                candidateId: resumeData.candidateId,
                certifications: resumeData.certification
                    .map(c => Certification.fromObject(c))
                    .filter(cert => cert.name.toLowerCase().includes(certificationName.toLowerCase()))
            })).filter(result => result.certifications.length > 0);
        } catch (error) {
            console.error('Error searching certifications:', error);
            throw new Error('Failed to search certifications');
        }
    }

    private isValidUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
}
