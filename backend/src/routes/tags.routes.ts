import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { createTag, getTags, deleteTag } from '../controllers/tagController';

const router = Router();

// GET /api/tags — list all tags (any authenticated user)
router.get('/', authMiddleware, getTags);

// POST /api/tags — create tag (admin only)
router.post('/', authMiddleware, requireRole('admin'), createTag);

// DELETE /api/tags/:id — delete tag (admin only)
router.delete('/:id', authMiddleware, requireRole('admin'), deleteTag);

export default router;
