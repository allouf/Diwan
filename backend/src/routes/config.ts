import { Router } from 'express';
import {
  getSystemConfigurations,
  getConfigurationByKey,
  updateSystemConfiguration,
  bulkUpdateSystemConfigurations,
  deleteSystemConfiguration,
  getPublicConfigurations,
  resetToDefaults,
  exportConfigurations,
  importConfigurations
} from '../controllers/configController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Public configurations (no auth required)
router.get('/public', getPublicConfigurations);

// Apply authentication to all other routes
router.use(authenticate);

// System configuration routes (admin only)
router.get('/', requireRole(['ADMIN']), getSystemConfigurations);
router.get('/export', requireRole(['ADMIN']), exportConfigurations);
router.post('/import', requireRole(['ADMIN']), importConfigurations);
router.post('/reset', requireRole(['ADMIN']), resetToDefaults);
router.post('/bulk-update', requireRole(['ADMIN']), bulkUpdateSystemConfigurations);
router.get('/:key', requireRole(['ADMIN']), getConfigurationByKey);
router.put('/:key', requireRole(['ADMIN']), updateSystemConfiguration);
router.delete('/:key', requireRole(['ADMIN']), deleteSystemConfiguration);

export default router;