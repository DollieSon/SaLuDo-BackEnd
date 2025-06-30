import { ObjectId } from 'mongodb';

/**
 * Skills Master Model - Central repository for all skills
 * This model maintains a normalized list of all skills in the system
 */
export class SkillMaster {
    public skillId: string;
    public skillName: string;
    public createdAt: Date;
    public updatedAt: Date;
    public isAccepted: boolean;

    constructor(
        skillId: string,
        skillName: string,
        createdAt: Date,
        updatedAt: Date,
        isAccepted: boolean = false
    ) {
        this.skillId = skillId;
        this.skillName = skillName;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.isAccepted = isAccepted;
    }

    /**
     * Create a new SkillMaster instance
     */
    static create(skillName: string): SkillMaster {
        const now = new Date();
        return new SkillMaster(
            new ObjectId().toString(),
            skillName.trim(),
            now,
            now,
            false // Default to false, no admin approval needed for now
        );
    }

    /**
     * Create SkillMaster from database object
     */
    static fromObject(obj: SkillMasterData): SkillMaster {
        return new SkillMaster(
            obj.skillId,
            obj.skillName,
            obj.createdAt,
            obj.updatedAt,
            obj.isAccepted
        );
    }

    /**
     * Convert to database object
     */
    toObject(): SkillMasterData {
        return {
            skillId: this.skillId,
            skillName: this.skillName,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            isAccepted: this.isAccepted
        };
    }

    /**
     * Update skill name
     */
    updateSkillName(newName: string): void {
        this.skillName = newName.trim();
        this.updatedAt = new Date();
    }

    /**
     * Mark skill as accepted
     */
    approve(): void {
        this.isAccepted = true;
        this.updatedAt = new Date();
    }

    /**
     * Normalize skill name for searching (lowercase, trimmed)
     */
    static normalizeSkillName(skillName: string): string {
        return skillName.trim().toLowerCase();
    }

    /**
     * Validate skill name
     */
    static validateSkillName(skillName: string): boolean {
        const trimmed = skillName.trim();
        return trimmed.length > 0 && trimmed.length <= 100;
    }
}

/**
 * Interface for SkillMaster data structure
 */
export interface SkillMasterData {
    skillId: string;
    skillName: string;
    createdAt: Date;
    updatedAt: Date;
    isAccepted: boolean;
}

/**
 * Interface for creating new SkillMaster
 */
export interface CreateSkillMasterData {
    skillName: string;
}
