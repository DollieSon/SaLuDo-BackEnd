/**
 * StrengthWeakness class that's spilling all the personality tea
 * This is where we keep track of what makes candidates slay and what doesn't
 * Like literally documenting their whole character arc bestie
 */
export class StrengthWeakness {
    public strengthWeaknessId: string;
    public name: string;
    public description: string;
    public type: 'Strength' | 'Weakness';
    public createdAt: Date;
    public updatedAt: Date;

    constructor(
        strengthWeaknessId: string,
        name: string,
        description: string,
        type: 'Strength' | 'Weakness',
        createdAt?: Date,
        updatedAt?: Date
    ) {
        this.strengthWeaknessId = strengthWeaknessId;
        this.name = name;
        this.description = description;
        this.type = type;
        this.createdAt = createdAt || new Date();
        this.updatedAt = updatedAt || new Date();
    }

    /**
     * Creates a new StrengthWeakness instance from a plain object
     * Turning raw personality data into structured vibes
     */
    static fromObject(obj: any): StrengthWeakness {
        return new StrengthWeakness(
            obj.strengthWeaknessId,
            obj.name,
            obj.description,
            obj.type,
            obj.createdAt ? new Date(obj.createdAt) : undefined,
            obj.updatedAt ? new Date(obj.updatedAt) : undefined
        );
    }

    /**
     * Converts the StrengthWeakness instance to a plain object
     * Flattening the personality vibes for that JSON lifestyle
     */
    toObject(): StrengthWeaknessData {
        return {
            strengthWeaknessId: this.strengthWeaknessId,
            name: this.name,
            description: this.description,
            type: this.type,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Updates the strength/weakness details
     * Time for a personality glow-up or reality check bestie
     */
    updateDetails(name?: string, description?: string, type?: 'Strength' | 'Weakness'): void {
        if (name !== undefined) this.name = name;
        if (description !== undefined) this.description = description;
        if (type !== undefined) this.type = type;
        this.updatedAt = new Date();
    }

    /**
     * Updates only the description
     * Just changing the vibes description, nothing else bestie
     */
    updateDescription(newDescription: string): void {
        this.description = newDescription;
        this.updatedAt = new Date();
    }

    /**
     * Updates only the name
     * Giving this trait a rebrand moment
     */
    updateName(newName: string): void {
        this.name = newName;
        this.updatedAt = new Date();
    }

    /**
     * Updates only the type
     * Plot twist! This trait just switched sides
     */
    updateType(newType: 'Strength' | 'Weakness'): void {
        this.type = newType;
        this.updatedAt = new Date();
    }

    /**
     * Returns a string representation of the strength/weakness
     * This method is giving personality summary energy
     */
    toString(): string {
        const truncatedDesc = this.description.length > 50 
            ? this.description.substring(0, 50) + '...' 
            : this.description;
        return `${this.type}: ${this.name} - ${truncatedDesc}`;
    }

    /**
     * Checks if this is a strength
     * Is this trait giving main character energy?
     */
    isStrength(): boolean {
        return this.type === 'Strength';
    }

    /**
     * Checks if this is a weakness
     * Is this trait giving villain arc vibes?
     */
    isWeakness(): boolean {
        return this.type === 'Weakness';
    }

    /**
     * Gets the duration since creation in days
     * How long has this personality trait been living in our database?
     */
    getDaysSinceCreated(): number {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
}

/**
 * Interface for StrengthWeakness data transfer
 * The blueprint for sharing personality vibes across the app
 */
export interface StrengthWeaknessData {
    strengthWeaknessId: string;
    name: string;
    description: string;
    type: 'Strength' | 'Weakness';
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Interface for creating a new strength/weakness
 * For when you need to birth some personality traits into existence
 */
export interface CreateStrengthWeaknessData {
    name: string;
    description: string;
    type: 'Strength' | 'Weakness';
}

/**
 * Interface for updating an existing strength/weakness
 * When your personality traits need a little character development
 */
export interface UpdateStrengthWeaknessData {
    name?: string;
    description?: string;
    type?: 'Strength' | 'Weakness';
}
