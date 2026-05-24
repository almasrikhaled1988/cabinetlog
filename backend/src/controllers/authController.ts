import { Request, Response, NextFunction } from 'express';
import { authService, InvalidCredentialsError } from '../services/authService';

/**
 * POST /api/auth/login
 * Authenticate user with email and password.
 * Returns JWT token and user profile.
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || (typeof email === 'string' && email.trim().length === 0)) {
      res.status(400).json({
        error: {
          message: 'Email is required',
          status: 400,
        },
      });
      return;
    }

    if (!password || (typeof password === 'string' && password.trim().length === 0)) {
      res.status(400).json({
        error: {
          message: 'Password is required',
          status: 400,
        },
      });
      return;
    }

    const result = await authService.login(email, password);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({
        error: {
          message: error.message,
          status: 401,
        },
      });
      return;
    }
    next(error);
  }
}

import { User } from '../models/User';

/**
 * POST /api/auth/register
 * Register a new worker account.
 * Returns JWT token and user profile.
 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || (typeof name === 'string' && name.trim().length === 0)) {
      res.status(400).json({ error: { message: 'Name is required', status: 400 } });
      return;
    }

    if (!email || (typeof email === 'string' && email.trim().length === 0)) {
      res.status(400).json({ error: { message: 'Email is required', status: 400 } });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: { message: 'Password must be at least 8 characters', status: 400 } });
      return;
    }

    if (name.trim().length < 2 || name.trim().length > 100) {
      res.status(400).json({ error: { message: 'Name must be between 2 and 100 characters', status: 400 } });
      return;
    }

    // Check if email already exists
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      res.status(409).json({ error: { message: 'An account with this email already exists', status: 409 } });
      return;
    }

    // Create user (role defaults to 'worker', password hashed by pre-save hook)
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password_hash: password,
      role: 'worker',
    });
    await user.save();

    // Auto-login: return token
    const result = await authService.login(email.trim(), password);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
