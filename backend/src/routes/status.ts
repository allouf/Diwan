import { Router } from 'express';
import {
  updateDocumentStatus,
  getDocumentStatusHistory,
  bulkUpdateDocumentStatus,
  getAvailableStatusTransitions,
  getStatusWorkflow
} from '../controllers/statusController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Document status management routes
router.patch('/:documentId', updateDocumentStatus);
router.get('/:documentId/history', getDocumentStatusHistory);
router.get('/:documentId/transitions', getAvailableStatusTransitions);
router.patch('/bulk-update', requireRole('ADMIN', 'CORRESPONDENCE_OFFICER'), bulkUpdateDocumentStatus);
router.get('/workflow/overview', getStatusWorkflow);

export default router;