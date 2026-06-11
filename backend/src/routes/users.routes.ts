import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  resetPassword,
} from '../controllers/userController';

const router = Router();

// All user management routes require admin
router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/', getUsers);
router.get('/:id', getUser);
router.post('/', createUser);
router.put('/:id', updateUser);
router.post('/:id/reset-password', resetPassword);

export default router;
