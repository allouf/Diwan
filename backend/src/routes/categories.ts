import { Router } from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryDocuments,
} from '../controllers/categoryController';
import {
  authenticate,
  requireAdmin,
} from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/categories
 * @desc Get all categories
 * @access Private
 */
router.get('/', getCategories);

/**
 * @route GET /api/categories/:id
 * @desc Get category by ID
 * @access Private
 */
router.get('/:id', getCategoryById);

/**
 * @route POST /api/categories
 * @desc Create new category
 * @access Private (Admin only)
 */
router.post('/', requireAdmin, createCategory);

/**
 * @route PUT /api/categories/:id
 * @desc Update category
 * @access Private (Admin only)
 */
router.put('/:id', requireAdmin, updateCategory);

/**
 * @route DELETE /api/categories/:id
 * @desc Delete category
 * @access Private (Admin only)
 */
router.delete('/:id', requireAdmin, deleteCategory);

/**
 * @route GET /api/categories/:id/documents
 * @desc Get documents in category
 * @access Private
 */
router.get('/:id/documents', getCategoryDocuments);

export default router;