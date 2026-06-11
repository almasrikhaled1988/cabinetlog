import { Router } from 'express';
import { loginRateLimiter } from '../middleware/rateLimiter';
import { authMiddleware } from '../middleware/auth';
import { login, register, refresh, logout, changePassword, getMe } from '../controllers/authController';

const router = Router();

// POST /api/auth/login — rate limited
router.post('/login', loginRateLimiter, login);

// POST /api/auth/register — create a new worker account
router.post('/register', register);

// POST /api/auth/refresh — refresh access token
router.post('/refresh', refresh);

// POST /api/auth/logout — revoke refresh token
router.post('/logout', authMiddleware, logout);

// POST /api/auth/change-password — change own password
router.post('/change-password', authMiddleware, changePassword);

// GET /api/auth/me — get current user profile
router.get('/me', authMiddleware, getMe);

export default router;
