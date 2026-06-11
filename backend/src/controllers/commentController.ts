import { Request, Response, NextFunction } from 'express';
import { commentService } from '../services/commentService';
import { auditService } from '../services/auditService';

/**
 * POST /api/comments
 */
export async function createComment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { stepId, guideId, category, text } = req.body;
    const userId = req.user!.userId;

    if (!stepId || !guideId || !category || !text) {
      res
        .status(400)
        .json({ error: { message: 'stepId, guideId, category, and text are required', status: 400 } });
      return;
    }

    const comment = await commentService.create({
      stepId,
      guideId,
      userId,
      category,
      text,
    });

    await auditService.log({
      userId,
      action: 'comment_create',
      resourceType: 'comment',
      resourceId: (comment._id as any).toString(),
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/comments/guide/:guideId
 */
export async function getGuideComments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const guideId = req.params.guideId as string;
    const status = req.query.status as string | undefined;

    const comments = await commentService.getByGuide(guideId, status);
    res.status(200).json(comments);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/comments/step/:stepId
 */
export async function getStepComments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stepId = req.params.stepId as string;
    const comments = await commentService.getByStep(stepId);
    res.status(200).json(comments);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/comments/:id/status
 */
export async function updateCommentStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status || !['open', 'in_progress', 'resolved'].includes(status)) {
      res
        .status(400)
        .json({ error: { message: 'Valid status is required (open, in_progress, resolved)', status: 400 } });
      return;
    }

    const comment = await commentService.updateStatus(id, status);
    res.status(200).json(comment);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/comments/:id/reply
 */
export async function replyToComment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { text } = req.body;
    const adminId = req.user!.userId;

    if (!text) {
      res.status(400).json({ error: { message: 'Reply text is required', status: 400 } });
      return;
    }

    const comment = await commentService.reply(id, adminId, text);

    await auditService.log({
      userId: adminId,
      action: 'comment_resolve',
      resourceType: 'comment',
      resourceId: (comment._id as any).toString(),
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(200).json(comment);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/comments/guide/:guideId/counts
 */
export async function getCommentCounts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const guideId = req.params.guideId as string;
    const counts = await commentService.getCountsByGuide(guideId);
    res.status(200).json(counts);
  } catch (error) {
    next(error);
  }
}
