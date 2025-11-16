import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';

// File storage configuration
export const FILE_STORAGE_CONFIG = {
  // Base upload directory
  UPLOAD_DIR: path.join(process.cwd(), 'uploads'),
  
  // Subdirectories for different file types
  DIRECTORIES: {
    DOCUMENTS: 'documents',
    AVATARS: 'avatars', 
    TEMP: 'temp',
    THUMBNAILS: 'thumbnails'
  },
  
  // File size limits (in bytes)
  SIZE_LIMITS: {
    AVATAR: 2 * 1024 * 1024,      // 2MB for avatars
    DOCUMENT: 10 * 1024 * 1024,   // 10MB for documents
    MAX_TOTAL: 50 * 1024 * 1024   // 50MB total per request
  },
  
  // Allowed file types
  ALLOWED_TYPES: {
    DOCUMENTS: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/rtf'
    ],
    IMAGES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ],
    ARCHIVES: [
      'application/zip',
      'application/x-rar-compressed'
    ]
  },
  
  // File extensions for validation
  ALLOWED_EXTENSIONS: [
    '.pdf', '.doc', '.docx', '.txt', '.rtf',
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.zip', '.rar'
  ]
};

// File naming utility
export const generateFileName = (originalName: string, prefix?: string): string => {
  const extension = path.extname(originalName);
  const timestamp = Date.now();
  const uuid = uuidv4().split('-')[0]; // Use first part of UUID for shorter names
  
  return `${prefix ? prefix + '_' : ''}${timestamp}_${uuid}${extension}`;
};

// Get file path utilities
export const getFilePath = (directory: string, filename: string): string => {
  return path.join(FILE_STORAGE_CONFIG.UPLOAD_DIR, directory, filename);
};

export const getDocumentPath = (filename: string): string => {
  return getFilePath(FILE_STORAGE_CONFIG.DIRECTORIES.DOCUMENTS, filename);
};

export const getAvatarPath = (filename: string): string => {
  return getFilePath(FILE_STORAGE_CONFIG.DIRECTORIES.AVATARS, filename);
};

export const getTempPath = (filename: string): string => {
  return getFilePath(FILE_STORAGE_CONFIG.DIRECTORIES.TEMP, filename);
};

export const getThumbnailPath = (filename: string): string => {
  return getFilePath(FILE_STORAGE_CONFIG.DIRECTORIES.THUMBNAILS, filename);
};

// File validation utilities
export const isValidFileType = (mimeType: string, category: 'DOCUMENTS' | 'IMAGES' | 'ARCHIVES'): boolean => {
  const allowedTypes = FILE_STORAGE_CONFIG.ALLOWED_TYPES[category];
  return allowedTypes.includes(mimeType);
};

export const isValidFileExtension = (filename: string): boolean => {
  const extension = path.extname(filename).toLowerCase();
  return FILE_STORAGE_CONFIG.ALLOWED_EXTENSIONS.includes(extension);
};

export const getFileCategory = (mimeType: string): string | null => {
  if (FILE_STORAGE_CONFIG.ALLOWED_TYPES.DOCUMENTS.includes(mimeType)) {
    return 'DOCUMENT';
  }
  if (FILE_STORAGE_CONFIG.ALLOWED_TYPES.IMAGES.includes(mimeType)) {
    return 'IMAGE';
  }
  if (FILE_STORAGE_CONFIG.ALLOWED_TYPES.ARCHIVES.includes(mimeType)) {
    return 'ARCHIVE';
  }
  return null;
};

// File size utilities
export const isValidFileSize = (size: number, type: 'AVATAR' | 'DOCUMENT'): boolean => {
  const limit = FILE_STORAGE_CONFIG.SIZE_LIMITS[type];
  return size <= limit;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// File metadata extraction
export const getFileMetadata = (file: Express.Multer.File) => {
  return {
    originalName: file.originalname,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    sizeFormatted: formatFileSize(file.size),
    category: getFileCategory(file.mimetype),
    extension: path.extname(file.originalname).toLowerCase(),
    uploadDate: new Date()
  };
};

// File cleanup utilities
export const deleteFile = async (filePath: string): Promise<boolean> => {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

export const cleanupTempFiles = async (olderThanHours: number = 24): Promise<number> => {
  try {
    const tempDir = path.join(FILE_STORAGE_CONFIG.UPLOAD_DIR, FILE_STORAGE_CONFIG.DIRECTORIES.TEMP);
    const files = await fs.readdir(tempDir);
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime.getTime() < cutoffTime) {
        const deleted = await deleteFile(filePath);
        if (deleted) deletedCount++;
      }
    }

    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up temp files:', error);
    return 0;
  }
};

// Directory size calculation
export const getDirectorySize = async (dirPath: string): Promise<number> => {
  try {
    const files = await fs.readdir(dirPath);
    let totalSize = 0;

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      totalSize += stats.size;
    }

    return totalSize;
  } catch (error) {
    console.error('Error calculating directory size:', error);
    return 0;
  }
};

// Ensure directories exist
export const ensureDirectoriesExist = async (): Promise<void> => {
  const directories = Object.values(FILE_STORAGE_CONFIG.DIRECTORIES);
  
  for (const dir of directories) {
    const fullPath = path.join(FILE_STORAGE_CONFIG.UPLOAD_DIR, dir);
    try {
      await fs.access(fullPath);
    } catch {
      await fs.mkdir(fullPath, { recursive: true });
    }
  }
};

// Security utilities
export const sanitizeFilename = (filename: string): string => {
  // Remove or replace dangerous characters
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace special chars with underscore
    .replace(/_{2,}/g, '_')            // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '')          // Remove leading/trailing underscores
    .toLowerCase();
};

export const isSecureFilename = (filename: string): boolean => {
  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /\.\./,           // Directory traversal
    /^[./]/,          // Starts with dot or slash
    /[<>:"|?*]/,      // Invalid filename characters
    /\0/,             // Null byte
    /\s{2,}/,         // Multiple spaces
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i  // Windows reserved names
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(filename));
};