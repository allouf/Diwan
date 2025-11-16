import { Router } from 'express';
import {
  getActivityLogs,
  getUserActivityLogs,
  getActivityStatistics,
  getDocumentActivities,
  getActivitySummary
} from '../controllers/activityController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Activity log routes
router.get('/', requireRole('ADMIN', 'CORRESPONDENCE_OFFICER'), getActivityLogs);
router.get('/my-activities', getUserActivityLogs);
router.get('/statistics', requireRole('ADMIN', 'CORRESPONDENCE_OFFICER'), getActivityStatistics);
router.get('/summary', getActivitySummary);
router.get('/document/:documentId', getDocumentActivities);

export default router;