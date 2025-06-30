export const PERSONALITY_CATEGORIES = [
    'Cognitive & Problem-Solving Traits',
    'Communication & Teamwork Traits',
    'Work Ethic & Reliability Traits',
    'Growth & Leadership Traits',
    'Culture & Personality Fit Traits',
    'Bonus Traits'
];
export const PERSONALITY_SUB_CATEGORIES = {
    'Cognitive & Problem-Solving Traits': [
        'Analytical Thinking',
        'Curiosity', 
        'Creativity',
        'Attention to Detail',
        'Critical Thinking',
        'Resourcefulness'
    ],
    'Communication & Teamwork Traits': [
        'Clear Communication',
        'Active Listening',
        'Collaboration',
        'Empathy',
        'Conflict Resolution'
    ],
    'Work Ethic & Reliability Traits': [
        'Dependability',
        'Accountability',
        'Persistence',
        'Time Management',
        'Organization'
    ],
    'Growth & Leadership Traits': [
        'Initiative',
        'Self-Motivation',
        'Leadership',
        'Adaptability',
        'Coachability'
    ],
    'Culture & Personality Fit Traits': [
        'Positive Attitude',
        'Humility',
        'Confidence',
        'Integrity',
        'Professionalism',
        'Open-Mindedness',
        'Enthusiasm'
    ],
    'Bonus Traits': [
        'Customer Focus',
        'Visionary Thinking',
        'Cultural Awareness',
        'Sense of Humor',
        'Grit'
    ]
};
export const SCORE_RANGE = {
    MIN: 0.0,
    MAX: 10.0
} as const;
export const PERSONALITY_DEFAULTS = {
    SCORE: 0.0,
    EVIDENCE: '',
    DEFAULT_TOP_TRAITS_COUNT: 5,
    DEFAULT_IMPROVEMENT_AREAS_COUNT: 5,
    DEFAULT_RECENT_DAYS: 7
} as const;
