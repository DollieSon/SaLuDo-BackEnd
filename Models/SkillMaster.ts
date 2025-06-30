import { ObjectId } from 'mongodb';
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
    static fromObject(obj: SkillMasterData): SkillMaster {
        return new SkillMaster(
            obj.skillId,
            obj.skillName,
            obj.createdAt,
            obj.updatedAt,
            obj.isAccepted
        );
    }
    toObject(): SkillMasterData {
        return {
            skillId: this.skillId,
            skillName: this.skillName,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            isAccepted: this.isAccepted
        };
    }
    updateSkillName(newName: string): void {
        this.skillName = newName.trim();
        this.updatedAt = new Date();
    }
    approve(): void {
        this.isAccepted = true;
        this.updatedAt = new Date();
    }
    static normalizeSkillName(skillName: string): string {
        return skillName.trim().toLowerCase();
    }
    static validateSkillName(skillName: string): boolean {
        const trimmed = skillName.trim();
        return trimmed.length > 0 && trimmed.length <= 100;
    }
}
export interface SkillMasterData {
    skillId: string;
    skillName: string;
    createdAt: Date;
    updatedAt: Date;
    isAccepted: boolean;
}
export interface CreateSkillMasterData {
    skillName: string;
}
