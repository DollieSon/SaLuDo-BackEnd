import { Skill, SkillData, CreateSkillData } from './Skill';
import { Experience, ExperienceData, CreateExperienceData } from './Experience';
import { Education, EducationData, CreateEducationData } from './Education';
import { Certification, CertificationData, CreateCertificationData } from './Certification';
import { StrengthWeakness, StrengthWeaknessData, CreateStrengthWeaknessData } from './StrengthWeakness';

/**
 * Simplified Candidate class that's literally the main character 
 * This bad boy is just a data container now, all the business logic moved to services
 * Like bestie, this is just holding the tea while the services do all the work fr
 */
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
    public resume?: string; // File path or base64 string
    public skills: Skill[];
    public experience: Experience[];
    public education: Education[];
    public certification: Certification[];
    public strengths: StrengthWeakness[];
    public weaknesses: StrengthWeakness[];
    public resumeAssessment?: string;

    // Interview Information (Interview Database)
    public transcripts: string[]; // File paths or content
    public personalityScore?: any; // Placeholder for Personality type
    public interviewAssessment?: string;

    constructor(
        candidateId: string,
        name: string,
        email: string[],
        birthdate: Date,
        roleApplied: string,
        resume?: string,
        status: CandidateStatus = CandidateStatus.APPLIED,
        dateCreated?: Date,
        dateUpdated?: Date
    ) {
        this.candidateId = candidateId;
        this.name = name;
        this.email = email;
        this.birthdate = birthdate;
        this.roleApplied = roleApplied;
        this.resume = resume;
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
    }

    // =======================
    // UTILITY METHODS
    // =======================

    /**
     * Converts candidate to plain object for database storage
     * Flattening this candidate queen for that database lifestyle 
     */
    toObject(): CandidateData {
        return {
            candidateId: this.candidateId,
            name: this.name,
            email: this.email,
            birthdate: this.birthdate,
            dateCreated: this.dateCreated,
            dateUpdated: this.dateUpdated,
            roleApplied: this.roleApplied,
            resume: this.resume,
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
            personalityScore: this.personalityScore,
            interviewAssessment: this.interviewAssessment
        };
    }

    /**
     * Gets personal info for PersonalInfo database
     * Just the basic personal tea, nothing else bestie 
     */
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

    /**
     * Gets resume data for Resume database
     * All the career flex and skills energy in one place 
     */
    getResumeData(): ResumeData {
        return {
            candidateId: this.candidateId,
            resume: this.resume,
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

    /**
     * Gets interview data for Interview database
     * Where all the interview tea and personality vibes live 
     */
    getInterviewData(): InterviewData {
        return {
            candidateId: this.candidateId,
            transcripts: this.transcripts,
            personalityScore: this.personalityScore,
            interviewAssessment: this.interviewAssessment,
            dateUpdated: this.dateUpdated
        };
    }

    /**
     * Basic validation - checks if candidate is deleted
     * Is this candidate still in the game or did they get eliminated? 
     */
    isActive(): boolean {
        return !this.isDeleted;
    }

    /**
     * Gets candidate age
     * How many years has this bestie been alive on this planet? 
     */
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

    /**
     * Gets a summary of the candidate
     * This method is giving elevator pitch energy fr fr 
     */
    getSummary(): string {
        return `${this.name} - ${this.roleApplied} (${this.status})`;
    }

    /**
     * Checks if candidate has resume
     * Does this candidate have resume receipts or are they fumbling? 
     */
    hasResume(): boolean {
        return this.resume !== undefined && this.resume.length > 0;
    }

    /**
     * Gets total number of skills, experience, education, and certifications
     * How complete is this candidate's whole vibe check? Let's see the stats bestie 
     */
    getProfileCompleteness(): {
        skills: number;
        experience: number;
        education: number;
        certifications: number;
        total: number;
    } {
        return {
            skills: this.skills.length,
            experience: this.experience.length,
            education: this.education.length,
            certifications: this.certification.length,
            total: this.skills.length + this.experience.length + this.education.length + this.certification.length
        };
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
    resume?: string;
    status: CandidateStatus;
    isDeleted: boolean;
    skills: SkillData[];
    experience: ExperienceData[];
    education: EducationData[];
    certification: CertificationData[];
    strengths: StrengthWeaknessData[];
    weaknesses: StrengthWeaknessData[];
    resumeAssessment?: string;
    transcripts: string[];
    personalityScore?: any;
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
    resume?: string;
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
    transcripts: string[];
    personalityScore?: any;
    interviewAssessment?: string;
    dateUpdated: Date;
}
