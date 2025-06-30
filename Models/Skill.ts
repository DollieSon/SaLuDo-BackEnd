/**
 * Skill class that's absolutely SENDING me 
 * This bad boy holds all the tea on candidate skills fr fr no cap
 * Like literally their whole skillset is about to be exposed bestie
 */
export class Skill {
    public skillId: string;
    public skillName: string;
    public evidenceReason: string;
    public score: number;
    public addedAt: Date;
    public addedBy: 'AI' | 'HR';

    constructor(
        skillId: string,
        skillName: string,
        evidenceReason: string,
        score: number,
        addedBy: 'AI' | 'HR',
        addedAt?: Date
    ) {
        this.skillId = skillId;
        this.skillName = skillName;
        this.evidenceReason = evidenceReason;
        this.score = score;
        this.addedBy = addedBy;
        this.addedAt = addedAt || new Date();

        // Validate score range (can't be cappin' about your skills bestie)
        if (score < 0 || score > 100) {
            throw new Error('Score must be between 0 and 100');
        }
    }

    /**
     * Creates a new Skill instance from a plain object
     * This function is straight up GOATED, no printer just fax
     */
    static fromObject(obj: any): Skill {
        return new Skill(
            obj.skillId,
            obj.skillName,
            obj.evidenceReason,
            obj.score,
            obj.addedBy,
            obj.addedAt ? new Date(obj.addedAt) : undefined
        );
    }

    /**
     * Converts the Skill instance to a plain object
     * Lowkey this is giving JSON energy, periodt
     */
    toObject(): SkillData {
        return {
            skillId: this.skillId,
            skillName: this.skillName,
            evidenceReason: this.evidenceReason,
            score: this.score,
            addedAt: this.addedAt,
            addedBy: this.addedBy
        };
    }

    /**
     * Updates the skill score and evidence
     * When the candidate's skills get a glow up
     */
    updateScore(newScore: number, newEvidence: string, updatedBy: 'AI' | 'HR'): void {
        if (newScore < 0 || newScore > 100) {
            throw new Error('Score must be between 0 and 100');
        }
        
        this.score = newScore;
        this.evidenceReason = newEvidence;
        this.addedBy = updatedBy;
        this.addedAt = new Date();
    }

    /**
     * Returns a string representation of the skill
     * This method is literally giving main character energy
     */
    toString(): string {
        return `${this.skillName}: ${this.score}/100 (Added by ${this.addedBy} on ${this.addedAt.toDateString()})`;
    }

    /**
     * Checks if the skill score is above a certain threshold
     * Is this skill slaying or nah? Let's find out bestie
     */
    isAboveThreshold(threshold: number): boolean {
        return this.score >= threshold;
    }
}

/**
 * Interface for Skill data transfer
 * This interface is the blueprint bestie, no cap
 */
export interface SkillData {
    skillId: string;
    skillName: string;
    evidenceReason: string;
    score: number;
    addedAt: Date;
    addedBy: 'AI' | 'HR';
}

/**
 * Interface for creating a new skill
 * When you need to birth a new skill into existence
 */
export interface CreateSkillData {
    skillName: string;
    evidenceReason: string;
    score: number;
    addedBy: 'AI' | 'HR';
}
