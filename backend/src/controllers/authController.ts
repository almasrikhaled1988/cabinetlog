import { Request, Response, NextFunction } from 'express';
import {
  authService,
  InvalidCredentialsError,
  AccountLockedError,
  AccountDeactivatedError,
  InvalidRefreshTokenError,
} from '../services/authService';
import { User } from '../models/User';
import { auditService } from '../services/auditService';

/**
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || (typeof email === 'string' && email.trim().length === 0)) {
      res.status(400).json({ error: { message: 'Email is required', status: 400 } });
      return;
    }

    if (!password || (typeof password === 'string' && password.trim().length === 0)) {
      res.status(400).json({ error: { message: 'Password is required', status: 400 } });
      return;
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const result = await authService.login(email, password, ipAddress);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({ error: { message: error.message, status: 401 } });
      return;
    }
    if (error instanceof AccountLockedError) {
      res.status(423).json({ error: { message: error.message, status: 423 } });
      return;
    }
    if (error instanceof AccountDeactivatedError) {
      res.status(403).json({ error: { message: error.message, status: 403 } });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/auth/register
 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password } = req.body;

    if (!name || (typeof name === 'string' && name.trim().length === 0)) {
      res.status(400).json({ error: { message: 'Name is required', status: 400 } });
      return;
    }

    if (!email || (typeof email === 'string' && email.trim().length === 0)) {
      res.status(400).json({ error: { message: 'Email is required', status: 400 } });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      res
        .status(400)
        .json({ error: { message: 'Password must be at least 8 characters', status: 400 } });
      return;
    }

    if (name.trim().length < 2 || name.trim().length > 100) {
      res.status(400).json({
        error: { message: 'Name must be between 2 and 100 characters', status: 400 },
      });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      res.status(409).json({
        error: { message: 'An account with this email already exists', status: 409 },
      });
      return;
    }

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password_hash: password,
      role: 'worker',
    });
    await user.save();

    const ipAddress = req.ip || req.socket.remoteAddress;
    const result = await authService.login(email.trim(), password, ipAddress);

    await auditService.log({
      userId: (user._id as string).toString(),
      action: 'register',
      resourceType: 'auth',
      ipAddress,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/refresh
 */
export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: { message: 'Refresh token is required', status: 400 } });
      return;
    }

    const result = await authService.refreshAccessToken(refreshToken);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof InvalidRefreshTokenError) {
      res.status(401).json({ error: { message: error.message, status: 401 } });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }

    if (req.user) {
      await auditService.log({
        userId: req.user.userId,
        action: 'logout',
        resourceType: 'auth',
        ipAddress: req.ip || req.socket.remoteAddress,
      });
    }

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/change-password
 */
export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: { message: 'Authentication required', status: 401 } });
      return;
    }

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        error: { message: 'Current password and new password are required', status: 400 },
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        error: { message: 'New password must be at least 8 characters', status: 400 },
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: { message: 'User not found', status: 404 } });
      return;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(401).json({ error: { message: 'Current password is incorrect', status: 401 } });
      return;
    }

    user.password_hash = newPassword; // Pre-save hook will hash it
    await user.save();

    // Revoke all existing refresh tokens
    await authService.revokeAllUserTokens(userId);

    await auditService.log({
      userId,
      action: 'password_change',
      resourceType: 'auth',
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: { message: 'Authentication required', status: 401 } });
      return;
    }

    const user = await User.findById(userId).select('-password_hash');
    if (!user) {
      res.status(404).json({ error: { message: 'User not found', status: 404 } });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}
