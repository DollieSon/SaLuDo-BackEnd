/**
 * Experience class that's lowkey the resume's main character 
 * This is where we keep all the career tea and work history vibes
 * Like literally storing their whole professional glow-up journey fr
 */
export class Experience {
    public experienceId: string;
    public title: string;
    public role: string;
    public description?: string;
    public createdAt: Date;
    public updatedAt: Date;

    constructor(
        experienceId: string,
        title: string,
        role: string,
        description?: string,
        createdAt?: Date,
        updatedAt?: Date
    ) {
        this.experienceId = experienceId;
        this.title = title;
        this.role = role;
        this.description = description;
        this.createdAt = createdAt || new Date();
        this.updatedAt = updatedAt || new Date();
    }

    /**
     * Creates a new Experience instance from a plain object
     * Manufacturing work experience out of thin air, we love to see it 
     */
    static fromObject(obj: any): Experience {
        return new Experience(
            obj.experienceId,
            obj.title,
            obj.role,
            obj.description,
            obj.createdAt ? new Date(obj.createdAt) : undefined,
            obj.updatedAt ? new Date(obj.updatedAt) : undefined
        );
    }

    /**
     * Converts the Experience instance to a plain object
     * Flattening this bad boy like a pancake for that JSON life 
     */
    toObject(): ExperienceData {
        return {
            experienceId: this.experienceId,
            title: this.title,
            role: this.role,
            description: this.description,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Updates the experience details
     * Time for a career glow-up bestie! 
     */
    updateExperience(title?: string, role?: string, description?: string): void {
        if (title !== undefined) this.title = title;
        if (role !== undefined) this.role = role;
        if (description !== undefined) this.description = description;
        this.updatedAt = new Date();
    }

    /**
     * Updates only the description
     * Just vibes and descriptions, nothing else bestie 
     */
    updateDescription(newDescription: string): void {
        this.description = newDescription;
        this.updatedAt = new Date();
    }

    /**
     * Returns a string representation of the experience
     * This method is literally the experience's elevator pitch
     */
    toString(): string {
        const desc = this.description ? ` - ${this.description.substring(0, 50)}...` : '';
        return `${this.title} (${this.role})${desc}`;
    }

    /**
     * Checks if the experience has a description
     * Does this experience have something to say or is it giving silent treatment? 
     */
    hasDescription(): boolean {
        return this.description !== undefined && this.description.trim().length > 0;
    }

    /**
     * Gets the duration since creation in days
     * How long has this experience been living rent-free in our database? 
     */
    getDaysSinceCreated(): number {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
}

/**
 * Interface for Experience data transfer
 * The blueprint for sharing experience vibes across the app 
 */
export interface ExperienceData {
    experienceId: string;
    title: string;
    role: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Interface for creating a new experience
 * For when you need to manifest some work experience into existence 
 */
export interface CreateExperienceData {
    title: string;
    role: string;
    description?: string;
}

/**
 * Interface for updating an existing experience
 * When your experience needs a little glow-up, we got you covered bestie 
 */
export interface UpdateExperienceData {
    title?: string;
    role?: string;
    description?: string;
}
