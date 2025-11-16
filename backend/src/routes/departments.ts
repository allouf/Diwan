import { Router } from 'express';
import {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  getDepartmentDocuments,
  getDepartmentStats,
} from '../controllers/departmentController';
import {
  authenticate,
  requireAdmin,
} from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/departments
 * @desc Get all departments
 * @access Private
 */
router.get('/', getDepartments);

/**
 * @route GET /api/departments/:id
 * @desc Get department by ID
 * @access Private
 */
router.get('/:id', getDepartmentById);

/**
 * @route POST /api/departments
 * @desc Create new department
 * @access Private (Admin only)
 */
router.post('/', requireAdmin, createDepartment);

/**
 * @route PUT /api/departments/:id
 * @desc Update department
 * @access Private (Admin only)
 */
router.put('/:id', requireAdmin, updateDepartment);

/**
 * @route GET /api/departments/:id/documents
 * @desc Get documents assigned to department
 * @access Private
 */
router.get('/:id/documents', getDepartmentDocuments);

/**
 * @route GET /api/departments/:id/stats
 * @desc Get department statistics
 * @access Private
 */
router.get('/:id/stats', getDepartmentStats);

export default router;