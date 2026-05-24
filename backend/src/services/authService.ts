import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { AuthResponse, DecodedToken } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '8h';

export const authService = {
  /**
   * Authenticate user by email and password.
   * Returns JWT token and public user profile on success.
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      throw new InvalidCredentialsError();
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new InvalidCredentialsError();
    }

    const token = jwt.sign(
      { userId: (user._id as string).toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      token,
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
   * Returns the decoded payload or null if invalid/expired.
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
 * Uses a generic message to avoid revealing which field was wrong.
 */
export class InvalidCredentialsError extends Error {
  statusCode = 401;

  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}
