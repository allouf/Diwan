import { Router } from 'express';
import {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  assignDocumentToDepartments,
} from '../controllers/documentController';
import {
  authenticate,
  requireAdmin,
  authorize,
} from '../middleware/auth';
import { UserRole } from '../generated/prisma';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/documents
 * @desc Get documents with filtering and pagination
 * @access Private
 */
router.get('/', getDocuments);

/**
 * @route POST /api/documents
 * @desc Create new document
 * @access Private (Admin, Correspondence Officer)
 */
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.CORRESPONDENCE_OFFICER),
  createDocument
);

/**
 * @route GET /api/documents/:id
 * @desc Get single document by ID
 * @access Private
 */
router.get('/:id', getDocumentById);

/**
 * @route PUT /api/documents/:id
 * @desc Update document
 * @access Private (Admin, Correspondence Officer)
 */
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.CORRESPONDENCE_OFFICER),
  updateDocument
);

/**
 * @route POST /api/documents/:id/assign
 * @desc Assign document to departments
 * @access Private (Admin, Correspondence Officer)
 */
router.post(
  '/:id/assign',
  authorize(UserRole.ADMIN, UserRole.CORRESPONDENCE_OFFICER),
  assignDocumentToDepartments
);

export default router;