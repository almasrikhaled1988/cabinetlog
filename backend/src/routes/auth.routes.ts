import { Router } from 'express';
import { loginRateLimiter } from '../middleware/rateLimiter';
import { login, register } from '../controllers/authController';

const router = Router();

// POST /api/auth/login — rate limited to 5 attempts per minute per IP
router.post('/login', loginRateLimiter, login);

// POST /api/auth/register — create a new worker account
router.post('/register', register);

export default router;
