import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { updateStep, deleteStep } from '../controllers/stepController';
import { getMediaByStep } from '../controllers/uploadController';

const router = Router();

// GET /api/steps/:id/media — get all media for a step
router.get('/:id/media', authMiddleware, getMediaByStep);

// PUT /api/steps/:id — update step (admin only)
router.put('/:id', authMiddleware, requireRole('admin'), updateStep);

// DELETE /api/steps/:id — delete step with media cascade (admin only)
router.delete('/:id', authMiddleware, requireRole('admin'), deleteStep);

export default router;
