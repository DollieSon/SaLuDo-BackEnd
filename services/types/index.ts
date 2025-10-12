// =======================
// SERVICE TYPES INDEX
// =======================
// Purpose: Central export file for all service types and interfaces
// Related: All services, types organization
// =======================

// Authentication and Security Types
export * from './AuthenticationTypes';

// AI and Gemini Types
export * from './GeminiTypes';

// Candidate Comparison Types
export * from './ComparisonTypes';

// Common Service Types
export * from './CommonTypes';

// Re-export commonly used external types for convenience
export { UserRole } from '../../Models/User';
export { AuditEventType, AuditSeverity } from '../../repositories/AuditLogRepository';
export { CandidateData } from '../../Models/Candidate';
export { SkillData, SkillWithMasterData } from '../../Models/Skill';
export { PersonalityData } from '../../Models/PersonalityTypes';