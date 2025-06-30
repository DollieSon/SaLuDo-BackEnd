import { Skill, SkillData, CreateSkillData } from './Skill';
import { Experience, ExperienceData, CreateExperienceData } from './Experience';
import { Education, EducationData, CreateEducationData } from './Education';
import { Certification, CertificationData, CreateCertificationData } from './Certification';
import { StrengthWeakness, StrengthWeaknessData, CreateStrengthWeaknessData } from './StrengthWeakness';
import { Personality } from './Personality';
import { PersonalityData } from './PersonalityTypes';
export interface ResumeMetadata {
    fileId: string;           // GridFS file ID
    filename: string;         // Original filename
    contentType: string;      // MIME type (application/pdf, etc.)
    size: number;            // File size in bytes
    uploadedAt: Date;        // Upload timestamp
    parsedAt?: Date;         // When AI parsing completed
    parseStatus?: 'pending' | 'completed' | 'failed' | 'not_started';
    textContent?: string;    // Extracted text content for AI processing
}
export interface TranscriptMetadata {
    fileId: string;           // GridFS file ID
    filename: string;         // Original filename (e.g., "interview_round1.mp3")
    contentType: string;      // MIME type (audio/mpeg, audio/wav, text/plain, etc.)
    size: number;            // File size in bytes
    uploadedAt: Date;        // Upload timestamp
    transcribedAt?: Date;    // When AI transcription completed
    transcriptionStatus?: 'pending' | 'completed' | 'failed' | 'not_started';
    textContent?: string;    // Transcribed text content
    interviewRound?: string; // Which interview round (e.g., "initial", "technical", "hr")
    duration?: number;       // Audio duration in seconds (for audio files)
}
export class Candidate {
    // Personal Information (PersonalInfo Database)
    public candidateId: string;
    public name: string;
    public email: string[];
    public birthdate: Date;
    public dateCreated: Date;
    public dateUpdated: Date;
    public roleApplied: string; // Job reference
    public status: CandidateStatus;
    public isDeleted: boolean;
    // Resume Information (Resume Database)
    public resumeMetadata?: ResumeMetadata; // File metadata for GridFS storage
    public skills: Skill[];
    public experience: Experience[];
    public education: Education[];
    public certification: Certification[];
    public strengths: StrengthWeakness[];
    public weaknesses: StrengthWeakness[];
    public resumeAssessment?: string;
    // Interview Information (Interview Database)
    public transcripts: TranscriptMetadata[]; // File metadata for GridFS storage
    public personality: Personality; // Comprehensive personality assessment
    public interviewAssessment?: string;
    constructor(
        candidateId: string,
        name: string,
        email: string[],
        birthdate: Date,
        roleApplied: string,
        resumeMetadata?: ResumeMetadata,
        status: CandidateStatus = CandidateStatus.APPLIED,
        dateCreated?: Date,
        dateUpdated?: Date
    ) {
        this.candidateId = candidateId;
        this.name = name;
        this.email = email;
        this.birthdate = birthdate;
        this.roleApplied = roleApplied;
        this.resumeMetadata = resumeMetadata;
        this.status = status;
        this.isDeleted = false;
        this.dateCreated = dateCreated || new Date();
        this.dateUpdated = dateUpdated || new Date();
        // Initialize arrays
        this.skills = [];
        this.experience = [];
        this.education = [];
        this.certification = [];
        this.strengths = [];
        this.weaknesses = [];
        this.transcripts = [];
        this.personality = new Personality(); // Create empty personality for new candidate
    }
    // =======================
    // UTILITY METHODS
    // =======================
    toObject(): CandidateData {
        return {
            candidateId: this.candidateId,
            name: this.name,
            email: this.email,
            birthdate: this.birthdate,
            dateCreated: this.dateCreated,
            dateUpdated: this.dateUpdated,
            roleApplied: this.roleApplied,
            resume: this.resumeMetadata,
            status: this.status,
            isDeleted: this.isDeleted,
            skills: this.skills.map(s => s.toObject()),
            experience: this.experience.map(e => e.toObject()),
            education: this.education.map(e => e.toObject()),
            certification: this.certification.map(c => c.toObject()),
            strengths: this.strengths.map(s => s.toObject()),
            weaknesses: this.weaknesses.map(w => w.toObject()),
            resumeAssessment: this.resumeAssessment,
            transcripts: this.transcripts,
            personality: this.personality.toObject(),
            interviewAssessment: this.interviewAssessment
        };
    }
    getPersonalInfo(): PersonalInfoData {
        return {
            candidateId: this.candidateId,
            name: this.name,
            email: this.email,
            birthdate: this.birthdate,
            dateCreated: this.dateCreated,
            dateUpdated: this.dateUpdated,
            roleApplied: this.roleApplied,
            status: this.status,
            isDeleted: this.isDeleted
        };
    }
    getResumeData(): ResumeData {
        return {
            candidateId: this.candidateId,
            resume: this.resumeMetadata,
            skills: this.skills.map(s => s.toObject()),
            experience: this.experience.map(e => e.toObject()),
            education: this.education.map(e => e.toObject()),
            certification: this.certification.map(c => c.toObject()),
            strengths: this.strengths.map(s => s.toObject()),
            weaknesses: this.weaknesses.map(w => w.toObject()),
            resumeAssessment: this.resumeAssessment,
            dateUpdated: this.dateUpdated
        };
    }
    getInterviewData(): InterviewData {
        return {
            candidateId: this.candidateId,
            transcripts: this.transcripts,
            personality: this.personality.toObject(),
            interviewAssessment: this.interviewAssessment,
            dateUpdated: this.dateUpdated
        };
    }
    isActive(): boolean {
        return !this.isDeleted;
    }
    getAge(): number {
        const today = new Date();
        const birthDate = new Date(this.birthdate);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }
    getSummary(): string {
        return `${this.name} - ${this.roleApplied} (${this.status})`;
    }
    hasResume(): boolean {
        return this.resumeMetadata !== undefined && this.resumeMetadata.fileId !== undefined;
    }
    hasTranscripts(): boolean {
        return this.transcripts.length > 0;
    }
    getTranscriptCount(): number {
        return this.transcripts.length;
    }
    getTranscriptsByRound(round?: string): TranscriptMetadata[] {
        if (!round) return this.transcripts;
        return this.transcripts.filter(t => t.interviewRound === round);
    }
    getInterviewRounds(): string[] {
        const rounds = this.transcripts
            .filter(t => t.interviewRound)
            .map(t => t.interviewRound!);
        return [...new Set(rounds)]; // Remove duplicates
    }
    getTranscribedFiles(): TranscriptMetadata[] {
        return this.transcripts.filter(t => 
            t.transcriptionStatus === 'completed' && t.textContent
        );
    }
    getProfileCompleteness(): {
        skills: number;
        experience: number;
        education: number;
        certifications: number;
        personalityTraits: number;
        personalityCompletion: number;
        total: number;
    } {
        const completedTraits = this.getCompletedPersonalityTraitsCount();
        return {
            skills: this.skills.length,
            experience: this.experience.length,
            education: this.education.length,
            certifications: this.certification.length,
            personalityTraits: completedTraits,
            personalityCompletion: this.personality.getCompletionPercentage(),
            total: this.skills.length + this.experience.length + this.education.length + this.certification.length + completedTraits
        };
    }
    getPersonalityScore(): number {
        return this.personality.getOverallPersonalityScore();
    }
    getPersonalityCompletionPercentage(): number {
        return this.personality.getCompletionPercentage();
    }
    getPersonalityStrengths(count: number = 5): any[] {
        return this.personality.getTopStrengths(count);
    }
    getPersonalityImprovementAreas(count: number = 3): any[] {
        return this.personality.getAreasForImprovement(count);
    }
    hasPersonalityAssessment(): boolean {
        return this.getCompletedPersonalityTraitsCount() > 0;
    }
    getPersonalitySummary(): string {
        const score = this.getPersonalityScore();
        const completion = this.getPersonalityCompletionPercentage();
        const traits = this.getCompletedPersonalityTraitsCount();
        if (traits === 0) {
            return 'Personality assessment not started';
        }
        return `Personality Score: ${score}/10 (${completion}% complete, ${traits} traits assessed)`;
    }
    private getCompletedPersonalityTraitsCount(): number {
        const allTraits = [
            ...Object.values(this.personality.cognitiveAndProblemSolving),
            ...Object.values(this.personality.communicationAndTeamwork),
            ...Object.values(this.personality.workEthicAndReliability),
            ...Object.values(this.personality.growthAndLeadership),
            ...Object.values(this.personality.cultureAndPersonalityFit),
            ...Object.values(this.personality.bonusTraits)
        ];
        return allTraits.filter(trait => trait.score > 0).length;
    }
}
// =======================
// ENUMS AND INTERFACES
// =======================
export enum CandidateStatus {
    APPLIED = 'Applied',
    REFERENCE_CHECK = 'Reference Check',
    OFFER = 'Offer',
    HIRED = 'Hired',
    REJECTED = 'Rejected',
    WITHDRAWN = 'Withdrawn'
}
export interface CandidateData {
    candidateId: string;
    name: string;
    email: string[];
    birthdate: Date;
    dateCreated: Date;
    dateUpdated: Date;
    roleApplied: string;
    resume?: ResumeMetadata;
    status: CandidateStatus;
    isDeleted: boolean;
    skills: SkillData[];
    experience: ExperienceData[];
    education: EducationData[];
    certification: CertificationData[];
    strengths: StrengthWeaknessData[];
    weaknesses: StrengthWeaknessData[];
    resumeAssessment?: string;
    transcripts: TranscriptMetadata[];
    personality: PersonalityData;
    interviewAssessment?: string;
}
export interface PersonalInfoData {
    candidateId: string;
    name: string;
    email: string[];
    birthdate: Date;
    dateCreated: Date;
    dateUpdated: Date;
    roleApplied: string;
    status: CandidateStatus;
    isDeleted: boolean;
}
export interface ResumeData {
    candidateId: string;
    resume?: ResumeMetadata;
    skills: SkillData[];
    experience: ExperienceData[];
    education: EducationData[];
    certification: CertificationData[];
    strengths: StrengthWeaknessData[];
    weaknesses: StrengthWeaknessData[];
    resumeAssessment?: string;
    dateUpdated: Date;
}
export interface InterviewData {
    candidateId: string;
    transcripts: TranscriptMetadata[];
    personality: PersonalityData;
    interviewAssessment?: string;
    dateUpdated: Date;
}
