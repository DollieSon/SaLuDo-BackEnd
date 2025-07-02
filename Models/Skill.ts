import { ObjectId } from 'mongodb';
export enum AddedBy {
    AI = 'AI',
    HUMAN = 'HUMAN'
}
export class Skill {
    public candidateSkillId: string;     // Unique ID for this candidate-skill relationship
    public skillId: string;              // Foreign key to SkillMaster collection
    public evidence: string;             // Evidence of this skill (resume text, certification, etc.)
    public score: number;                // Proficiency level 1-10
    public addedAt: Date;                // When this skill was added
    public addedBy: AddedBy;             // Who added it (AI or Human)
    public isDeleted: boolean;           // Soft deletion flag
    constructor(
        candidateSkillId: string,
        skillId: string,
        evidence: string,
        score: number,
        addedBy: AddedBy,
        addedAt?: Date,
        isDeleted?: boolean
    ) {
        this.candidateSkillId = candidateSkillId;
        this.skillId = skillId;
        this.evidence = evidence;
        this.score = score;
        this.addedBy = addedBy;
        this.addedAt = addedAt || new Date();
        this.isDeleted = isDeleted || false;
        // Validate score range (1-10)
        if (score < 1 || score > 10) {
            throw new Error('Score must be between 1 and 10');
        }
    }
    static create(
        skillId: string,
        evidence: string,
        score: number,
        addedBy: AddedBy,
        isDeleted?: boolean
    ): Skill {
        return new Skill(
            new ObjectId().toString(),
            skillId,
            evidence,
            score,
            addedBy,
            undefined,
            isDeleted
        );
    }
    static fromObject(obj: SkillData): Skill {
        return new Skill(
            obj.candidateSkillId,
            obj.skillId,
            obj.evidence,
            obj.score,
            obj.addedBy as AddedBy,
            obj.addedAt ? new Date(obj.addedAt) : undefined,
            obj.isDeleted || false
        );
    }
    toObject(): SkillData {
        return {
            candidateSkillId: this.candidateSkillId,
            skillId: this.skillId,
            evidence: this.evidence,
            score: this.score,
            addedAt: this.addedAt,
            addedBy: this.addedBy,
            isDeleted: this.isDeleted
        };
    }
    updateScore(newScore: number, newEvidence: string, updatedBy: AddedBy): void {
        if (newScore < 1 || newScore > 10) {
            throw new Error('Score must be between 1 and 10');
        }
        this.score = newScore;
        this.evidence = newEvidence;
        this.addedBy = updatedBy;
        this.addedAt = new Date();
    }
    updateEvidence(newEvidence: string, updatedBy: AddedBy): void {
        this.evidence = newEvidence;
        this.addedBy = updatedBy;
        this.addedAt = new Date();
    }
    isAboveThreshold(threshold: number): boolean {
        return this.score >= threshold;
    }
    getSkillLevel(): string {
        if (this.score >= 9) return 'Expert';
        if (this.score >= 7) return 'Advanced';
        if (this.score >= 4) return 'Intermediate';
        return 'Beginner';
    }
    toString(): string {
        return `Skill ${this.skillId}: ${this.score}/10 (${this.getSkillLevel()}) - Added by ${this.addedBy}`;
    }
}
export interface SkillData {
    candidateSkillId: string;
    skillId: string;              // Foreign key to skills_master collection
    evidence: string;
    score: number;               // 1-10 proficiency level
    addedAt: Date;
    addedBy: AddedBy;            // Who added this skill
    isDeleted: boolean;          // Soft deletion flag
}
export interface CreateSkillData {
    skillName: string;          // Will be resolved to skillId
    evidence: string;
    score: number;             // 1-10
    addedBy: AddedBy;
}
export interface SkillWithMasterData extends SkillData {
    skillName: string;          // From skills_master join
    isAccepted: boolean;        // From skills_master join
}
export interface BulkSkillData {
    skillName: string;
    evidence: string;
    score: number;
    addedBy: AddedBy;
    confidence?: number;        // AI parser confidence (0-1)
}
