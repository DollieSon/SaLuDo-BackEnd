import { 
    Trait, 
    CreateTraitData, 
    PersonalityData, 
    PersonalitySummary 
} from './PersonalityTypes';
import { 
    PERSONALITY_CATEGORIES, 
    PERSONALITY_SUB_CATEGORIES,
    PERSONALITY_DEFAULTS 
} from './PersonalityConstants';
// Re-export for backward compatibility
export type { Trait, CreateTraitData, PersonalityData, PersonalitySummary };
export { PERSONALITY_CATEGORIES, PERSONALITY_SUB_CATEGORIES, PERSONALITY_DEFAULTS };
export class Personality {
    // Cognitive & Problem-Solving Traits
    public cognitiveAndProblemSolving: {
        analyticalThinking: Trait;
        curiosity: Trait;
        creativity: Trait;
        attentionToDetail: Trait;
        criticalThinking: Trait;
        resourcefulness: Trait;
    };
    // Communication & Teamwork Traits
    public communicationAndTeamwork: {
        clearCommunication: Trait;
        activeListening: Trait;
        collaboration: Trait;
        empathy: Trait;
        conflictResolution: Trait;
    };
    // Work Ethic & Reliability Traits
    public workEthicAndReliability: {
        dependability: Trait;
        accountability: Trait;
        persistence: Trait;
        timeManagement: Trait;
        organization: Trait;
    };
    // Growth & Leadership Traits
    public growthAndLeadership: {
        initiative: Trait;
        selfMotivation: Trait;
        leadership: Trait;
        adaptability: Trait;
        coachability: Trait;
    };
    // Culture & Personality Fit Traits
    public cultureAndPersonalityFit: {
        positiveAttitude: Trait;
        humility: Trait;
        confidence: Trait;
        integrity: Trait;
        professionalism: Trait;
        openMindedness: Trait;
        enthusiasm: Trait;
    };
    // Bonus Traits
    public bonusTraits: {
        customerFocus: Trait;
        visionaryThinking: Trait;
        culturalAwareness: Trait;
        senseOfHumor: Trait;
        grit: Trait;
    };
    constructor(personalityData?: PersonalityData) {
        if (personalityData) {
            console.log('=== DEBUG: Personality constructor with data ===');
            console.log('Data type:', typeof personalityData);
            console.log('Data keys:', Object.keys(personalityData || {}));
            
            // Validate that personalityData has the required structure
            if (!personalityData.cognitiveAndProblemSolving || 
                !personalityData.communicationAndTeamwork ||
                !personalityData.workEthicAndReliability ||
                !personalityData.growthAndLeadership ||
                !personalityData.cultureAndPersonalityFit ||
                !personalityData.bonusTraits) {
                console.error('=== DEBUG: Invalid personality data structure ===');
                console.error('Missing categories in personalityData:', {
                    cognitiveAndProblemSolving: !!personalityData.cognitiveAndProblemSolving,
                    communicationAndTeamwork: !!personalityData.communicationAndTeamwork,
                    workEthicAndReliability: !!personalityData.workEthicAndReliability,
                    growthAndLeadership: !!personalityData.growthAndLeadership,
                    cultureAndPersonalityFit: !!personalityData.cultureAndPersonalityFit,
                    bonusTraits: !!personalityData.bonusTraits
                });
                throw new Error('Invalid personality data structure: missing required categories');
            }
            
            // Initialize from provided data with validation
            this.cognitiveAndProblemSolving = this.validateAndProcessCategory(
                personalityData.cognitiveAndProblemSolving, 
                'cognitiveAndProblemSolving'
            );
            this.communicationAndTeamwork = this.validateAndProcessCategory(
                personalityData.communicationAndTeamwork, 
                'communicationAndTeamwork'
            );
            this.workEthicAndReliability = this.validateAndProcessCategory(
                personalityData.workEthicAndReliability, 
                'workEthicAndReliability'
            );
            this.growthAndLeadership = this.validateAndProcessCategory(
                personalityData.growthAndLeadership, 
                'growthAndLeadership'
            );
            this.cultureAndPersonalityFit = this.validateAndProcessCategory(
                personalityData.cultureAndPersonalityFit, 
                'cultureAndPersonalityFit'
            );
            this.bonusTraits = this.validateAndProcessCategory(
                personalityData.bonusTraits, 
                'bonusTraits'
            );
            
            console.log('=== DEBUG: Personality constructor completed successfully ===');
        } else {
            // Initialize all traits with default empty values for new candidates
            this.cognitiveAndProblemSolving = {
                analyticalThinking: this.createEmptyTrait('Analytical Thinking'),
                curiosity: this.createEmptyTrait('Curiosity'),
                creativity: this.createEmptyTrait('Creativity'),
                attentionToDetail: this.createEmptyTrait('Attention to Detail'),
                criticalThinking: this.createEmptyTrait('Critical Thinking'),
                resourcefulness: this.createEmptyTrait('Resourcefulness')
            };
            this.communicationAndTeamwork = {
                clearCommunication: this.createEmptyTrait('Clear Communication'),
                activeListening: this.createEmptyTrait('Active Listening'),
                collaboration: this.createEmptyTrait('Collaboration'),
                empathy: this.createEmptyTrait('Empathy'),
                conflictResolution: this.createEmptyTrait('Conflict Resolution')
            };
            this.workEthicAndReliability = {
                dependability: this.createEmptyTrait('Dependability'),
                accountability: this.createEmptyTrait('Accountability'),
                persistence: this.createEmptyTrait('Persistence'),
                timeManagement: this.createEmptyTrait('Time Management'),
                organization: this.createEmptyTrait('Organization')
            };
            this.growthAndLeadership = {
                initiative: this.createEmptyTrait('Initiative'),
                selfMotivation: this.createEmptyTrait('Self-Motivation'),
                leadership: this.createEmptyTrait('Leadership'),
                adaptability: this.createEmptyTrait('Adaptability'),
                coachability: this.createEmptyTrait('Coachability')
            };
            this.cultureAndPersonalityFit = {
                positiveAttitude: this.createEmptyTrait('Positive Attitude'),
                humility: this.createEmptyTrait('Humility'),
                confidence: this.createEmptyTrait('Confidence'),
                integrity: this.createEmptyTrait('Integrity'),
                professionalism: this.createEmptyTrait('Professionalism'),
                openMindedness: this.createEmptyTrait('Open-Mindedness'),
                enthusiasm: this.createEmptyTrait('Enthusiasm')
            };
            this.bonusTraits = {
                customerFocus: this.createEmptyTrait('Customer Focus'),
                visionaryThinking: this.createEmptyTrait('Visionary Thinking'),
                culturalAwareness: this.createEmptyTrait('Cultural Awareness'),
                senseOfHumor: this.createEmptyTrait('Sense of Humor'),
                grit: this.createEmptyTrait('Grit')
            };
        }
    }
    // =======================
    // UTILITY METHODS
    // =======================
    private createEmptyTrait(traitName: string): Trait {
        return {
            traitName,
            score: PERSONALITY_DEFAULTS.SCORE,
            evidence: PERSONALITY_DEFAULTS.EVIDENCE,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }
    getCategories(): string[] {
        return [...PERSONALITY_CATEGORIES];
    }
    getSubCategories(category?: string): string[] | Record<string, string[]> {
        if (category) {
            return [...(PERSONALITY_SUB_CATEGORIES[category as keyof typeof PERSONALITY_SUB_CATEGORIES] || [])];
        }
        return PERSONALITY_SUB_CATEGORIES;
    }
    updateTrait(category: string, subCategory: string, traitData: Partial<CreateTraitData>): boolean {
        const trait = this.getTrait(category, subCategory);
        if (!trait) return false;
        
        // Validate score range for personality traits (0.0-10.0)
        if (traitData.score !== undefined) {
            if (traitData.score < 0.0 || traitData.score > 10.0) {
                throw new Error('Personality trait score must be between 0.0 and 10.0');
            }
            trait.score = traitData.score;
        }
        
        if (traitData.evidence !== undefined) trait.evidence = traitData.evidence;
        if (traitData.traitName !== undefined) trait.traitName = traitData.traitName;
        trait.updatedAt = new Date();
        return true;
    }
    getTrait(category: string, subCategory: string): Trait | null {
        const categoryMap = this.getCategoryMap();
        const categoryObj = categoryMap[category];
        if (!categoryObj) return null;
        const subCategoryKey = this.getSubCategoryKey(subCategory);
        return categoryObj[subCategoryKey] || null;
    }
    getTraitsByCategory(category: string): Record<string, Trait> | null {
        const categoryMap = this.getCategoryMap();
        return categoryMap[category] || null;
    }
    getCategoryAverageScore(category: string): number {
        const traits = this.getTraitsByCategory(category);
        if (!traits) return 0;
        const traitValues = Object.values(traits);
        const scoredTraits = traitValues.filter(trait => trait.score > 0);
        if (scoredTraits.length === 0) return 0;
        const totalScore = scoredTraits.reduce((sum, trait) => sum + trait.score, 0);
        return Math.round((totalScore / scoredTraits.length) * 100) / 100; // Round to 2 decimals
    }
    getOverallPersonalityScore(): number {
        const categories = this.getCategories();
        const categoryScores = categories.map(cat => this.getCategoryAverageScore(cat));
        const validScores = categoryScores.filter(score => score > 0);
        if (validScores.length === 0) return 0;
        const totalScore = validScores.reduce((sum, score) => sum + score, 0);
        return Math.round((totalScore / validScores.length) * 100) / 100;
    }
    getCompletionPercentage(): number {
        const allTraits = this.getAllTraits();
        const totalTraits = allTraits.length;
        const completedTraits = allTraits.filter(trait => trait.score > 0).length;
        return Math.round((completedTraits / totalTraits) * 100);
    }
    getTopStrengths(count: number = PERSONALITY_DEFAULTS.DEFAULT_TOP_TRAITS_COUNT): Trait[] {
        const allTraits = this.getAllTraits()
            .filter(trait => trait.score > 0)
            .sort((a, b) => b.score - a.score);
        return allTraits.slice(0, count);
    }
    getAreasForImprovement(count: number = PERSONALITY_DEFAULTS.DEFAULT_IMPROVEMENT_AREAS_COUNT): Trait[] {
        const allTraits = this.getAllTraits()
            .filter(trait => trait.score > 0)
            .sort((a, b) => a.score - b.score);
        return allTraits.slice(0, count);
    }
    findTraitsByScore(minScore: number, maxScore: number = 10.0): Trait[] {
        return this.getAllTraits().filter(trait => 
            trait.score >= minScore && trait.score <= maxScore
        );
    }
    getRecentlyUpdatedTraits(days: number = PERSONALITY_DEFAULTS.DEFAULT_RECENT_DAYS): Trait[] {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        return this.getAllTraits().filter(trait => 
            trait.updatedAt > cutoffDate && trait.score > 0
        );
    }
    toObject(): PersonalityData {
        return {
            cognitiveAndProblemSolving: this.cognitiveAndProblemSolving,
            communicationAndTeamwork: this.communicationAndTeamwork,
            workEthicAndReliability: this.workEthicAndReliability,
            growthAndLeadership: this.growthAndLeadership,
            cultureAndPersonalityFit: this.cultureAndPersonalityFit,
            bonusTraits: this.bonusTraits
        };
    }
    static fromObject(data: PersonalityData): Personality {
        const personality = new Personality();
        if (data.cognitiveAndProblemSolving) {
            Object.assign(personality.cognitiveAndProblemSolving, data.cognitiveAndProblemSolving);
        }
        if (data.communicationAndTeamwork) {
            Object.assign(personality.communicationAndTeamwork, data.communicationAndTeamwork);
        }
        if (data.workEthicAndReliability) {
            Object.assign(personality.workEthicAndReliability, data.workEthicAndReliability);
        }
        if (data.growthAndLeadership) {
            Object.assign(personality.growthAndLeadership, data.growthAndLeadership);
        }
        if (data.cultureAndPersonalityFit) {
            Object.assign(personality.cultureAndPersonalityFit, data.cultureAndPersonalityFit);
        }
        if (data.bonusTraits) {
            Object.assign(personality.bonusTraits, data.bonusTraits);
        }
        return personality;
    }
    // =======================
    // PRIVATE HELPER METHODS
    // =======================
    private getCategoryMap(): Record<string, any> {
        return {
            'Cognitive & Problem-Solving Traits': this.cognitiveAndProblemSolving,
            'Communication & Teamwork Traits': this.communicationAndTeamwork,
            'Work Ethic & Reliability Traits': this.workEthicAndReliability,
            'Growth & Leadership Traits': this.growthAndLeadership,
            'Culture & Personality Fit Traits': this.cultureAndPersonalityFit,
            'Bonus Traits': this.bonusTraits
        };
    }
    private getSubCategoryKey(subCategory: string): string {
        // Convert "Sub Category Name" to "subCategoryName"
        return subCategory
            .split(/[\s&-]+/) // ILOOOOVEREGEX :O mam dean reference
            .map((word, index) => {
                word = word.toLowerCase();
                return index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join('')
            .replace(/[^a-zA-Z0-9]/g, '');
    }
    private validateAndProcessCategory(categoryData: any, categoryName: string): any {
        console.log(`=== DEBUG: validateAndProcessCategory for ${categoryName} ===`);
        console.log('Input data:', JSON.stringify(categoryData, null, 2));
        
        if (!categoryData || typeof categoryData !== 'object') {
            console.error(`Invalid category data for ${categoryName}:`, categoryData);
            throw new Error(`Invalid category data for ${categoryName}: must be an object`);
        }

        const processedCategory: any = {};
        
        // Get expected traits for this category based on the category name
        const expectedTraits = this.getExpectedTraitsForCategory(categoryName);
        
        for (const traitName of expectedTraits) {
            const traitData = categoryData[traitName];
            
            if (!traitData) {
                console.warn(`Missing trait '${traitName}' in category '${categoryName}'`);
                processedCategory[traitName] = this.createEmptyTrait(this.formatTraitName(traitName));
                continue;
            }
            
            // Validate and process the trait
            try {
                processedCategory[traitName] = this.validateAndProcessTrait(traitData, traitName);
            } catch (error) {
                console.error(`Error processing trait '${traitName}' in category '${categoryName}':`, error);
                processedCategory[traitName] = this.createEmptyTrait(this.formatTraitName(traitName));
            }
        }
        
        console.log(`Processed category ${categoryName}:`, JSON.stringify(processedCategory, null, 2));
        return processedCategory;
    }
    private getExpectedTraitsForCategory(categoryName: string): string[] {
        const traitMap: { [key: string]: string[] } = {
            'cognitiveAndProblemSolving': [
                'analyticalThinking', 'curiosity', 'creativity', 
                'attentionToDetail', 'criticalThinking', 'resourcefulness'
            ],
            'communicationAndTeamwork': [
                'clearCommunication', 'activeListening', 'collaboration', 
                'empathy', 'conflictResolution'
            ],
            'workEthicAndReliability': [
                'dependability', 'accountability', 'persistence', 
                'timeManagement', 'organization'
            ],
            'growthAndLeadership': [
                'initiative', 'selfMotivation', 'leadership', 
                'adaptability', 'coachability'
            ],
            'cultureAndPersonalityFit': [
                'positiveAttitude', 'humility', 'confidence', 
                'integrity', 'professionalism', 'openMindedness', 'enthusiasm'
            ],
            'bonusTraits': [
                'customerFocus', 'visionaryThinking', 'culturalAwareness', 
                'senseOfHumor', 'grit'
            ]
        };
        
        return traitMap[categoryName] || [];
    }
    private validateAndProcessTrait(traitData: any, traitName: string): Trait {
        console.log(`Validating trait '${traitName}':`, traitData);
        
        if (!traitData || typeof traitData !== 'object') {
            throw new Error(`Invalid trait data for '${traitName}': must be an object`);
        }
        
        // Ensure required fields exist and are valid
        const score = typeof traitData.score === 'number' ? traitData.score : 
                     typeof traitData.score === 'string' ? parseFloat(traitData.score) : 0;
        
        // Handle both 'evidence' and 'explanation' for backward compatibility
        const evidence = typeof traitData.evidence === 'string' ? traitData.evidence : 
                        typeof traitData.explanation === 'string' ? traitData.explanation : '';
        
        let createdAt: Date;
        let updatedAt: Date;
        
        if (traitData.createdAt instanceof Date) {
            createdAt = traitData.createdAt;
        } else if (typeof traitData.createdAt === 'string') {
            createdAt = new Date(traitData.createdAt);
        } else if (traitData.dateGenerated instanceof Date) {
            createdAt = traitData.dateGenerated;
        } else if (typeof traitData.dateGenerated === 'string') {
            createdAt = new Date(traitData.dateGenerated);
        } else {
            createdAt = new Date();
        }
        
        if (traitData.updatedAt instanceof Date) {
            updatedAt = traitData.updatedAt;
        } else if (typeof traitData.updatedAt === 'string') {
            updatedAt = new Date(traitData.updatedAt);
        } else {
            updatedAt = new Date();
        }
        
        const validatedTrait: Trait = {
            traitName: this.formatTraitName(traitName),
            score: Math.max(0, Math.min(10, score)), // Clamp between 0-10
            evidence,
            createdAt,
            updatedAt
        };
        
        console.log(`Validated trait '${traitName}':`, validatedTrait);
        return validatedTrait;
    }
    private formatTraitName(traitName: string): string {
        // Convert camelCase to proper display name
        return traitName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }
    private getAllTraits(): Trait[] {
        const allTraits: Trait[] = [];
        const categories = [
            this.cognitiveAndProblemSolving,
            this.communicationAndTeamwork,
            this.workEthicAndReliability,
            this.growthAndLeadership,
            this.cultureAndPersonalityFit,
            this.bonusTraits
        ];
        categories.forEach(category => {
            Object.values(category).forEach(trait => {
                allTraits.push(trait);
            });
        });
        return allTraits;
    }
}
