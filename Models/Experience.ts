export class Experience {
    public experienceId: string;
    public title: string;
    public role: string;
    public description?: string;
    public isDeleted: boolean;
    public createdAt: Date;
    public updatedAt: Date;
    constructor(
        experienceId: string,
        title: string,
        role: string,
        description?: string,
        isDeleted?: boolean,
        createdAt?: Date,
        updatedAt?: Date
    ) {
        this.experienceId = experienceId;
        this.title = title;
        this.role = role;
        this.description = description;
        this.isDeleted = isDeleted || false;
        this.createdAt = createdAt || new Date();
        this.updatedAt = updatedAt || new Date();
    }
    static fromObject(obj: any): Experience {
        return new Experience(
            obj.experienceId,
            obj.title,
            obj.role,
            obj.description,
            obj.isDeleted || false,
            obj.createdAt ? new Date(obj.createdAt) : undefined,
            obj.updatedAt ? new Date(obj.updatedAt) : undefined
        );
    }
    toObject(): ExperienceData {
        return {
            experienceId: this.experienceId,
            title: this.title,
            role: this.role,
            description: this.description,
            isDeleted: this.isDeleted,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
    updateExperience(title?: string, role?: string, description?: string): void {
        if (title !== undefined) this.title = title;
        if (role !== undefined) this.role = role;
        if (description !== undefined) this.description = description;
        this.updatedAt = new Date();
    }
    updateDescription(newDescription: string): void {
        this.description = newDescription;
        this.updatedAt = new Date();
    }
    toString(): string {
        const desc = this.description ? ` - ${this.description.substring(0, 50)}...` : '';
        return `${this.title} (${this.role})${desc}`;
    }
    hasDescription(): boolean {
        return this.description !== undefined && this.description.trim().length > 0;
    }
    getDaysSinceCreated(): number {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
}
export interface ExperienceData {
    experienceId: string;
    title: string;
    role: string;
    description?: string;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateExperienceData {
    title: string;
    role: string;
    description?: string;
}
export interface UpdateExperienceData {
    title?: string;
    role?: string;
    description?: string;
}
