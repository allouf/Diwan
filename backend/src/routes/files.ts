import { Router } from 'express';
import {
  uploadFiles,
  uploadDocumentAttachments,
  uploadAvatar,
  serveFile,
  serveAvatar,
  serveThumbnail,
  getFileInfo,
  deleteFileById,
  getStorageStats,
  listFiles,
  getFileStats
} from '../controllers/fileController';
import { authenticate, requireRole } from '../middleware/auth';
import {
  documentUploadMiddleware,
  avatarUploadMiddleware,
  tempUploadMiddleware
} from '../middleware/upload';

const router = Router();

// Public avatar serving (no auth required for avatars)
router.get('/avatar/:filename', serveAvatar);

// Public thumbnail serving (no auth required for thumbnails)
router.get('/thumbnail/:filename', serveThumbnail);

// Apply authentication to all other routes
router.use(authenticate);

// File listing and stats (must come before :fileId route)
router.get('/stats', getFileStats);
router.get('/', listFiles);

// File upload routes
router.post('/upload', tempUploadMiddleware, uploadFiles);
router.post('/upload/documents', documentUploadMiddleware, uploadDocumentAttachments);
router.post('/upload/avatar', avatarUploadMiddleware, uploadAvatar);

// File access routes
router.get('/:fileId', serveFile);
router.get('/info/:fileId', getFileInfo);
router.delete('/:fileId', deleteFileById);

// Administrative routes
router.get('/admin/storage-stats', requireRole('ADMIN'), getStorageStats);

export default router;