import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  markStepComplete,
  unmarkStepComplete,
  getGuideProgress,
  getGuideProgressSummary,
} from '../controllers/progressController';

const router = Router();

// All progress routes require authentication
router.use(authMiddleware);

// Worker progress
router.post('/:guideId/steps/:stepId/complete', markStepComplete);
router.delete('/:guideId/steps/:stepId/complete', unmarkStepComplete);
router.get('/:guideId', getGuideProgress);

// Admin summary
router.get('/:guideId/summary', requireRole('admin'), getGuideProgressSummary);

export default router;
