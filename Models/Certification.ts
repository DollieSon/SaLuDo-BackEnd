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
    toString(): string {
        return `${this.name} by ${this.issuingOrganization}`;
    }
}
export interface CertificationData {
    certificationId: string;
    name: string;
    issuingOrganization: string;
    issueDate: Date;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateCertificationData {
    name: string;
    issuingOrganization: string;
    issueDate: Date;
    description?: string;
}
