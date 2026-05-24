import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, requireRole } from '../middleware/auth';
import { uploadRateLimiter } from '../middleware/rateLimiter';
import { uploadImage, uploadPDF, deleteMedia, getMediaByStep } from '../controllers/uploadController';

const router = Router();

// Configure multer with memory storage (buffer) for file handling
const upload = multer({
  storage: multer.memoryStorage(),
});

// GET /api/upload/step/:stepId — get all media for a step (any authenticated user)
router.get('/step/:stepId', authMiddleware, getMediaByStep);

// POST /api/upload/image — upload image (admin only, multer middleware)
router.post(
  '/image',
  authMiddleware,
  requireRole('admin'),
  uploadRateLimiter,
  upload.single('file'),
  uploadImage
);

// POST /api/upload/pdf — upload PDF (admin only, multer middleware)
router.post(
  '/pdf',
  authMiddleware,
  requireRole('admin'),
  uploadRateLimiter,
  upload.single('file'),
  uploadPDF
);

// DELETE /api/upload/:id — delete media file (admin only)
router.delete('/:id', authMiddleware, requireRole('admin'), deleteMedia);

export default router;
