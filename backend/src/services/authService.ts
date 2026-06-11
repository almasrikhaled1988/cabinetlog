import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { AuthResponse, DecodedToken } from '../types';
import { auditService } from './auditService';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '15m'; // Short-lived access token
const REFRESH_TOKEN_EXPIRES_DAYS = 7;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

export interface AuthResponseWithRefresh extends AuthResponse {
  refreshToken: string;
}

export const authService = {
  /**
   * Authenticate user by email and password.
   * Implements account lockout after MAX_FAILED_ATTEMPTS.
   * Returns JWT access token, refresh token, and public user profile.
   */
  async login(
    email: string,
    password: string,
    ipAddress?: string
  ): Promise<AuthResponseWithRefresh> {
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      throw new InvalidCredentialsError();
    }

    // Check if account is active
    if (user.active === false) {
      throw new AccountDeactivatedError();
    }

    // Check if account is locked
    if (user.locked_until && user.locked_until > new Date()) {
      const minutesLeft = Math.ceil(
        (user.locked_until.getTime() - Date.now()) / (1000 * 60)
      );
      throw new AccountLockedError(minutesLeft);
    }

    // If lock period has expired, reset
    if (user.locked_until && user.locked_until <= new Date()) {
      user.failed_login_attempts = 0;
      user.locked_until = undefined;
      await user.save();
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Increment failed attempts
      user.failed_login_attempts = (user.failed_login_attempts || 0) + 1;

      if (user.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
        user.locked_until = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      }

      await user.save();

      // Audit failed login
      await auditService.log({
        userId: (user._id as string).toString(),
        action: 'login_failed',
        resourceType: 'auth',
        ipAddress,
      });

      throw new InvalidCredentialsError();
    }

    // Reset failed attempts on successful login
    if (user.failed_login_attempts > 0) {
      user.failed_login_attempts = 0;
      user.locked_until = undefined;
      await user.save();
    }

    // Generate access token
    const token = jwt.sign(
      { userId: (user._id as string).toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Generate refresh token
    const refreshTokenValue = crypto.randomBytes(64).toString('hex');
    const refreshExpires = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    );

    await RefreshToken.create({
      user_id: user._id,
      token: refreshTokenValue,
      expires_at: refreshExpires,
    });

    // Audit successful login
    await auditService.log({
      userId: (user._id as string).toString(),
      action: 'login',
      resourceType: 'auth',
      ipAddress,
    });

    return {
      token,
      refreshToken: refreshTokenValue,
      user: {
        _id: user._id as any,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
    };
  },

  /**
   * Refresh an access token using a valid refresh token.
   */
  async refreshAccessToken(refreshTokenValue: string): Promise<{ token: string }> {
    const storedToken = await RefreshToken.findOne({
      token: refreshTokenValue,
      revoked: false,
    });

    if (!storedToken) {
      throw new InvalidRefreshTokenError();
    }

    if (storedToken.expires_at < new Date()) {
      await RefreshToken.deleteOne({ _id: storedToken._id });
      throw new InvalidRefreshTokenError();
    }

    const user = await User.findById(storedToken.user_id);
    if (!user || user.active === false) {
      await RefreshToken.deleteOne({ _id: storedToken._id });
      throw new InvalidRefreshTokenError();
    }

    const token = jwt.sign(
      { userId: (user._id as string).toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return { token };
  },

  /**
   * Revoke a refresh token (logout).
   */
  async revokeRefreshToken(refreshTokenValue: string): Promise<void> {
    await RefreshToken.updateOne(
      { token: refreshTokenValue },
      { revoked: true }
    );
  },

  /**
   * Revoke all refresh tokens for a user (force logout everywhere).
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await RefreshToken.updateMany(
      { user_id: userId, revoked: false },
      { revoked: true }
    );
  },

  /**
   * Hash a plaintext password using bcrypt with cost factor 12.
   */
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  },

  /**
   * Compare a plaintext password against a bcrypt hash.
   */
  async comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  },

  /**
   * Verify and decode a JWT token.
   */
  verifyToken(token: string): DecodedToken | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
      return decoded;
    } catch {
      return null;
    }
  },
};

/**
 * Custom error for invalid credentials.
 */
export class InvalidCredentialsError extends Error {
  statusCode = 401;
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountLockedError extends Error {
  statusCode = 423;
  constructor(minutesLeft: number) {
    super(
      `Account is locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`
    );
    this.name = 'AccountLockedError';
  }
}

export class AccountDeactivatedError extends Error {
  statusCode = 403;
  constructor() {
    super('This account has been deactivated. Contact your administrator.');
    this.name = 'AccountDeactivatedError';
  }
}

export class InvalidRefreshTokenError extends Error {
  statusCode = 401;
  constructor() {
    super('Invalid or expired refresh token');
    this.name = 'InvalidRefreshTokenError';
  }
}
