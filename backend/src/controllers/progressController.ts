import { Request, Response, NextFunction } from 'express';
import { progressService } from '../services/progressService';

/**
 * POST /api/progress/:guideId/steps/:stepId/complete
 */
export async function markStepComplete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const guideId = req.params.guideId as string;
    const stepId = req.params.stepId as string;
    const userId = req.user!.userId;
    const { timeSpent } = req.body;

    const progress = await progressService.markComplete(userId, guideId, stepId, timeSpent);
    res.status(200).json(progress);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/progress/:guideId/steps/:stepId/complete
 */
export async function unmarkStepComplete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stepId = req.params.stepId as string;
    const userId = req.user!.userId;

    await progressService.unmarkComplete(userId, stepId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/progress/:guideId
 */
export async function getGuideProgress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const guideId = req.params.guideId as string;
    const userId = req.user!.userId;

    const progress = await progressService.getGuideProgress(userId, guideId);
    res.status(200).json(progress);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/progress/:guideId/summary (admin)
 */
export async function getGuideProgressSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const guideId = req.params.guideId as string;
    const summary = await progressService.getGuideProgressSummary(guideId);
    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
}
