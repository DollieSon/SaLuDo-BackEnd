// =======================
// USER ROLE ENUM
// =======================
// Purpose: Define user roles for HR staff authentication and authorization
// =======================

export enum UserRole {
  ADMIN = "admin",
  HR_MANAGER = "hr_manager",
  HR_USER = "hr_user",
  RECRUITER = "recruiter",
  INTERVIEWER = "interviewer",
}

// =======================
// ROLE HIERARCHY
// =======================
// Higher number = more permissions

export const UserRoleHierarchy: Record<UserRole, number> = {
  [UserRole.ADMIN]: 100,
  [UserRole.HR_MANAGER]: 50,
  [UserRole.HR_USER]: 25,
  [UserRole.RECRUITER]: 25,
  [UserRole.INTERVIEWER]: 10,
};

// =======================
// ROLE PERMISSIONS DOCUMENTATION
// =======================
/**
 * ADMIN (Administrator):
 * - Can view all candidates
 * - Can create users
 * - Can create jobs
 * - Can assign users to candidates
 * - Full system access
 *
 * HR_MANAGER (HR Manager / Manager):
 * - Can view all candidates
 * - Can assign users to candidates
 * - Cannot create users
 * - Cannot create jobs
 *
 * HR_USER (HR User / User):
 * - Can view ONLY candidates assigned to them
 * - Can edit ONLY candidates assigned to them
 * - Cannot view unassigned candidates
 * - Cannot assign users to candidates
 *
 * RECRUITER:
 * - Can view ONLY candidates assigned to them
 * - Can edit ONLY candidates assigned to them
 * - Cannot view unassigned candidates
 * - Cannot assign users to candidates
 *
 * INTERVIEWER:
 * - Can view ONLY candidates assigned to them
 * - Can edit ONLY candidates assigned to them
 * - Cannot view unassigned candidates
 * - Cannot assign users to candidates
 */

// =======================
// HELPER FUNCTIONS
// =======================

export function hasPermission(
  userRole: UserRole,
  requiredRole: UserRole
): boolean {
  return UserRoleHierarchy[userRole] >= UserRoleHierarchy[requiredRole];
}

export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    [UserRole.ADMIN]: "Administrator",
    [UserRole.HR_MANAGER]: "HR Manager",
    [UserRole.HR_USER]: "HR User",
    [UserRole.RECRUITER]: "Recruiter",
    [UserRole.INTERVIEWER]: "Interviewer",
  };
  return roleNames[role];
}
