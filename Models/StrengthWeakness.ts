export class StrengthWeakness {
    public strengthWeaknessId: string;
    public name: string;
    public description: string;
    public type: 'Strength' | 'Weakness';
    public addedBy: 'AI' | 'HUMAN';
    public createdAt: Date;
    public updatedAt: Date;
    constructor(
        strengthWeaknessId: string,
        name: string,
        description: string,
        type: 'Strength' | 'Weakness',
        addedBy: 'AI' | 'HUMAN' = 'AI',
        createdAt?: Date,
        updatedAt?: Date
    ) {
        this.strengthWeaknessId = strengthWeaknessId;
        this.name = name;
        this.description = description;
        this.type = type;
        this.addedBy = addedBy;
        this.createdAt = createdAt || new Date();
        this.updatedAt = updatedAt || new Date();
    }
    static fromObject(obj: any): StrengthWeakness {
        return new StrengthWeakness(
            obj.strengthWeaknessId,
            obj.name,
            obj.description,
            obj.type,
            obj.addedBy || 'AI',
            obj.createdAt ? new Date(obj.createdAt) : undefined,
            obj.updatedAt ? new Date(obj.updatedAt) : undefined
        );
    }
    toObject(): StrengthWeaknessData {
        return {
            strengthWeaknessId: this.strengthWeaknessId,
            name: this.name,
            description: this.description,
            type: this.type,
            addedBy: this.addedBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
    updateDetails(name?: string, description?: string, type?: 'Strength' | 'Weakness'): void {
        if (name !== undefined) this.name = name;
        if (description !== undefined) this.description = description;
        if (type !== undefined) this.type = type;
        this.updatedAt = new Date();
    }
    updateDescription(newDescription: string): void {
        this.description = newDescription;
        this.updatedAt = new Date();
    }
    updateName(newName: string): void {
        this.name = newName;
        this.updatedAt = new Date();
    }
    updateType(newType: 'Strength' | 'Weakness'): void {
        this.type = newType;
        this.updatedAt = new Date();
    }
    toString(): string {
        const truncatedDesc = this.description.length > 50 
            ? this.description.substring(0, 50) + '...' 
            : this.description;
        return `${this.type}: ${this.name} - ${truncatedDesc}`;
    }
    isStrength(): boolean {
        return this.type === 'Strength';
    }
    isWeakness(): boolean {
        return this.type === 'Weakness';
    }
    getDaysSinceCreated(): number {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
}
export interface StrengthWeaknessData {
    strengthWeaknessId: string;
    name: string;
    description: string;
    type: 'Strength' | 'Weakness';
    addedBy: 'AI' | 'HUMAN';
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateStrengthWeaknessData {
    name: string;
    description: string;
    type: 'Strength' | 'Weakness';
    addedBy?: 'AI' | 'HUMAN';
}
export interface UpdateStrengthWeaknessData {
    name?: string;
    description?: string;
    type?: 'Strength' | 'Weakness';
}
