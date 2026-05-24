import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createGuide,
  getGuides,
  getGuideById,
  updateGuide,
  transitionStatus,
  deleteGuide,
} from '../controllers/guideController';
import { createStep, getStepsByGuide, reorderSteps } from '../controllers/stepController';
import { searchGuides } from '../controllers/searchController';

const router = Router();

// GET /api/guides/search — search guides with query and filters (task 9.2)
// Must be defined before /:id routes to avoid matching "search" as an ID
router.get('/search', authMiddleware, searchGuides);

// GET /api/guides — list guides with pagination (task 5.1)
// Auth middleware required to determine user role for filtering
router.get('/', authMiddleware, getGuides);

// POST /api/guides — create guide (admin only)
router.post('/', authMiddleware, requireRole('admin'), createGuide);

// GET /api/guides/:id — get single guide
router.get('/:id', authMiddleware, getGuideById);

// PUT /api/guides/:id — update guide (admin only)
router.put('/:id', authMiddleware, requireRole('admin'), updateGuide);

// PUT /api/guides/:id/status — transition status (admin only)
router.put('/:id/status', authMiddleware, requireRole('admin'), transitionStatus);

// DELETE /api/guides/:id — delete guide with cascade (admin only)
router.delete('/:id', authMiddleware, requireRole('admin'), deleteGuide);

// POST /api/guides/:guideId/steps — create step (admin only)
router.post('/:guideId/steps', authMiddleware, requireRole('admin'), createStep);

// GET /api/guides/:guideId/steps — get steps for guide (sorted by step_order)
router.get('/:guideId/steps', authMiddleware, getStepsByGuide);

// PUT /api/guides/:guideId/steps/reorder — reorder steps (admin only)
router.put('/:guideId/steps/reorder', authMiddleware, requireRole('admin'), reorderSteps);

export default router;
