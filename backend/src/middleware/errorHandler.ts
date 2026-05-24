import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  errors?: Record<string, string>;
}

export class ValidationError extends Error {
  statusCode = 400;
  errors: Record<string, string>;

  constructor(message: string, errors?: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors || {};
  }
}

export class NotFoundError extends Error {
  statusCode = 404;

  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401;

  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;

  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  if (statusCode === 500) {
    console.error('Unhandled error:', err);
  }

  const response: Record<string, unknown> = {
    error: {
      message,
      status: statusCode,
    },
  };

  if (err instanceof ValidationError && err.errors && Object.keys(err.errors).length > 0) {
    (response.error as Record<string, unknown>).fields = err.errors;
  }

  res.status(statusCode).json(response);
}
