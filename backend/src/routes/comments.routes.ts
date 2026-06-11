import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createComment,
  getGuideComments,
  getStepComments,
  updateCommentStatus,
  replyToComment,
  getCommentCounts,
} from '../controllers/commentController';

const router = Router();

// All comment routes require authentication
router.use(authMiddleware);

// Any authenticated user can create comments
router.post('/', createComment);

// Get comments by guide or step
router.get('/guide/:guideId', getGuideComments);
router.get('/guide/:guideId/counts', getCommentCounts);
router.get('/step/:stepId', getStepComments);

// Admin actions
router.put('/:id/status', requireRole('admin'), updateCommentStatus);
router.post('/:id/reply', requireRole('admin'), replyToComment);

export default router;
