// =======================
// PROFILE INTERFACES & TYPES
// =======================
// Purpose: Extended profile data structures for user profiles
// =======================

// =======================
// PROFILE PHOTO METADATA
// =======================

export interface ProfilePhotoMetadata {
  fileId: string;              // GridFS file ID
  filename: string;            // Original filename
  contentType: string;         // MIME type (image/jpeg, image/png, image/webp)
  size: number;                // File size in bytes
  uploadedAt: Date;            // Upload timestamp
  thumbnailFileId?: string;    // Optional smaller version for lists/avatars
}

// =======================
// AVAILABILITY STRUCTURE
// =======================

export type AvailabilityStatus = 'available' | 'busy' | 'away';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type TimeSlot = 'morning' | 'afternoon' | 'evening';

export interface Availability {
  status: AvailabilityStatus;           // Current availability status
  daysAvailable: DayOfWeek[];           // Days available for interviews/meetings
  preferredTimeSlots?: TimeSlot[];      // Preferred time slots
  notes?: string;                       // Free-form availability notes
}

// =======================
// ROLE-SPECIFIC DATA
// =======================

export type ExpertiseArea = 'technical' | 'behavioral' | 'leadership' | 'cultural-fit' | 'skills-assessment';
export type InterviewType = 'phone' | 'video' | 'in-person' | 'panel';
export type RecruiterSpecialization = 'software-engineering' | 'marketing' | 'sales' | 'design' | 'operations' | 'executive' | 'general';

export interface RoleSpecificData {
  // For INTERVIEWER role
  expertiseAreas?: ExpertiseArea[];     // Areas of interview expertise
  interviewTypes?: InterviewType[];     // Types of interviews they conduct
  
  // For RECRUITER role
  specializations?: RecruiterSpecialization[];  // Recruitment specializations
  candidatePipelineLimit?: number;              // Max candidates they can handle
  
  // For HR_MANAGER role
  teamSize?: number;                    // Number of team members they manage
  canApproveOffers?: boolean;           // Whether they can approve job offers
}

// =======================
// PROFILE STATS
// =======================

export interface ProfileStats {
  userId: string;
  totalCandidatesAssigned: number;      // Total candidates ever assigned
  activeCandidatesCount: number;        // Currently active candidates
  candidatesHired: number;              // Candidates successfully hired
  candidatesRejected: number;           // Candidates rejected
  interviewsConducted?: number;         // For interviewers
  lastActivityDate?: Date;              // Last profile activity
  accountAge: number;                   // Days since account creation
}

// =======================
// PROFILE ACTIVITY
// =======================

export type ProfileActivityType = 
  | 'profile_updated'
  | 'photo_uploaded'
  | 'photo_deleted'
  | 'availability_updated'
  | 'bio_updated'
  | 'contact_updated';

export interface ProfileActivity {
  activityId: string;
  userId: string;
  activityType: ProfileActivityType;
  fieldChanged?: string;                // Which field was changed
  oldValue?: string;                    // Previous value (if applicable)
  newValue?: string;                    // New value (if applicable)
  timestamp: Date;
  ipAddress?: string;                   // For security tracking
}
