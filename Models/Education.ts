/**
 * Education class that's literally serving academic excellence 
 * This is where we store all the school tea and educational achievements
 * Like bestie, your whole educational journey is about to be documented fr fr
 */
export class Education {
    public educationId: string;
    public institution: string;
    public startDate: Date;
    public endDate?: Date;
    public description?: string;
    public createdAt: Date;
    public updatedAt: Date;

    constructor(
        educationId: string,
        institution: string,
        startDate: Date,
        endDate?: Date,
        description?: string,
        createdAt?: Date,
        updatedAt?: Date
    ) {
        this.educationId = educationId;
        this.institution = institution;
        this.startDate = startDate;
        this.endDate = endDate;
        this.description = description;
        this.createdAt = createdAt || new Date();
        this.updatedAt = updatedAt || new Date();
    }

    /**
     * Creates a new Education instance from a plain object
     * Manifesting some education out of raw data, we love to see it 
     */
    static fromObject(obj: any): Education {
        return new Education(
            obj.educationId,
            obj.institution,
            new Date(obj.startDate),
            obj.endDate ? new Date(obj.endDate) : undefined,
            obj.description,
            obj.createdAt ? new Date(obj.createdAt) : undefined,
            obj.updatedAt ? new Date(obj.updatedAt) : undefined
        );
    }

    /**
     * Converts the Education instance to a plain object
     * Flattening this academic queen for that JSON lifestyle 
     */
    toObject(): EducationData {
        return {
            educationId: this.educationId,
            institution: this.institution,
            startDate: this.startDate,
            endDate: this.endDate,
            description: this.description,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Checks if education is currently ongoing
     * Still hitting the books or did they graduate already? 
     */
    isOngoing(): boolean {
        return this.endDate === undefined;
    }

    /**
     * Returns a string representation of the education
     * This method is giving academic biography vibes 
     */
    toString(): string {
        const status = this.isOngoing() ? 'Ongoing' : `Completed ${this.endDate?.getFullYear()}`;
        return `Education at ${this.institution} (${status})`;
    }
}

/**
 * Interface for Education data transfer
 * The academic flex template that's about to serve looks 
 */
export interface EducationData {
    educationId: string;
    institution: string;
    startDate: Date;
    endDate?: Date;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Interface for creating a new education
 * When you need to birth some academic excellence into the database 
 */
export interface CreateEducationData {
    institution: string;
    startDate: Date;
    endDate?: Date;
    description?: string;
}
