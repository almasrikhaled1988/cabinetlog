import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { User } from '../models/User';
import { authService, InvalidCredentialsError } from './authService';
import app from '../app';

let mongoServer: MongoMemoryServer;

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('authService', () => {
  const testUser = {
    name: 'Test Admin',
    email: 'admin@example.com',
    password_hash: 'securepass123',
    role: 'admin' as const,
  };

  beforeEach(async () => {
    await User.create(testUser);
  });

  describe('login', () => {
    it('should return token and user profile for valid credentials', async () => {
      const result = await authService.login('admin@example.com', 'securepass123');

      expect(result.token).toBeDefined();
      expect(result.user.name).toBe('Test Admin');
      expect(result.user.email).toBe('admin@example.com');
      expect(result.user.role).toBe('admin');
      // Should not include password_hash
      expect((result.user as any).password_hash).toBeUndefined();
    });

    it('should throw InvalidCredentialsError for wrong password', async () => {
      await expect(
        authService.login('admin@example.com', 'wrongpassword')
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw InvalidCredentialsError for non-existent email', async () => {
      await expect(
        authService.login('nonexistent@example.com', 'securepass123')
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('should handle case-insensitive email lookup', async () => {
      const result = await authService.login('ADMIN@EXAMPLE.COM', 'securepass123');
      expect(result.user.email).toBe('admin@example.com');
    });

    it('should include userId and role in JWT payload', async () => {
      const result = await authService.login('admin@example.com', 'securepass123');
      const decoded = jwt.verify(result.token, JWT_SECRET) as any;

      expect(decoded.userId).toBeDefined();
      expect(decoded.role).toBe('admin');
    });

    it('should set JWT expiration to 8 hours', async () => {
      const result = await authService.login('admin@example.com', 'securepass123');
      const decoded = jwt.verify(result.token, JWT_SECRET) as any;

      const expectedExpiry = decoded.iat + 8 * 60 * 60; // 8 hours in seconds
      expect(decoded.exp).toBe(expectedExpiry);
    });
  });

  describe('hashPassword', () => {
    it('should return a bcrypt hash', async () => {
      const hash = await authService.hashPassword('mypassword');
      expect(hash).toMatch(/^\$2[ab]\$/);
    });

    it('should produce different hashes for same password', async () => {
      const hash1 = await authService.hashPassword('mypassword');
      const hash2 = await authService.hashPassword('mypassword');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const hash = await authService.hashPassword('mypassword');
      const result = await authService.comparePassword('mypassword', hash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const hash = await authService.hashPassword('mypassword');
      const result = await authService.comparePassword('wrongpassword', hash);
      expect(result).toBe(false);
    });
  });

  describe('verifyToken', () => {
    it('should return decoded token for valid token', async () => {
      const result = await authService.login('admin@example.com', 'securepass123');
      const decoded = authService.verifyToken(result.token);

      expect(decoded).not.toBeNull();
      expect(decoded!.userId).toBeDefined();
      expect(decoded!.role).toBe('admin');
    });

    it('should return null for invalid token', () => {
      const decoded = authService.verifyToken('invalid.token.here');
      expect(decoded).toBeNull();
    });

    it('should return null for expired token', () => {
      const token = jwt.sign(
        { userId: 'test', role: 'admin' },
        JWT_SECRET,
        { expiresIn: '0s' }
      );
      // Token is already expired
      const decoded = authService.verifyToken(token);
      expect(decoded).toBeNull();
    });
  });
});

describe('POST /api/auth/login', () => {
  const testUser = {
    name: 'Test Admin',
    email: 'admin@example.com',
    password_hash: 'securepass123',
    role: 'admin' as const,
  };

  beforeEach(async () => {
    await User.create(testUser);
  });

  it('should return 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'securepass123' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Email is required');
  });

  it('should return 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Password is required');
  });

  it('should return 400 when email is empty string', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '', password: 'securepass123' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Email is required');
  });

  it('should return 400 when password is empty string', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Password is required');
  });

  it('should return 200 with token and user for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'securepass123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.name).toBe('Test Admin');
    expect(res.body.user.email).toBe('admin@example.com');
    expect(res.body.user.role).toBe('admin');
  });

  it('should return 401 with generic message for invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('should return 401 with generic message for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'securepass123' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('should not reveal whether email or password was wrong', async () => {
    const wrongEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'securepass123' });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'wrongpassword' });

    // Both should return the same generic message
    expect(wrongEmail.body.error.message).toBe(wrongPassword.body.error.message);
  });
});
