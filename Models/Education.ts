export class Education {
    public educationId: string;
    public institution: string;
    public startDate: Date;
    public endDate?: Date;
    public description?: string;
    public isDeleted: boolean;
    public createdAt: Date;
    public updatedAt: Date;
    constructor(
        educationId: string,
        institution: string,
        startDate: Date,
        endDate?: Date,
        description?: string,
        isDeleted?: boolean,
        createdAt?: Date,
        updatedAt?: Date
    ) {
        this.educationId = educationId;
        this.institution = institution;
        this.startDate = startDate;
        this.endDate = endDate;
        this.description = description;
        this.isDeleted = isDeleted || false;
        this.createdAt = createdAt || new Date();
        this.updatedAt = updatedAt || new Date();
    }
    static fromObject(obj: any): Education {
        return new Education(
            obj.educationId,
            obj.institution,
            new Date(obj.startDate),
            obj.endDate ? new Date(obj.endDate) : undefined,
            obj.description,
            obj.isDeleted || false,
            obj.createdAt ? new Date(obj.createdAt) : undefined,
            obj.updatedAt ? new Date(obj.updatedAt) : undefined
        );
    }
    toObject(): EducationData {
        return {
            educationId: this.educationId,
            institution: this.institution,
            startDate: this.startDate,
            endDate: this.endDate,
            description: this.description,
            isDeleted: this.isDeleted,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
    isOngoing(): boolean {
        return this.endDate === undefined;
    }
    toString(): string {
        const status = this.isOngoing() ? 'Ongoing' : `Completed ${this.endDate?.getFullYear()}`;
        return `Education at ${this.institution} (${status})`;
    }
}
export interface EducationData {
    educationId: string;
    institution: string;
    startDate: Date;
    endDate?: Date;
    description?: string;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateEducationData {
    institution: string;
    startDate: Date;
    endDate?: Date;
    description?: string;
}
