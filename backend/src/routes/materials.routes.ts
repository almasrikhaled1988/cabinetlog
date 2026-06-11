import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
} from '../controllers/materialController';

const router = Router();

router.use(authMiddleware);

// Anyone authenticated can view materials
router.get('/guides/:guideId/materials', getMaterials);

// Admin only: create, update, delete
router.post('/guides/:guideId/materials', requireRole('admin'), createMaterial);
router.put('/materials/:id', requireRole('admin'), updateMaterial);
router.delete('/materials/:id', requireRole('admin'), deleteMaterial);

export default router;
