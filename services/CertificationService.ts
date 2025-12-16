import { connectDB } from '../mongo_db';
import { ResumeRepository } from '../repositories/CandidateRepository';
import { Certification, CreateCertificationData, CertificationData } from '../Models/Certification';
import { ObjectId } from 'mongodb';
export class CertificationService {
    private resumeRepo: ResumeRepository;
    constructor() {
        this.resumeRepo = null as any;
    }
    async init(): Promise<void> {
        const db = await connectDB();
        this.resumeRepo = new ResumeRepository(db);
    }
    async addCertification(candidateId: string, certificationData: any): Promise<void> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const certificationId = new ObjectId().toString();
            const addedBy = certificationData.addedBy || 'AI';
            const certification = new Certification(
                certificationId,
                certificationData.name,
                certificationData.issuingOrganization,
                certificationData.issueDate,
                certificationData.description,
                addedBy
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
    async updateCertification(candidateId: string, certificationId: string, updatedCertification: any): Promise<void> {
        await this.init();
        try {
            // Use atomic MongoDB update with positional operator to avoid race conditions
            const db = await connectDB();
            const updateFields: any = {};
            
            if (updatedCertification.name !== undefined) {
                updateFields['certification.$.name'] = updatedCertification.name;
            }
            if (updatedCertification.issuingOrganization !== undefined) {
                updateFields['certification.$.issuingOrganization'] = updatedCertification.issuingOrganization;
            }
            if (updatedCertification.issueDate !== undefined) {
                updateFields['certification.$.issueDate'] = updatedCertification.issueDate;
            }
            if (updatedCertification.expirationDate !== undefined) {
                updateFields['certification.$.expirationDate'] = updatedCertification.expirationDate;
            }
            if (updatedCertification.credentialId !== undefined) {
                updateFields['certification.$.credentialId'] = updatedCertification.credentialId;
            }
            if (updatedCertification.credentialUrl !== undefined) {
                updateFields['certification.$.credentialUrl'] = updatedCertification.credentialUrl;
            }
            if (updatedCertification.description !== undefined) {
                updateFields['certification.$.description'] = updatedCertification.description;
            }
            if (updatedCertification.addedBy !== undefined) {
                updateFields['certification.$.addedBy'] = updatedCertification.addedBy;
            }
            
            updateFields['certification.$.updatedAt'] = new Date();
            updateFields['dateUpdated'] = new Date();
            
            const result = await db.collection('resume').updateOne(
                { 
                    candidateId,
                    'certification.certificationId': certificationId
                },
                { $set: updateFields }
            );
            
            if (result.matchedCount === 0) {
                throw new Error('Certification not found');
            }
        } catch (error) {
            console.error('Error updating certification:', error);
            throw new Error('Failed to update certification');
        }
    }
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
