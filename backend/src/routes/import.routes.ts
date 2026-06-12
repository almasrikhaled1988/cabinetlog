import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { importMarkdown } from '../controllers/importController';

const router = Router();

// POST /api/import/markdown — Import a guide from markdown content
router.post('/markdown', authMiddleware, requireRole('admin'), importMarkdown);

export default router;
