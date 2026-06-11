import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  getOverview,
  getActiveGuides,
  getWorkerActivity,
  getProblematicSteps,
  getCompletionTimes,
  getAuditLog,
} from '../controllers/analyticsController';

const router = Router();

// All analytics routes require admin
router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/overview', getOverview);
router.get('/active-guides', getActiveGuides);
router.get('/worker-activity', getWorkerActivity);
router.get('/problematic-steps', getProblematicSteps);
router.get('/completion-times', getCompletionTimes);
router.get('/audit-log', getAuditLog);

export default router;
