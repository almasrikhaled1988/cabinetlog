import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { DecodedToken } from '../types/auth';
import { UnauthorizedError, ForbiddenError } from './errorHandler';

// Augment Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || '';

/**
 * Express middleware that extracts and verifies JWT from Authorization header.
 * Attaches decoded user to request object for downstream handlers.
 *
 * Preconditions:
 * - Request may or may not contain Authorization header
 * - JWT_SECRET environment variable is set
 *
 * Postconditions:
 * - If valid token: req.user is set with { userId, role, iat, exp }, calls next()
 * - If missing/invalid token: passes UnauthorizedError to next(), does not call next() without error
 * - Never modifies request body or query parameters
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(new UnauthorizedError('Missing authorization token'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next(new UnauthorizedError('Malformed authorization header'));
  }

  const token = parts[1];

  try {
    const secret = process.env.JWT_SECRET || JWT_SECRET;
    if (!secret) {
      return next(new UnauthorizedError('Server configuration error'));
    }

    const decoded = jwt.verify(token, secret) as DecodedToken;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Token has expired'));
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new UnauthorizedError('Invalid token'));
    }
    return next(new UnauthorizedError('Token verification failed'));
  }
}

/**
 * Factory function that creates middleware restricting access to specified roles.
 *
 * Preconditions:
 * - authMiddleware has already run (req.user is populated)
 * - roles contains at least one valid role string
 *
 * Postconditions:
 * - If req.user.role is in roles: calls next()
 * - If not: passes ForbiddenError to next()
 * - Does not modify request state
 */
export function requireRole(...roles: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
}
