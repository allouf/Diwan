import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changeUserPassword,
  getUserStats
} from '../controllers/userController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// User management routes (admin only)
router.get('/', requireRole('ADMIN'), getUsers);
router.get('/stats', requireRole('ADMIN'), getUserStats);
router.get('/:id', requireRole('ADMIN'), getUserById);
router.post('/', requireRole('ADMIN'), createUser);
router.put('/:id', requireRole('ADMIN'), updateUser);
router.delete('/:id', requireRole('ADMIN'), deleteUser);
router.post('/:id/change-password', requireRole('ADMIN'), changeUserPassword);

export default router;