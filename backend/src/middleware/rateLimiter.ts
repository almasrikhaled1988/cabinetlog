import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * Rate limiter for the login endpoint.
 * Limits each IP to 5 login attempts per 1-minute window.
 * Returns 429 Too Many Requests when the limit is exceeded.
 *
 * Validates: Requirement 11.1
 */
export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    error: 'Too many login attempts. Please try again after 1 minute.',
  },
});

/**
 * Rate limiter for file upload endpoints.
 * Limits each authenticated user to 10 uploads per 1-minute window.
 * Uses the authenticated user's ID as the key (falls back to IP if not authenticated).
 * Returns 429 Too Many Requests when the limit is exceeded.
 *
 * Validates: Requirement 11.2
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 uploads per window per user
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req: Request) => {
    // Use authenticated user ID as key for per-user limiting
    return req.user?.userId || req.ip || 'unknown';
  },
  message: {
    error: 'Too many upload requests. Please try again after 1 minute.',
  },
});
