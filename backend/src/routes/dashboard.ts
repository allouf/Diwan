import { Router } from 'express';
import {
  getSystemStats,
  getUserStats,
  getDocumentAnalytics,
  getPerformanceMetrics,
} from '../controllers/dashboardController';
import {
  authenticate,
  requireAdmin,
} from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/dashboard/stats
 * @desc Get overall system statistics
 * @access Private (Admin only)
 */
router.get('/stats', requireAdmin, getSystemStats);

/**
 * @route GET /api/dashboard/user-stats
 * @desc Get user-specific dashboard data
 * @access Private
 */
router.get('/user-stats', getUserStats);

/**
 * @route GET /api/analytics/documents
 * @desc Get document processing analytics
 * @access Private (Admin only)
 */
router.get('/analytics/documents', requireAdmin, getDocumentAnalytics);

/**
 * @route GET /api/analytics/performance
 * @desc Get system performance metrics
 * @access Private (Admin only)
 */
router.get('/analytics/performance', requireAdmin, getPerformanceMetrics);

export default router;