import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService';
import { auditService } from '../services/auditService';

/**
 * GET /api/users
 */
export async function getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;

    const result = await userService.getUsers(page, limit, search);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users/:id
 */
export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.getUserById(req.params.id as string);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/users
 */
export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password, role } = req.body;
    const user = await userService.createUser({ name, email, password, role });

    await auditService.log({
      userId: req.user!.userId,
      action: 'user_create',
      resourceType: 'user',
      resourceId: (user._id as any).toString(),
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/users/:id
 */
export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, role, active } = req.body;
    const user = await userService.updateUser(req.params.id as string, { name, email, role, active });

    const action = active === false ? 'user_deactivate' : 'user_update';
    await auditService.log({
      userId: req.user!.userId,
      action,
      resourceType: 'user',
      resourceId: req.params.id as string,
      details: { name, email, role, active },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/users/:id/reset-password
 */
export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { password } = req.body;

    if (!password || password.length < 8) {
      res
        .status(400)
        .json({ error: { message: 'Password must be at least 8 characters', status: 400 } });
      return;
    }

    await userService.resetPassword(req.params.id as string, password);

    await auditService.log({
      userId: req.user!.userId,
      action: 'user_update',
      resourceType: 'user',
      resourceId: req.params.id as string,
      details: { action: 'password_reset' },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
}
