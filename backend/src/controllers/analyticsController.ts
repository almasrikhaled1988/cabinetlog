import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analyticsService';
import { auditService } from '../services/auditService';

/**
 * GET /api/analytics/overview
 */
export async function getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const overview = await analyticsService.getOverview();
    res.status(200).json(overview);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/active-guides
 */
export async function getActiveGuides(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const guides = await analyticsService.getMostActiveGuides(limit);
    res.status(200).json(guides);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/worker-activity
 */
export async function getWorkerActivity(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const activity = await analyticsService.getWorkerActivity(limit);
    res.status(200).json(activity);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/problematic-steps
 */
export async function getProblematicSteps(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const steps = await analyticsService.getProblematicSteps(limit);
    res.status(200).json(steps);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/completion-times
 */
export async function getCompletionTimes(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const times = await analyticsService.getAvgCompletionTimes();
    res.status(200).json(times);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/audit-log
 */
export async function getAuditLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = await auditService.getRecent(limit);
    res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
}
