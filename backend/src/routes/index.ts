import { Router } from 'express';
import authRoutes from './auth.routes';
import guidesRoutes from './guides.routes';
import stepsRoutes from './steps.routes';
import uploadRoutes from './upload.routes';
import tagsRoutes from './tags.routes';
import progressRoutes from './progress.routes';
import commentsRoutes from './comments.routes';
import materialsRoutes from './materials.routes';
import usersRoutes from './users.routes';
import analyticsRoutes from './analytics.routes';
import exportRoutes from './export.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/guides', guidesRoutes);
router.use('/steps', stepsRoutes);
router.use('/upload', uploadRoutes);
router.use('/tags', tagsRoutes);
router.use('/progress', progressRoutes);
router.use('/comments', commentsRoutes);
router.use('/', materialsRoutes);
router.use('/users', usersRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/export', exportRoutes);

export default router;
