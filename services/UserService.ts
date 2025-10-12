// =======================
// USER SERVICE
// =======================
// Purpose: Business logic for user management, admin account creation, and security enforcement
// Related: User model, UserRepository
// =======================

import { User, UserRole } from '../Models/User';
import { UserRepository } from '../repositories/UserRepository';

export class UserService {
  private userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  // Admin-only: Create a new user account
  async createUserAsAdmin(userData: {
    email: string;
    password: string; // hashed password
    firstName: string;
    lastName: string;
    title: string;
    role: UserRole;
    middleName?: string;
  }): Promise<User> {
    if (!userData.role) {
      throw new Error('Role is required for new user');
    }
    // Create user data - repository will handle setting default security fields
    const createData = {
      ...userData,
    };
    const userObj = await this.userRepository.createUser(createData);
    return User.fromObject(userObj);
  }

  // Admin-only: Reset user password and require change on next login
  async resetUserPassword(userId: string, newPassword: string): Promise<void> {
    await this.userRepository.updateUser(userId, {
      passwordHash: newPassword, // hashed password
      mustChangePassword: true,
      passwordChangedAt: new Date(),
    });
  }

  // Get user profile
  async getUserProfile(userId: string): Promise<User | null> {
    const userObj = await this.userRepository.getUserById(userId);
    return userObj ? User.fromObject(userObj) : null;
  }

  // Get all users with pagination and filtering (Admin only)
  async getAllUsers(options: {
    page?: number;
    limit?: number;
    role?: any;
    isActive?: boolean;
    search?: string;
  } = {}): Promise<{
    users: User[];
    totalCount: number;
    page: number;
    totalPages: number;
  }> {
    const result = await this.userRepository.findAllPaginated(options);
    return {
      ...result,
      users: result.users.map(userData => User.fromObject(userData))
    };
  }

  // Activate/deactivate user
  async setUserActiveStatus(userId: string, isActive: boolean): Promise<void> {
    await this.userRepository.updateUser(userId, { isActive });
  }

  // Soft delete user
  async softDeleteUser(userId: string): Promise<void> {
    await this.userRepository.delete(userId);
  }
}
