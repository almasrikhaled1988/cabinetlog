import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, requireRole } from './auth';
import { UnauthorizedError, ForbiddenError } from './errorHandler';

const TEST_SECRET = 'test-jwt-secret';

// Helper to create a mock request
function mockRequest(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as Partial<Request>;
}

// Helper to create a mock response (unused by middleware but required by signature)
function mockResponse(): Partial<Response> {
  return {};
}

describe('authMiddleware', () => {
  const originalEnv = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalEnv;
  });

  it('should attach decoded user to req and call next() for a valid token', () => {
    const token = jwt.sign({ userId: 'user123', role: 'admin' }, TEST_SECRET, {
      expiresIn: '8h',
    });
    const req = mockRequest(`Bearer ${token}`) as Request;
    const res = mockResponse() as Response;
    const next: NextFunction = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe('user123');
    expect(req.user!.role).toBe('admin');
  });

  it('should pass UnauthorizedError to next() when Authorization header is missing', () => {
    const req = mockRequest() as Request;
    const res = mockResponse() as Response;
    const next: NextFunction = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('should pass UnauthorizedError to next() for malformed Authorization header (no Bearer prefix)', () => {
    const token = jwt.sign({ userId: 'user123', role: 'admin' }, TEST_SECRET);
    const req = mockRequest(`Basic ${token}`) as Request;
    const res = mockResponse() as Response;
    const next: NextFunction = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('should pass UnauthorizedError to next() for expired tokens', () => {
    const token = jwt.sign({ userId: 'user123', role: 'worker' }, TEST_SECRET, {
      expiresIn: '-1s',
    });
    const req = mockRequest(`Bearer ${token}`) as Request;
    const res = mockResponse() as Response;
    const next: NextFunction = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    const error = (next as jest.Mock).mock.calls[0][0] as UnauthorizedError;
    expect(error.message).toContain('expired');
  });

  it('should pass UnauthorizedError to next() for tampered tokens', () => {
    const token = jwt.sign({ userId: 'user123', role: 'admin' }, 'wrong-secret');
    const req = mockRequest(`Bearer ${token}`) as Request;
    const res = mockResponse() as Response;
    const next: NextFunction = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('should pass UnauthorizedError to next() for malformed tokens', () => {
    const req = mockRequest('Bearer not.a.valid.jwt.token') as Request;
    const res = mockResponse() as Response;
    const next: NextFunction = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('should pass UnauthorizedError to next() when header has extra parts', () => {
    const token = jwt.sign({ userId: 'user123', role: 'admin' }, TEST_SECRET);
    const req = mockRequest(`Bearer ${token} extra`) as Request;
    const res = mockResponse() as Response;
    const next: NextFunction = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});

describe('requireRole', () => {
  it('should call next() when user has an allowed role', () => {
    const req = {
      user: { userId: 'user123', role: 'admin', iat: 0, exp: 0 },
    } as Request;
    const res = mockResponse() as Response;
    const next: NextFunction = jest.fn();

    const middleware = requireRole('admin');
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should pass ForbiddenError to next() when user role is not in allowed roles', () => {
    const req = {
      user: { userId: 'user123', role: 'worker', iat: 0, exp: 0 },
    } as Request;
    const res = mockResponse() as Response;
    const next: NextFunction = jest.fn();

    const middleware = requireRole('admin');
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('should allow access when user has one of multiple allowed roles', () => {
    const req = {
      user: { userId: 'user123', role: 'worker', iat: 0, exp: 0 },
    } as Request;
    const res = mockResponse() as Response;
    const next: NextFunction = jest.fn();

    const middleware = requireRole('admin', 'worker');
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should pass UnauthorizedError to next() when req.user is not set', () => {
    const req = {} as Request;
    const res = mockResponse() as Response;
    const next: NextFunction = jest.fn();

    const middleware = requireRole('admin');
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
