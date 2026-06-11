import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { updateStep, deleteStep } from '../controllers/stepController';
import { getMediaByStep } from '../controllers/uploadController';
import mongoose from 'mongoose';

const router = Router();

function validateObjectId(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName] as string;
    if (value && !mongoose.Types.ObjectId.isValid(value)) {
      res.status(400).json({
        error: { message: `Invalid ${paramName} format`, status: 400 },
      });
      return;
    }
    next();
  };
}

// GET /api/steps/:id/media — get all media for a step
router.get('/:id/media', authMiddleware, validateObjectId('id'), getMediaByStep);

// PUT /api/steps/:id — update step (admin only)
router.put('/:id', authMiddleware, requireRole('admin'), validateObjectId('id'), updateStep);

// DELETE /api/steps/:id — delete step with media cascade (admin only)
router.delete('/:id', authMiddleware, requireRole('admin'), validateObjectId('id'), deleteStep);

export default router;
