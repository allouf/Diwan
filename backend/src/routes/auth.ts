import { Router } from 'express';
import {
  login,
  logout,
  refreshToken,
  getProfile,
  changePassword,
} from '../controllers/authController';
import {
  authenticate,
} from '../middleware/auth';
import {
  validateLogin,
  validateChangePassword,
  validateRefreshToken,
} from '../middleware/validation';

const router = Router();

// Public routes
router.post('/login', validateLogin, login);
router.post('/refresh', validateRefreshToken, refreshToken);

// Protected routes
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getProfile);
router.post('/change-password', authenticate, validateChangePassword, changePassword);

export default router;