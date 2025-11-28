import { connectDB } from '../mongo_db';
import { ResumeRepository } from '../repositories/CandidateRepository';
import { StrengthWeakness, CreateStrengthWeaknessData, StrengthWeaknessData } from '../Models/StrengthWeakness';
import { ObjectId } from 'mongodb';
export class StrengthWeaknessService {
    private resumeRepo: ResumeRepository;
    constructor() {
        this.resumeRepo = null as any;
    }
    async init(): Promise<void> {
        const db = await connectDB();
        this.resumeRepo = new ResumeRepository(db);
    }
    async addStrength(candidateId: string, strengthData: any): Promise<void> {
        await this.init();
        try {
            this.validateStrengthWeaknessData(strengthData);
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const strengthId = new ObjectId().toString();
            const addedBy = strengthData.addedBy || 'AI';
            const strength = new StrengthWeakness(
                strengthId,
                strengthData.name,
                strengthData.description,
                'Strength',
                addedBy
            );
            const updatedStrengths = [...resumeData.strengths.map(s => StrengthWeakness.fromObject(s)), strength];
            await this.resumeRepo.update(candidateId, {
                strengths: updatedStrengths.map(s => s.toObject())
            });
        } catch (error) {
            console.error('Error adding strength:', error);
            throw new Error('Failed to add strength');
        }
    }
    async addWeakness(candidateId: string, weaknessData: any): Promise<void> {
        await this.init();
        try {
            this.validateStrengthWeaknessData(weaknessData);
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const weaknessId = new ObjectId().toString();
            const addedBy = weaknessData.addedBy || 'AI';
            const weakness = new StrengthWeakness(
                weaknessId,
                weaknessData.name,
                weaknessData.description,
                'Weakness',
                addedBy
            );
            const updatedWeaknesses = [...resumeData.weaknesses.map(w => StrengthWeakness.fromObject(w)), weakness];
            await this.resumeRepo.update(candidateId, {
                weaknesses: updatedWeaknesses.map(w => w.toObject())
            });
        } catch (error) {
            console.error('Error adding weakness:', error);
            throw new Error('Failed to add weakness');
        }
    }
    async updateStrengthWeakness(
        candidateId: string, 
        strengthWeaknessId: string, 
        updatedData: any,
        type: 'Strength' | 'Weakness'
    ): Promise<void> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const collection = type === 'Strength' ? resumeData.strengths : resumeData.weaknesses;
            const items = collection.map(item => StrengthWeakness.fromObject(item));
            const itemIndex = items.findIndex(item => item.strengthWeaknessId === strengthWeaknessId);
            if (itemIndex === -1) {
                throw new Error(`${type} not found`);
            }
            const item = items[itemIndex];
            if (updatedData.name !== undefined) item.name = updatedData.name || item.description?.substring(0, 50) || 'Unnamed';
            if (updatedData.description) item.description = updatedData.description;
            if (updatedData.type) item.type = updatedData.type;
            if (updatedData.addedBy !== undefined) item.addedBy = updatedData.addedBy;
            item.updatedAt = new Date();
            const updateField = type === 'Strength' ? 'strengths' : 'weaknesses';
            await this.resumeRepo.update(candidateId, {
                [updateField]: items.map(item => item.toObject())
            });
        } catch (error) {
            console.error(`Error updating ${type.toLowerCase()}:`, error);
            throw new Error(`Failed to update ${type.toLowerCase()}`);
        }
    }
    async deleteStrengthWeakness(
        candidateId: string, 
        strengthWeaknessId: string, 
        type: 'Strength' | 'Weakness'
    ): Promise<void> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                throw new Error('Candidate resume data not found');
            }
            const collection = type === 'Strength' ? resumeData.strengths : resumeData.weaknesses;
            const items = collection.map(item => StrengthWeakness.fromObject(item));
            const filteredItems = items.filter(item => item.strengthWeaknessId !== strengthWeaknessId);
            if (filteredItems.length === items.length) {
                throw new Error(`${type} not found`);
            }
            const updateField = type === 'Strength' ? 'strengths' : 'weaknesses';
            await this.resumeRepo.update(candidateId, {
                [updateField]: filteredItems.map(item => item.toObject())
            });
        } catch (error) {
            console.error(`Error deleting ${type.toLowerCase()}:`, error);
            throw new Error(`Failed to delete ${type.toLowerCase()}`);
        }
    }
    async getStrengths(candidateId: string): Promise<StrengthWeakness[]> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                return [];
            }
            return resumeData.strengths.map(s => StrengthWeakness.fromObject(s));
        } catch (error) {
            console.error('Error getting strengths:', error);
            throw new Error('Failed to retrieve strengths');
        }
    }
    async getWeaknesses(candidateId: string): Promise<StrengthWeakness[]> {
        await this.init();
        try {
            const resumeData = await this.resumeRepo.findById(candidateId);
            if (!resumeData) {
                return [];
            }
            return resumeData.weaknesses.map(w => StrengthWeakness.fromObject(w));
        } catch (error) {
            console.error('Error getting weaknesses:', error);
            throw new Error('Failed to retrieve weaknesses');
        }
    }
    async getAllStrengthsWeaknesses(candidateId: string): Promise<{
        strengths: StrengthWeakness[];
        weaknesses: StrengthWeakness[];
    }> {
        await this.init();
        try {
            const [strengths, weaknesses] = await Promise.all([
                this.getStrengths(candidateId),
                this.getWeaknesses(candidateId)
            ]);
            return { strengths, weaknesses };
        } catch (error) {
            console.error('Error getting all strengths and weaknesses:', error);
            throw new Error('Failed to retrieve strengths and weaknesses');
        }
    }
    async analyzeBalance(candidateId: string): Promise<{
        strengthCount: number;
        weaknessCount: number;
        ratio: number;
        balance: 'strength-heavy' | 'weakness-heavy' | 'balanced' | 'insufficient-data';
        recommendations: string[];
    }> {
        await this.init();
        try {
            const { strengths, weaknesses } = await this.getAllStrengthsWeaknesses(candidateId);
            const strengthCount = strengths.length;
            const weaknessCount = weaknesses.length;
            const total = strengthCount + weaknessCount;
            if (total < 3) {
                return {
                    strengthCount,
                    weaknessCount,
                    ratio: 0,
                    balance: 'insufficient-data',
                    recommendations: [
                        'Add more strengths and weaknesses for better analysis',
                        'Aim for at least 3-5 total entries'
                    ]
                };
            }
            const ratio = strengthCount / total;
            let balance: 'strength-heavy' | 'weakness-heavy' | 'balanced';
            const recommendations: string[] = [];
            if (ratio > 0.7) {
                balance = 'strength-heavy';
                recommendations.push(
                    'Consider adding areas for improvement to show self-awareness',
                    'Balance shows confidence but may lack introspection'
                );
            } else if (ratio < 0.4) {
                balance = 'weakness-heavy';
                recommendations.push(
                    'Add more strengths to showcase capabilities',
                    'Focus on positive aspects and achievements'
                );
            } else {
                balance = 'balanced';
                recommendations.push(
                    'Good balance between strengths and areas for improvement',
                    'Shows self-awareness and confidence'
                );
            }
            return {
                strengthCount,
                weaknessCount,
                ratio: Math.round(ratio * 100) / 100,
                balance,
                recommendations
            };
        } catch (error) {
            console.error('Error analyzing balance:', error);
            throw new Error('Failed to analyze strength-weakness balance');
        }
    }
    async categorizeByThemes(candidateId: string): Promise<{
        strengthCategories: Record<string, StrengthWeakness[]>;
        weaknessCategories: Record<string, StrengthWeakness[]>;
    }> {
        await this.init();
        try {
            const { strengths, weaknesses } = await this.getAllStrengthsWeaknesses(candidateId);
            const categories = {
                'Communication': ['communication', 'speaking', 'writing', 'presentation', 'interpersonal'],
                'Leadership': ['leadership', 'management', 'delegation', 'mentoring', 'team'],
                'Technical': ['technical', 'programming', 'coding', 'software', 'technology'],
                'Analytical': ['analytical', 'problem-solving', 'critical thinking', 'analysis', 'logic'],
                'Time Management': ['time management', 'organization', 'planning', 'scheduling', 'productivity'],
                'Creativity': ['creativity', 'innovation', 'creative', 'artistic', 'design'],
                'Adaptability': ['adaptability', 'flexibility', 'change', 'learning', 'growth'],
                'Other': []
            };
            const strengthCategories: Record<string, StrengthWeakness[]> = {};
            const weaknessCategories: Record<string, StrengthWeakness[]> = {};
            // Initialize categories
            Object.keys(categories).forEach(category => {
                strengthCategories[category] = [];
                weaknessCategories[category] = [];
            });
            // Categorize strengths
            strengths.forEach(strength => {
                const category = this.findCategory(strength, categories);
                strengthCategories[category].push(strength);
            });
            // Categorize weaknesses
            weaknesses.forEach(weakness => {
                const category = this.findCategory(weakness, categories);
                weaknessCategories[category].push(weakness);
            });
            return { strengthCategories, weaknessCategories };
        } catch (error) {
            console.error('Error categorizing by themes:', error);
            throw new Error('Failed to categorize strengths and weaknesses');
        }
    }
    async generateDevelopmentPlan(candidateId: string): Promise<{
        priorityWeaknesses: StrengthWeakness[];
        developmentActions: Array<{
            weakness: StrengthWeakness;
            actions: string[];
            timeframe: string;
            resources: string[];
        }>;
    }> {
        await this.init();
        try {
            const weaknesses = await this.getWeaknesses(candidateId);
            // Priority weaknesses (first 3)
            const priorityWeaknesses = weaknesses.slice(0, 3);
            const developmentActions = priorityWeaknesses.map(weakness => ({
                weakness,
                actions: this.generateDevelopmentActions(weakness),
                timeframe: this.estimateTimeframe(weakness),
                resources: this.suggestResources(weakness)
            }));
            return {
                priorityWeaknesses,
                developmentActions
            };
        } catch (error) {
            console.error('Error generating development plan:', error);
            throw new Error('Failed to generate development plan');
        }
    }
    async calculateJobCompatibility(candidateId: string, jobRequirements: string[]): Promise<{
        score: number;
        matchingStrengths: StrengthWeakness[];
        missingStrengths: string[];
        relevantWeaknesses: StrengthWeakness[];
    }> {
        await this.init();
        try {
            const { strengths, weaknesses } = await this.getAllStrengthsWeaknesses(candidateId);
            const matchingStrengths: StrengthWeakness[] = [];
            const missingStrengths: string[] = [];
            const relevantWeaknesses: StrengthWeakness[] = [];
            // Find matching strengths
            jobRequirements.forEach(requirement => {
                const matchingStrength = strengths.find(strength => 
                    strength.name.toLowerCase().includes(requirement.toLowerCase()) ||
                    strength.description.toLowerCase().includes(requirement.toLowerCase())
                );
                if (matchingStrength) {
                    matchingStrengths.push(matchingStrength);
                } else {
                    missingStrengths.push(requirement);
                }
            });
            // Find relevant weaknesses (that might impact job performance)
            relevantWeaknesses.push(...weaknesses.filter(weakness =>
                jobRequirements.some(req => 
                    weakness.name.toLowerCase().includes(req.toLowerCase()) ||
                    weakness.description.toLowerCase().includes(req.toLowerCase())
                )
            ));
            // Calculate score
            const matchPercentage = (matchingStrengths.length / jobRequirements.length) * 100;
            const weaknessPenalty = relevantWeaknesses.length * 10; // 10 points per relevant weakness
            const score = Math.max(0, Math.min(100, matchPercentage - weaknessPenalty));
            return {
                score: Math.round(score),
                matchingStrengths,
                missingStrengths,
                relevantWeaknesses
            };
        } catch (error) {
            console.error('Error calculating job compatibility:', error);
            throw new Error('Failed to calculate job compatibility');
        }
    }
    // Private helper methods
    private validateStrengthWeaknessData(data: CreateStrengthWeaknessData): void {
        // Name can be empty, we'll use description as fallback
        if (!data.name) {
            data.name = data.description?.substring(0, 50) || 'Unnamed';
        }
        if (!data.description || !data.description.trim()) {
            throw new Error('Description is required');
        }
        if (data.name.length > 100) {
            throw new Error('Name must be 100 characters or less');
        }
        if (data.description.length > 500) {
            throw new Error('Description must be 500 characters or less');
        }
    }
    private findCategory(item: StrengthWeakness, categories: Record<string, string[]>): string {
        const itemText = (item.name + ' ' + item.description).toLowerCase();
        for (const [category, keywords] of Object.entries(categories)) {
            if (category === 'Other') continue;
            if (keywords.some(keyword => itemText.includes(keyword))) {
                return category;
            }
        }
        return 'Other';
    }
    private generateDevelopmentActions(weakness: StrengthWeakness): string[] {
        const weaknessText = weakness.name.toLowerCase();
        if (weaknessText.includes('communication')) {
            return [
                'Join a public speaking group like Toastmasters',
                'Practice presentation skills',
                'Take a communication course',
                'Seek feedback on communication style'
            ];
        }
        if (weaknessText.includes('time management')) {
            return [
                'Use time tracking apps',
                'Learn prioritization techniques',
                'Set clear daily goals',
                'Eliminate distractions'
            ];
        }
        if (weaknessText.includes('technical')) {
            return [
                'Take online courses or certifications',
                'Practice with hands-on projects',
                'Find a mentor in the field',
                'Join technical communities'
            ];
        }
        return [
            'Identify specific areas for improvement',
            'Set measurable goals',
            'Seek feedback from colleagues',
            'Practice regularly'
        ];
    }
    private estimateTimeframe(weakness: StrengthWeakness): string {
        const weaknessText = weakness.name.toLowerCase();
        if (weaknessText.includes('technical') || weaknessText.includes('skill')) {
            return '3-6 months';
        }
        if (weaknessText.includes('communication') || weaknessText.includes('leadership')) {
            return '6-12 months';
        }
        return '1-3 months';
    }
    private suggestResources(weakness: StrengthWeakness): string[] {
        const weaknessText = weakness.name.toLowerCase();
        if (weaknessText.includes('communication')) {
            return [
                'Toastmasters International',
                'Communication courses on Coursera',
                'Books: "Crucial Conversations"',
                'Local speaking clubs'
            ];
        }
        if (weaknessText.includes('technical')) {
            return [
                'Online platforms: Udemy, Coursera',
                'Official documentation',
                'GitHub projects',
                'Stack Overflow community'
            ];
        }
        return [
            'Online courses',
            'Books and articles',
            'Professional workshops',
            'Mentorship programs'
        ];
    }
}
