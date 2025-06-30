import { connectDB } from '../mongo_db';
import { PersonalInfoRepository, ResumeRepository, InterviewRepository } from '../repositories/CandidateRepository';
import { Candidate, CandidateData, CandidateStatus, ResumeMetadata, TranscriptMetadata } from '../Models/Candidate';
import { Skill, CreateSkillData } from '../Models/Skill';
import { Experience, CreateExperienceData } from '../Models/Experience';
import { Education, CreateEducationData } from '../Models/Education';
import { Certification, CreateCertificationData } from '../Models/Certification';
import { StrengthWeakness, CreateStrengthWeaknessData } from '../Models/StrengthWeakness';
import { Personality } from '../Models/Personality';
import { GridFSBucket, ObjectId } from 'mongodb';
export class CandidateService {
    private personalInfoRepo: PersonalInfoRepository;
    private resumeRepo: ResumeRepository;
    private interviewRepo: InterviewRepository;
    constructor() {
        // Initialize repositories - will be set up in init() (trust the process bestie)
        this.personalInfoRepo = null as any;
        this.resumeRepo = null as any;
        this.interviewRepo = null as any;
    }
    async init(): Promise<void> {
        const db = await connectDB();
        this.personalInfoRepo = new PersonalInfoRepository(db);
        this.resumeRepo = new ResumeRepository(db);
        this.interviewRepo = new InterviewRepository(db);
    }
    async addCandidate(
        name: string,
        email: string[],
        birthdate: Date,
        roleApplied: string,
        resumeFile?: Express.Multer.File
    ): Promise<Candidate> {
        await this.init();
        try {
            // Handle resume file upload if provided
            let resumeMetadata: ResumeMetadata | undefined;
            if (resumeFile) {
                const db = await connectDB();
                const bucket = new GridFSBucket(db, { bucketName: 'resumes' });
                // Upload file to GridFS
                const uploadStream = bucket.openUploadStream(resumeFile.originalname, {
                    metadata: {
                        contentType: resumeFile.mimetype,
                        uploadedBy: 'candidate',
                        candidateId: '', // Will be updated after candidate creation
                    }
                });
                const fileId = uploadStream.id;
                uploadStream.end(resumeFile.buffer);
                // Wait for upload to complete
                await new Promise((resolve, reject) => {
                    uploadStream.on('finish', resolve);
                    uploadStream.on('error', reject);
                });
                resumeMetadata = {
                    fileId: fileId.toString(),
                    filename: resumeFile.originalname,
                    contentType: resumeFile.mimetype,
                    size: resumeFile.size,
                    uploadedAt: new Date(),
                    parseStatus: 'pending'
                };
            }
            // Create personal info
            const personalInfo = await this.personalInfoRepo.create({
                name,
                email,
                birthdate,
                roleApplied,
                status: CandidateStatus.APPLIED,
                isDeleted: false
            });
            // Create resume data with metadata
            await this.resumeRepo.create({
                candidateId: personalInfo.candidateId,
                resume: resumeMetadata,
                skills: [],
                experience: [],
                education: [],
                certification: [],
                strengths: [],
                weaknesses: []
            });
            // Update GridFS metadata with candidateId
            if (resumeMetadata) {
                const db = await connectDB();
                await db.collection('resumes.files').updateOne(
                    { _id: new ObjectId(resumeMetadata.fileId) },
                    { $set: { 'metadata.candidateId': personalInfo.candidateId } }
                );
            }
            // Create empty interview data
            await this.interviewRepo.create({
                candidateId: personalInfo.candidateId,
                transcripts: [],
                personality: new Personality().toObject()
            });
            // Create and return candidate object
            const candidate = new Candidate(
                personalInfo.candidateId,
                name,
                email,
                birthdate,
                roleApplied,
                resumeMetadata,
                CandidateStatus.APPLIED,
                personalInfo.dateCreated,
                personalInfo.dateUpdated
            );
            return candidate;
        } catch (error) {
            console.error('Error adding candidate:', error);
            throw new Error('Failed to add candidate');
        }
    }
    async getCandidate(candidateId: string): Promise<Candidate | null> {
        await this.init();
        try {
            // Get data from all repositories
            const [personalInfo, resumeData, interviewData] = await Promise.all([
                this.personalInfoRepo.findById(candidateId),
                this.resumeRepo.findById(candidateId),
                this.interviewRepo.findById(candidateId)
            ]);
            if (!personalInfo) {
                return null;
            }
            // Reconstruct candidate object
            const candidate = new Candidate(
                personalInfo.candidateId,
                personalInfo.name,
                personalInfo.email,
                personalInfo.birthdate,
                personalInfo.roleApplied,
                resumeData?.resume,
                personalInfo.status,
                personalInfo.dateCreated,
                personalInfo.dateUpdated
            );
            candidate.isDeleted = personalInfo.isDeleted;
            // Populate resume data if exists
            if (resumeData) {
                candidate.skills = resumeData.skills?.map((s: any) => Skill.fromObject(s)) || [];
                candidate.experience = resumeData.experience?.map((e: any) => Experience.fromObject(e)) || [];
                candidate.education = resumeData.education?.map((e: any) => Education.fromObject(e)) || [];
                candidate.certification = resumeData.certification?.map((c: any) => Certification.fromObject(c)) || [];
                candidate.strengths = resumeData.strengths?.map((s: any) => StrengthWeakness.fromObject(s)) || [];
                candidate.weaknesses = resumeData.weaknesses?.map((w: any) => StrengthWeakness.fromObject(w)) || [];
                candidate.resumeAssessment = resumeData.resumeAssessment;
            }
            // Populate interview data if exists
            if (interviewData) {
                candidate.transcripts = interviewData.transcripts || [];
                candidate.personality = Personality.fromObject(interviewData.personality);
                candidate.interviewAssessment = interviewData.interviewAssessment;
            }
            return candidate;
        } catch (error) {
            console.error('Error getting candidate:', error);
            throw new Error('Failed to retrieve candidate');
        }
    }
    async updateCandidate(candidateId: string, updatedData: Partial<CandidateData>): Promise<void> {
        await this.init();
        try {
            // Update personal info if relevant fields changed
            if (updatedData.name || updatedData.email || updatedData.birthdate || 
                updatedData.roleApplied || updatedData.status) {
                await this.personalInfoRepo.update(candidateId, {
                    name: updatedData.name,
                    email: updatedData.email,
                    birthdate: updatedData.birthdate,
                    roleApplied: updatedData.roleApplied,
                    status: updatedData.status
                });
            }
            // Update resume data if relevant fields changed
            if (updatedData.resume || updatedData.skills || updatedData.experience || 
                updatedData.education || updatedData.certification || updatedData.strengths || 
                updatedData.weaknesses || updatedData.resumeAssessment) {
                await this.resumeRepo.update(candidateId, {
                    resume: updatedData.resume,
                    skills: updatedData.skills,
                    experience: updatedData.experience,
                    education: updatedData.education,
                    certification: updatedData.certification,
                    strengths: updatedData.strengths,
                    weaknesses: updatedData.weaknesses,
                    resumeAssessment: updatedData.resumeAssessment
                });
            }
            // Update interview data if relevant fields changed
            if (updatedData.transcripts || updatedData.personality || updatedData.interviewAssessment) {
                await this.interviewRepo.update(candidateId, {
                    transcripts: updatedData.transcripts,
                    personality: updatedData.personality,
                    interviewAssessment: updatedData.interviewAssessment
                });
            }
        } catch (error) {
            console.error('Error updating candidate:', error);
            throw new Error('Failed to update candidate');
        }
    }
    async deleteCandidate(candidateId: string): Promise<void> {
        await this.init();
        try {
            await this.personalInfoRepo.delete(candidateId);
        } catch (error) {
            console.error('Error deleting candidate:', error);
            throw new Error('Failed to delete candidate');
        }
    }
    async getAllCandidates(): Promise<Candidate[]> {
        await this.init();
        try {
            const personalInfos = await this.personalInfoRepo.findAll();
            const candidates: Candidate[] = [];
            for (const personalInfo of personalInfos) {
                const candidate = await this.getCandidate(personalInfo.candidateId);
                if (candidate) {
                    candidates.push(candidate);
                }
            }
            return candidates;
        } catch (error) {
            console.error('Error getting all candidates:', error);
            throw new Error('Failed to retrieve candidates');
        }
    }
    async getCandidatesByStatus(status: CandidateStatus): Promise<Candidate[]> {
        await this.init();
        try {
            const personalInfos = await this.personalInfoRepo.findByStatus(status);
            const candidates: Candidate[] = [];
            for (const personalInfo of personalInfos) {
                const candidate = await this.getCandidate(personalInfo.candidateId);
                if (candidate) {
                    candidates.push(candidate);
                }
            }
            return candidates;
        } catch (error) {
            console.error('Error getting candidates by status:', error);
            throw new Error('Failed to retrieve candidates by status');
        }
    }
    async getResumeFile(candidateId: string): Promise<{ stream: any; metadata: any } | null> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData?.resume) {
                return null;
            }
            const db = await connectDB();
            const bucket = new GridFSBucket(db, { bucketName: 'resumes' });
            const fileId = new ObjectId(resumeData.resume.fileId);
            const fileInfo = await db.collection('resumes.files').findOne({ _id: fileId });
            if (!fileInfo) {
                return null;
            }
            const downloadStream = bucket.openDownloadStream(fileId);
            return {
                stream: downloadStream,
                metadata: {
                    filename: resumeData.resume.filename,
                    contentType: resumeData.resume.contentType,
                    size: resumeData.resume.size
                }
            };
        } catch (error) {
            console.error('Error getting resume file:', error);
            throw new Error('Failed to retrieve resume file');
        }
    }
    async updateResumeFile(candidateId: string, resumeFile: Express.Multer.File): Promise<void> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate not found');
            }
            const db = await connectDB();
            const bucket = new GridFSBucket(db, { bucketName: 'resumes' });
            // Delete old file if exists
            if (resumeData.resume?.fileId) {
                try {
                    await bucket.delete(new ObjectId(resumeData.resume.fileId));
                } catch (error) {
                    console.log('Old resume file not found, continuing with upload');
                }
            }
            // Upload new file
            const uploadStream = bucket.openUploadStream(resumeFile.originalname, {
                metadata: {
                    contentType: resumeFile.mimetype,
                    uploadedBy: 'candidate',
                    candidateId: candidateId,
                }
            });
            const fileId = uploadStream.id;
            uploadStream.end(resumeFile.buffer);
            // Wait for upload to complete
            await new Promise((resolve, reject) => {
                uploadStream.on('finish', resolve);
                uploadStream.on('error', reject);
            });
            // Update resume metadata
            const newResumeMetadata: ResumeMetadata = {
                fileId: fileId.toString(),
                filename: resumeFile.originalname,
                contentType: resumeFile.mimetype,
                size: resumeFile.size,
                uploadedAt: new Date(),
                parseStatus: 'pending'
            };
            await this.resumeRepo.update(candidateId, {
                resume: newResumeMetadata
            });
        } catch (error) {
            console.error('Error updating resume file:', error);
            throw new Error('Failed to update resume file');
        }
    }
    async deleteResumeFile(candidateId: string): Promise<void> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData?.resume) {
                return; // No resume to delete
            }
            const db = await connectDB();
            const bucket = new GridFSBucket(db, { bucketName: 'resumes' });
            // Delete file from GridFS
            await bucket.delete(new ObjectId(resumeData.resume.fileId));
            // Update resume data to remove metadata
            await this.resumeRepo.update(candidateId, {
                resume: undefined
            });
        } catch (error) {
            console.error('Error deleting resume file:', error);
            throw new Error('Failed to delete resume file');
        }
    }
    async hasResume(candidateId: string): Promise<boolean> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            return !!resumeData?.resume?.fileId;
        } catch (error) {
            console.error('Error checking resume existence:', error);
            return false;
        }
    }
    async getResumeMetadata(candidateId: string): Promise<ResumeMetadata | null> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            return resumeData?.resume || null;
        } catch (error) {
            console.error('Error getting resume metadata:', error);
            throw new Error('Failed to retrieve resume metadata');
        }
    }
    // ============================
    // TRANSCRIPT FILE OPERATIONS
    // ============================
    async addTranscriptFile(
        candidateId: string,
        transcriptFile: Express.Multer.File,
        metadata?: Partial<TranscriptMetadata>
    ): Promise<TranscriptMetadata> {
        await this.init();
        try {
            // Validate file
            this.validateTranscriptFile(transcriptFile);
            const db = await connectDB();
            const bucket = new GridFSBucket(db, { bucketName: 'transcripts' });
            // Upload file to GridFS
            const uploadStream = bucket.openUploadStream(transcriptFile.originalname, {
                metadata: {
                    contentType: transcriptFile.mimetype,
                    uploadedBy: 'candidate',
                    candidateId: candidateId,
                    interviewRound: metadata?.interviewRound || 'general',
                    duration: metadata?.duration
                }
            });
            const fileId = uploadStream.id;
            uploadStream.end(transcriptFile.buffer);
            // Wait for upload to complete
            await new Promise((resolve, reject) => {
                uploadStream.on('finish', resolve);
                uploadStream.on('error', reject);
            });
            const transcriptMetadata: TranscriptMetadata = {
                fileId: fileId.toString(),
                filename: transcriptFile.originalname,
                contentType: transcriptFile.mimetype,
                size: transcriptFile.size,
                uploadedAt: new Date(),
                transcriptionStatus: 'not_started',
                interviewRound: metadata?.interviewRound || 'general',
                duration: metadata?.duration,
                ...metadata
            };
            // Get current interview data
            const interviewData = await this.interviewRepo.findById(candidateId);
            const currentTranscripts: TranscriptMetadata[] = Array.isArray(interviewData?.transcripts) 
                ? interviewData.transcripts.filter((t): t is TranscriptMetadata => typeof t === 'object') 
                : [];
            // Add new transcript metadata
            const updatedTranscripts = [...currentTranscripts, transcriptMetadata];
            // Update interview data
            await this.interviewRepo.update(candidateId, {
                transcripts: updatedTranscripts,
                dateUpdated: new Date()
            });
            return transcriptMetadata;
        } catch (error) {
            console.error('Error adding transcript file:', error);
            throw new Error('Failed to add transcript file');
        }
    }
    async getTranscriptFile(candidateId: string, transcriptId: string): Promise<{ stream: any; metadata: TranscriptMetadata }> {
        await this.init();
        try {
            const db = await connectDB();
            const bucket = new GridFSBucket(db, { bucketName: 'transcripts' });
            // Get transcript metadata first
            const interviewData = await this.interviewRepo.findById(candidateId);
            const transcript = interviewData?.transcripts?.find(t => t.fileId === transcriptId);
            if (!transcript) {
                throw new Error('Transcript not found');
            }
            // Create download stream
            const downloadStream = bucket.openDownloadStream(new ObjectId(transcriptId));
            return {
                stream: downloadStream,
                metadata: transcript
            };
        } catch (error) {
            console.error('Error getting transcript file:', error);
            throw new Error('Failed to retrieve transcript file');
        }
    }
    async updateTranscriptFile(
        candidateId: string,
        transcriptId: string,
        transcriptFile: Express.Multer.File,
        metadata?: Partial<TranscriptMetadata>
    ): Promise<TranscriptMetadata> {
        await this.init();
        try {
            // Validate file
            this.validateTranscriptFile(transcriptFile);
            const db = await connectDB();
            const bucket = new GridFSBucket(db, { bucketName: 'transcripts' });
            // Delete old file from GridFS
            await bucket.delete(new ObjectId(transcriptId));
            // Upload new file
            const uploadStream = bucket.openUploadStream(transcriptFile.originalname, {
                metadata: {
                    contentType: transcriptFile.mimetype,
                    uploadedBy: 'candidate',
                    candidateId: candidateId,
                    interviewRound: metadata?.interviewRound || 'general',
                    duration: metadata?.duration
                }
            });
            const newFileId = uploadStream.id;
            uploadStream.end(transcriptFile.buffer);
            // Wait for upload to complete
            await new Promise((resolve, reject) => {
                uploadStream.on('finish', resolve);
                uploadStream.on('error', reject);
            });
            const updatedTranscriptMetadata: TranscriptMetadata = {
                fileId: newFileId.toString(),
                filename: transcriptFile.originalname,
                contentType: transcriptFile.mimetype,
                size: transcriptFile.size,
                uploadedAt: new Date(),
                transcriptionStatus: 'not_started',
                interviewRound: metadata?.interviewRound || 'general',
                duration: metadata?.duration,
                ...metadata
            };
            // Update interview data
            const interviewData = await this.interviewRepo.findById(candidateId);
            const updatedTranscripts = interviewData?.transcripts?.map(t => 
                t.fileId === transcriptId ? updatedTranscriptMetadata : t
            ) || [updatedTranscriptMetadata];
            await this.interviewRepo.update(candidateId, {
                transcripts: updatedTranscripts,
                dateUpdated: new Date()
            });
            return updatedTranscriptMetadata;
        } catch (error) {
            console.error('Error updating transcript file:', error);
            throw new Error('Failed to update transcript file');
        }
    }
    async deleteTranscriptFile(candidateId: string, transcriptId: string): Promise<void> {
        await this.init();
        try {
            const db = await connectDB();
            const bucket = new GridFSBucket(db, { bucketName: 'transcripts' });
            // Delete file from GridFS
            await bucket.delete(new ObjectId(transcriptId));
            // Update interview data - remove the transcript
            const interviewData = await this.interviewRepo.findById(candidateId);
            const updatedTranscripts = interviewData?.transcripts?.filter(t => t.fileId !== transcriptId) || [];
            await this.interviewRepo.update(candidateId, {
                transcripts: updatedTranscripts,
                dateUpdated: new Date()
            });
        } catch (error) {
            console.error('Error deleting transcript file:', error);
            throw new Error('Failed to delete transcript file');
        }
    }
    async getAllTranscripts(candidateId: string): Promise<TranscriptMetadata[]> {
        await this.init();
        try {
            const interviewData = await this.interviewRepo.findById(candidateId);
            return interviewData?.transcripts || [];
        } catch (error) {
            console.error('Error getting transcripts:', error);
            throw new Error('Failed to retrieve transcripts');
        }
    }
    async getTranscriptMetadata(candidateId: string, transcriptId: string): Promise<TranscriptMetadata | null> {
        await this.init();
        try {
            const interviewData = await this.interviewRepo.findById(candidateId);
            return interviewData?.transcripts?.find(t => t.fileId === transcriptId) || null;
        } catch (error) {
            console.error('Error getting transcript metadata:', error);
            throw new Error('Failed to retrieve transcript metadata');
        }
    }
    private validateTranscriptFile(file: Express.Multer.File): void {
        // Allowed MIME types for transcript files
        const allowedTypes = [
            'audio/mpeg',      // MP3
            'audio/wav',       // WAV
            'audio/mp4',       // M4A
            'audio/ogg',       // OGG
            'text/plain',      // TXT
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // DOCX
        ];
        if (!allowedTypes.includes(file.mimetype)) {
            throw new Error('Invalid file type. Only MP3, WAV, M4A, OGG, TXT, and DOCX files are allowed.');
        }
        // Check file size (50MB limit for audio files)
        const maxSize = 50 * 1024 * 1024; // 50MB in bytes
        if (file.size > maxSize) {
            throw new Error('File size too large. Maximum size is 50MB.');
        }
    }
}
