import { User, IUser } from '../models/User';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { authService } from './authService';
import { PaginatedResult } from '../types/common';

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'worker';
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  role?: 'admin' | 'worker';
  active?: boolean;
}

export const userService = {
  /**
   * Get paginated list of users (excluding password_hash).
   */
  async getUsers(page = 1, limit = 20, search?: string): Promise<PaginatedResult<any>> {
    const query: Record<string, unknown> = {};

    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ];
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      User.find(query)
        .select('-password_hash')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Get a single user by ID.
   */
  async getUserById(userId: string) {
    const user = await User.findById(userId).select('-password_hash').lean();
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  },

  /**
   * Create a new user (admin action).
   */
  async createUser(data: CreateUserDTO) {
    if (!data.name || data.name.trim().length < 2) {
      throw new ValidationError('Name must be at least 2 characters');
    }

    if (!data.email || data.email.trim().length === 0) {
      throw new ValidationError('Email is required');
    }

    if (!data.password || data.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }

    const existing = await User.findOne({ email: data.email.toLowerCase().trim() });
    if (existing) {
      throw new ValidationError('An account with this email already exists');
    }

    const user = new User({
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      password_hash: data.password, // Pre-save hook hashes it
      role: data.role || 'worker',
    });
    await user.save();

    const { password_hash, ...userPublic } = user.toObject();
    return userPublic;
  },

  /**
   * Update a user (admin action).
   */
  async updateUser(userId: string, data: UpdateUserDTO) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (data.name !== undefined) {
      if (data.name.trim().length < 2) {
        throw new ValidationError('Name must be at least 2 characters');
      }
      user.name = data.name.trim();
    }

    if (data.email !== undefined) {
      const existing = await User.findOne({
        email: data.email.toLowerCase().trim(),
        _id: { $ne: userId },
      });
      if (existing) {
        throw new ValidationError('An account with this email already exists');
      }
      user.email = data.email.toLowerCase().trim();
    }

    if (data.role !== undefined) {
      user.role = data.role;
    }

    if (data.active !== undefined) {
      user.active = data.active;
      // If deactivating, revoke all refresh tokens
      if (!data.active) {
        await authService.revokeAllUserTokens(userId);
      }
    }

    await user.save();

    const { password_hash, ...userPublic } = user.toObject();
    return userPublic;
  },

  /**
   * Reset a user's password (admin action).
   */
  async resetPassword(userId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    user.password_hash = newPassword; // Pre-save hook hashes it
    user.failed_login_attempts = 0;
    user.locked_until = undefined;
    await user.save();

    // Revoke all refresh tokens
    await authService.revokeAllUserTokens(userId);
  },
};
