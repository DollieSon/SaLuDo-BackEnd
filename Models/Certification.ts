/**
 * Certification class that's literally flexing those credentials 
 * This is where we store all the professional badges and certificates
 * Like bestie, your whole credential collection is about to be on display fr
 */
export class Certification {
    public certificationId: string;
    public name: string;
    public issuingOrganization: string;
    public issueDate: Date;
    public description?: string;
    public createdAt: Date;
    public updatedAt: Date;

    constructor(
        certificationId: string,
        name: string,
        issuingOrganization: string,
        issueDate: Date,
        description?: string,
        createdAt?: Date,
        updatedAt?: Date
    ) {
        this.certificationId = certificationId;
        this.name = name;
        this.issuingOrganization = issuingOrganization;
        this.issueDate = issueDate;
        this.description = description;
        this.createdAt = createdAt || new Date();
        this.updatedAt = updatedAt || new Date();
    }

    /**
     * Creates a new Certification instance from a plain object
     * Turning boring data into certified excellence 
     */
    static fromObject(obj: any): Certification {
        return new Certification(
            obj.certificationId,
            obj.name,
            obj.issuingOrganization,
            new Date(obj.issueDate),
            obj.description,
            obj.createdAt ? new Date(obj.createdAt) : undefined,
            obj.updatedAt ? new Date(obj.updatedAt) : undefined
        );
    }

    /**
     * Converts the Certification instance to a plain object
     * Flattening this certified queen for the JSON realm 
     */
    toObject(): CertificationData {
        return {
            certificationId: this.certificationId,
            name: this.name,
            issuingOrganization: this.issuingOrganization,
            issueDate: this.issueDate,
            description: this.description,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Returns a string representation of the certification
     * This method is giving certified flex energy 💪🏆
     */
    toString(): string {
        return `${this.name} by ${this.issuingOrganization}`;
    }
}

/**
 * Interface for Certification data transfer
 * The template for flexing your credentials across the app 
 */
export interface CertificationData {
    certificationId: string;
    name: string;
    issuingOrganization: string;
    issueDate: Date;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Interface for creating a new certification
 * For when you need to manifest some professional credentials 
 */
export interface CreateCertificationData {
    name: string;
    issuingOrganization: string;
    issueDate: Date;
    description?: string;
}
