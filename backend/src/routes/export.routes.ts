import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { exportGuidePDF } from '../controllers/exportController';

const router = Router();

router.use(authMiddleware);

// GET /api/export/guides/:id/pdf
router.get('/guides/:id/pdf', exportGuidePDF);

export default router;
