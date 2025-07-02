export interface Trait {
    traitName: string;
    score: number;           // 0.0-10.0 scale for trait assessment (floating point)
    evidence: string;        // Supporting evidence/notes from interviews
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateTraitData {
    traitName: string;
    score: number;
    evidence: string;
}
export interface PersonalityData {
    cognitiveAndProblemSolving: {
        analyticalThinking: Trait;
        curiosity: Trait;
        creativity: Trait;
        attentionToDetail: Trait;
        criticalThinking: Trait;
        resourcefulness: Trait;
    };
    communicationAndTeamwork: {
        clearCommunication: Trait;
        activeListening: Trait;
        collaboration: Trait;
        empathy: Trait;
        conflictResolution: Trait;
    };
    workEthicAndReliability: {
        dependability: Trait;
        accountability: Trait;
        persistence: Trait;
        timeManagement: Trait;
        organization: Trait;
    };
    growthAndLeadership: {
        initiative: Trait;
        selfMotivation: Trait;
        leadership: Trait;
        adaptability: Trait;
        coachability: Trait;
    };
    cultureAndPersonalityFit: {
        positiveAttitude: Trait;
        humility: Trait;
        confidence: Trait;
        integrity: Trait;
        professionalism: Trait;
        openMindedness: Trait;
        enthusiasm: Trait;
    };
    bonusTraits: {
        customerFocus: Trait;
        visionaryThinking: Trait;
        culturalAwareness: Trait;
        senseOfHumor: Trait;
        grit: Trait;
    };
}
export interface PersonalitySummary {
    overallScore: number;
    completionPercentage: number;
    completedTraitsCount: number;
    totalTraitsCount: number;
    categoryScores: Record<string, number>;
    topStrengths: Trait[];
    areasForImprovement: Trait[];
    lastUpdated: Date;
}
