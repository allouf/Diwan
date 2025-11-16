import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { 
  FILE_STORAGE_CONFIG,
  generateFileName,
  isValidFileType,
  isValidFileExtension,
  isValidFileSize,
  sanitizeFilename,
  isSecureFilename,
  ensureDirectoriesExist
} from '../lib/fileStorage';

// Initialize directories on startup
ensureDirectoriesExist();

// Custom storage configuration
const createStorage = (directory: string) => {
  return multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        await ensureDirectoriesExist();
        const destinationPath = path.join(FILE_STORAGE_CONFIG.UPLOAD_DIR, directory);
        cb(null, destinationPath);
      } catch (error) {
        cb(error as Error, '');
      }
    },
    filename: (req, file, cb) => {
      // Sanitize original filename
      const sanitized = sanitizeFilename(file.originalname);
      const fileName = generateFileName(sanitized, directory);
      cb(null, fileName);
    }
  });
};

// File filter function
const createFileFilter = (allowedCategories: string[]) => {
  return (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Security checks
    if (!isSecureFilename(file.originalname)) {
      return cb(new Error('Invalid filename: contains unsafe characters'));
    }

    if (!isValidFileExtension(file.originalname)) {
      return cb(new Error('File type not allowed: invalid extension'));
    }

    // Check MIME type against allowed categories
    const isValid = allowedCategories.some(category => {
      return isValidFileType(file.mimetype, category as 'DOCUMENTS' | 'IMAGES' | 'ARCHIVES');
    });

    if (!isValid) {
      return cb(new Error(`File type not allowed: ${file.mimetype}`));
    }

    cb(null, true);
  };
};

// Size validation middleware
const validateFileSize = (sizeType: 'AVATAR' | 'DOCUMENT') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.file && !isValidFileSize(req.file.size, sizeType)) {
      return res.status(400).json({
        message: `File too large. Maximum size is ${FILE_STORAGE_CONFIG.SIZE_LIMITS[sizeType]} bytes`
      });
    }

    if (req.files && Array.isArray(req.files)) {
      const oversizedFile = req.files.find(file => !isValidFileSize(file.size, sizeType));
      if (oversizedFile) {
        return res.status(400).json({
          message: `File "${oversizedFile.originalname}" is too large. Maximum size is ${FILE_STORAGE_CONFIG.SIZE_LIMITS[sizeType]} bytes`
        });
      }
    }

    next();
  };
};

// Rate limiting for file uploads
const uploadAttempts = new Map<string, { count: number; resetTime: number }>();

const rateLimitUpload = (maxAttempts: number = 10, windowMinutes: number = 15) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    const clientAttempts = uploadAttempts.get(clientIp);
    
    if (!clientAttempts || now > clientAttempts.resetTime) {
      uploadAttempts.set(clientIp, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (clientAttempts.count >= maxAttempts) {
      return res.status(429).json({
        message: 'Too many upload attempts. Please try again later.',
        retryAfter: Math.ceil((clientAttempts.resetTime - now) / 1000)
      });
    }

    clientAttempts.count++;
    next();
  };
};

// Document upload configuration
export const uploadDocument = multer({
  storage: createStorage(FILE_STORAGE_CONFIG.DIRECTORIES.DOCUMENTS),
  fileFilter: createFileFilter(['DOCUMENTS', 'IMAGES', 'ARCHIVES']),
  limits: {
    fileSize: FILE_STORAGE_CONFIG.SIZE_LIMITS.DOCUMENT,
    files: 5 // Maximum 5 files per upload
  }
});

// Avatar upload configuration
export const uploadAvatar = multer({
  storage: createStorage(FILE_STORAGE_CONFIG.DIRECTORIES.AVATARS),
  fileFilter: createFileFilter(['IMAGES']),
  limits: {
    fileSize: FILE_STORAGE_CONFIG.SIZE_LIMITS.AVATAR,
    files: 1 // Only 1 avatar at a time
  }
});

// Temporary file upload (for processing)
export const uploadTemp = multer({
  storage: createStorage(FILE_STORAGE_CONFIG.DIRECTORIES.TEMP),
  fileFilter: createFileFilter(['DOCUMENTS', 'IMAGES', 'ARCHIVES']),
  limits: {
    fileSize: FILE_STORAGE_CONFIG.SIZE_LIMITS.DOCUMENT,
    files: 10
  }
});

// Error handling middleware for multer
export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          message: 'File too large',
          details: `Maximum file size is ${error.field === 'avatar' ? '2MB' : '10MB'}`
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          message: 'Too many files',
          details: 'Maximum number of files exceeded'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          message: 'Unexpected file field',
          details: `Unexpected field: ${error.field}`
        });
      case 'LIMIT_PART_COUNT':
        return res.status(400).json({
          message: 'Too many form fields',
          details: 'Maximum number of form fields exceeded'
        });
      default:
        return res.status(400).json({
          message: 'Upload error',
          details: error.message
        });
    }
  }

  if (error.message) {
    return res.status(400).json({
      message: 'Upload validation failed',
      details: error.message
    });
  }

  next(error);
};

// Virus scanning placeholder (for production use)
export const virusScanMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // TODO: Integrate with virus scanning service like ClamAV
  // For now, we'll just log the files being uploaded
  
  const files = req.files as Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
  const singleFile = req.file as Express.Multer.File;

  if (singleFile) {
    console.log(`File uploaded for scanning: ${singleFile.filename} (${singleFile.mimetype})`);
  }

  if (files) {
    if (Array.isArray(files)) {
      files.forEach(file => {
        console.log(`File uploaded for scanning: ${file.filename} (${file.mimetype})`);
      });
    } else {
      Object.values(files).flat().forEach(file => {
        console.log(`File uploaded for scanning: ${file.filename} (${file.mimetype})`);
      });
    }
  }

  // In production, implement actual virus scanning here
  // For now, just continue
  next();
};

// File metadata extraction middleware
export const extractFileMetadata = (req: Request, res: Response, next: NextFunction) => {
  const files = req.files as Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
  const singleFile = req.file as Express.Multer.File;

  // Add metadata to single file
  if (singleFile) {
    (singleFile as any).metadata = {
      uploadedAt: new Date(),
      uploadedBy: req.user?.id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };
  }

  // Add metadata to multiple files
  if (files) {
    const fileArray = Array.isArray(files) ? files : Object.values(files).flat();
    fileArray.forEach(file => {
      (file as any).metadata = {
        uploadedAt: new Date(),
        uploadedBy: req.user?.id,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
      };
    });
  }

  next();
};

// Export middleware combinations for common use cases
export const documentUploadMiddleware = [
  rateLimitUpload(10, 15),
  uploadDocument.array('documents', 5),
  handleUploadError,
  validateFileSize('DOCUMENT'),
  virusScanMiddleware,
  extractFileMetadata
];

export const avatarUploadMiddleware = [
  rateLimitUpload(5, 10),
  uploadAvatar.single('avatar'),
  handleUploadError,
  validateFileSize('AVATAR'),
  virusScanMiddleware,
  extractFileMetadata
];

export const tempUploadMiddleware = [
  rateLimitUpload(20, 15),
  uploadTemp.array('files', 10),
  handleUploadError,
  validateFileSize('DOCUMENT'),
  virusScanMiddleware,
  extractFileMetadata
];