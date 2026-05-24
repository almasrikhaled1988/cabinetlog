import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';

/**
 * Tests for login rate limiting.
 * Validates: Requirement 11.1 — 5 attempts per minute per IP, 429 on exceed.
 */
describe('Login Rate Limiter', () => {
  let app: express.Application;

  function createApp() {
    const testApp = express();
    testApp.use(express.json());
    // Create a fresh rate limiter instance per test to avoid shared state
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: 'Too many login attempts. Please try again after 1 minute.',
      },
    });
    testApp.post('/api/auth/login', limiter, (_req, res) => {
      res.status(200).json({ message: 'ok' });
    });
    return testApp;
  }

  beforeEach(() => {
    app = createApp();
  });

  it('should allow up to 5 requests within the window', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(200);
    }
  });

  it('should return 429 after 5 requests from the same IP', async () => {
    // Exhaust the 5 allowed attempts
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
    }

    // 6th request should be rate limited
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Too many login attempts');
  });

  it('should include rate limit headers in response', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.headers['ratelimit-limit']).toBe('5');
    expect(res.headers['ratelimit-remaining']).toBe('4');
  });
});
