import { Router } from 'express';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
  createNotification,
  deleteNotification,
} from '../controllers/notificationController';
import {
  authenticate,
  requireAdmin,
} from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/notifications
 * @desc Get user notifications with pagination
 * @access Private
 */
router.get('/', getNotifications);

/**
 * @route GET /api/notifications/unread-count
 * @desc Get unread notifications count
 * @access Private
 */
router.get('/unread-count', getUnreadCount);

/**
 * @route PUT /api/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private
 */
router.put('/read-all', markAllNotificationsAsRead);

/**
 * @route PUT /api/notifications/:id/read
 * @desc Mark notification as read
 * @access Private
 */
router.put('/:id/read', markNotificationAsRead);

/**
 * @route POST /api/notifications
 * @desc Create notification (admin/system only)
 * @access Private (Admin only)
 */
router.post('/', requireAdmin, createNotification);

/**
 * @route DELETE /api/notifications/:id
 * @desc Delete notification
 * @access Private
 */
router.delete('/:id', deleteNotification);

export default router;