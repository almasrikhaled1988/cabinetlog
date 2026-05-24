import { Router } from 'express';
import authRoutes from './auth.routes';
import guidesRoutes from './guides.routes';
import stepsRoutes from './steps.routes';
import uploadRoutes from './upload.routes';
import tagsRoutes from './tags.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/guides', guidesRoutes);
router.use('/steps', stepsRoutes);
router.use('/upload', uploadRoutes);
router.use('/tags', tagsRoutes);

export default router;
