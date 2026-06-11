import { Router, Request, Response, NextFunction } from 'express';
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
import {
  duplicateGuide,
  getTemplates,
  toggleTemplate,
  getVersionHistory,
  getVersion,
} from '../controllers/guideTemplateController';
import { getMaterials, createMaterial } from '../controllers/materialController';
import mongoose from 'mongoose';

const router = Router();

// Validate :id and :guideId params are valid MongoDB ObjectIds
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

// GET /api/guides/search — search guides
router.get('/search', authMiddleware, searchGuides);

// GET /api/guides/templates — get template guides
router.get('/templates', authMiddleware, requireRole('admin'), getTemplates);

// GET /api/guides — list guides with pagination
router.get('/', authMiddleware, getGuides);

// POST /api/guides — create guide (admin only)
router.post('/', authMiddleware, requireRole('admin'), createGuide);

// GET /api/guides/:id — get single guide
router.get('/:id', authMiddleware, validateObjectId('id'), getGuideById);

// PUT /api/guides/:id — update guide (admin only)
router.put('/:id', authMiddleware, requireRole('admin'), validateObjectId('id'), updateGuide);

// PUT /api/guides/:id/status — transition status (admin only)
router.put('/:id/status', authMiddleware, requireRole('admin'), validateObjectId('id'), transitionStatus);

// DELETE /api/guides/:id — delete guide with cascade (admin only)
router.delete('/:id', authMiddleware, requireRole('admin'), validateObjectId('id'), deleteGuide);

// POST /api/guides/:id/duplicate — duplicate a guide (admin only)
router.post('/:id/duplicate', authMiddleware, requireRole('admin'), validateObjectId('id'), duplicateGuide);

// PUT /api/guides/:id/template — mark/unmark as template (admin only)
router.put('/:id/template', authMiddleware, requireRole('admin'), validateObjectId('id'), toggleTemplate);

// GET /api/guides/:id/versions — get version history
router.get('/:id/versions', authMiddleware, validateObjectId('id'), getVersionHistory);

// GET /api/guides/:id/versions/:version — get specific version
router.get('/:id/versions/:version', authMiddleware, validateObjectId('id'), getVersion);

// Steps
router.post('/:guideId/steps', authMiddleware, requireRole('admin'), validateObjectId('guideId'), createStep);
router.get('/:guideId/steps', authMiddleware, validateObjectId('guideId'), getStepsByGuide);
router.put('/:guideId/steps/reorder', authMiddleware, requireRole('admin'), validateObjectId('guideId'), reorderSteps);

// Materials
router.get('/:guideId/materials', authMiddleware, validateObjectId('guideId'), getMaterials);
router.post('/:guideId/materials', authMiddleware, requireRole('admin'), validateObjectId('guideId'), createMaterial);

export default router;
