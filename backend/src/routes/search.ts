import { Router } from 'express';
import {
  globalSearch,
  advancedDocumentSearch,
  getAutocompleteSuggestions,
  getSearchFilters,
  saveSearchQuery
} from '../controllers/searchController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Search routes
router.get('/global', globalSearch);
router.get('/documents/advanced', advancedDocumentSearch);
router.get('/autocomplete', getAutocompleteSuggestions);
router.get('/filters', getSearchFilters);
router.post('/save', saveSearchQuery);

export default router;