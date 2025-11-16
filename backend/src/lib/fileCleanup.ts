import { PrismaClient } from '../generated/prisma';
import path from 'path';
import fs from 'fs/promises';
import { 
  cleanupTempFiles, 
  deleteFile, 
  getDirectorySize, 
  FILE_STORAGE_CONFIG 
} from './fileStorage';

const prisma = new PrismaClient();

// File cleanup service class
export class FileCleanupService {
  private static instance: FileCleanupService;
  private cleanupTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): FileCleanupService {
    if (!FileCleanupService.instance) {
      FileCleanupService.instance = new FileCleanupService();
    }
    return FileCleanupService.instance;
  }

  // Start automatic cleanup
  public startAutomaticCleanup(intervalHours: number = 24) {
    console.log(`Starting file cleanup service with ${intervalHours}h interval`);
    
    this.cleanupTimer = setInterval(() => {
      this.runCleanupTasks().catch(error => {
        console.error('Error in automatic cleanup:', error);
      });
    }, intervalHours * 60 * 60 * 1000);

    // Run initial cleanup
    this.runCleanupTasks().catch(error => {
      console.error('Error in initial cleanup:', error);
    });
  }

  // Stop automatic cleanup
  public stopAutomaticCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('File cleanup service stopped');
    }
  }

  // Run all cleanup tasks
  public async runCleanupTasks(): Promise<{
    tempFilesDeleted: number;
    orphanedFilesDeleted: number;
    totalSpaceFreed: number;
  }> {
    console.log('Starting file cleanup tasks...');
    
    const tempFilesDeleted = await this.cleanupTemporaryFiles();
    const orphanedFilesDeleted = await this.cleanupOrphanedFiles();
    const totalSpaceFreed = await this.calculateSpaceFreed();

    console.log(`Cleanup completed: ${tempFilesDeleted} temp files, ${orphanedFilesDeleted} orphaned files deleted`);
    
    return {
      tempFilesDeleted,
      orphanedFilesDeleted,
      totalSpaceFreed
    };
  }

  // Clean up temporary files older than specified hours
  public async cleanupTemporaryFiles(olderThanHours: number = 24): Promise<number> {
    try {
      return await cleanupTempFiles(olderThanHours);
    } catch (error) {
      console.error('Error cleaning up temporary files:', error);
      return 0;
    }
  }

  // Find and remove orphaned files (files on disk without database records)
  public async cleanupOrphanedFiles(): Promise<number> {
    let deletedCount = 0;

    try {
      // Get all file records from database
      const dbFiles = await prisma.attachment.findMany({
        select: {
          filename: true,
          path: true,
          thumbnailPath: true
        }
      });

      const dbFilenames = new Set<string>();
      const dbThumbnails = new Set<string>();

      dbFiles.forEach(file => {
        if (file.filename) dbFilenames.add(file.filename);
        if (file.thumbnailPath) dbThumbnails.add(file.thumbnailPath);
      });

      // Check documents directory
      const documentsDir = path.join(FILE_STORAGE_CONFIG.UPLOAD_DIR, FILE_STORAGE_CONFIG.DIRECTORIES.DOCUMENTS);
      deletedCount += await this.removeOrphanedFilesInDirectory(documentsDir, dbFilenames);

      // Check thumbnails directory
      const thumbnailsDir = path.join(FILE_STORAGE_CONFIG.UPLOAD_DIR, FILE_STORAGE_CONFIG.DIRECTORIES.THUMBNAILS);
      deletedCount += await this.removeOrphanedFilesInDirectory(thumbnailsDir, dbThumbnails);

      // Note: We don't cleanup avatars directory as they're referenced in user.avatarPath
      // and might have different naming patterns

    } catch (error) {
      console.error('Error cleaning up orphaned files:', error);
    }

    return deletedCount;
  }

  // Helper method to remove orphaned files in a specific directory
  private async removeOrphanedFilesInDirectory(
    directory: string, 
    validFilenames: Set<string>
  ): Promise<number> {
    let deletedCount = 0;

    try {
      const files = await fs.readdir(directory);
      
      for (const filename of files) {
        if (!validFilenames.has(filename)) {
          const filePath = path.join(directory, filename);
          const stats = await fs.stat(filePath);
          
          // Only delete files older than 1 day to avoid deleting recently uploaded files
          // that might not have been processed yet
          if (Date.now() - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
            const deleted = await deleteFile(filePath);
            if (deleted) {
              deletedCount++;
              console.log(`Deleted orphaned file: ${filename}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error processing directory ${directory}:`, error);
    }

    return deletedCount;
  }

  // Find database records without corresponding files
  public async findMissingFiles(): Promise<{
    id: string;
    filename: string;
    path: string;
    originalName: string;
  }[]> {
    const missingFiles: {
      id: string;
      filename: string;
      path: string;
      originalName: string;
    }[] = [];

    try {
      const attachments = await prisma.attachment.findMany({
        select: {
          id: true,
          filename: true,
          path: true,
          originalName: true
        }
      });

      for (const attachment of attachments) {
        try {
          await fs.access(attachment.path);
        } catch {
          missingFiles.push({
            id: attachment.id,
            filename: attachment.filename,
            path: attachment.path,
            originalName: attachment.originalName
          });
        }
      }
    } catch (error) {
      console.error('Error finding missing files:', error);
    }

    return missingFiles;
  }

  // Clean up database records for missing files
  public async cleanupMissingFileRecords(): Promise<number> {
    const missingFiles = await this.findMissingFiles();
    
    if (missingFiles.length === 0) {
      return 0;
    }

    try {
      const fileIds = missingFiles.map(file => file.id);
      
      const result = await prisma.attachment.deleteMany({
        where: {
          id: { in: fileIds }
        }
      });

      console.log(`Cleaned up ${result.count} database records for missing files`);
      return result.count;
    } catch (error) {
      console.error('Error cleaning up missing file records:', error);
      return 0;
    }
  }

  // Calculate total storage usage
  public async calculateStorageUsage(): Promise<{
    totalSize: number;
    documentSize: number;
    avatarSize: number;
    thumbnailSize: number;
    tempSize: number;
  }> {
    try {
      const [documentSize, avatarSize, thumbnailSize, tempSize] = await Promise.all([
        getDirectorySize(path.join(FILE_STORAGE_CONFIG.UPLOAD_DIR, FILE_STORAGE_CONFIG.DIRECTORIES.DOCUMENTS)),
        getDirectorySize(path.join(FILE_STORAGE_CONFIG.UPLOAD_DIR, FILE_STORAGE_CONFIG.DIRECTORIES.AVATARS)),
        getDirectorySize(path.join(FILE_STORAGE_CONFIG.UPLOAD_DIR, FILE_STORAGE_CONFIG.DIRECTORIES.THUMBNAILS)),
        getDirectorySize(path.join(FILE_STORAGE_CONFIG.UPLOAD_DIR, FILE_STORAGE_CONFIG.DIRECTORIES.TEMP))
      ]);

      const totalSize = documentSize + avatarSize + thumbnailSize + tempSize;

      return {
        totalSize,
        documentSize,
        avatarSize,
        thumbnailSize,
        tempSize
      };
    } catch (error) {
      console.error('Error calculating storage usage:', error);
      return {
        totalSize: 0,
        documentSize: 0,
        avatarSize: 0,
        thumbnailSize: 0,
        tempSize: 0
      };
    }
  }

  // Cleanup old user avatars when new ones are uploaded
  public async cleanupOldAvatars(userId: string, currentAvatarPath: string): Promise<boolean> {
    try {
      const avatarDir = path.join(FILE_STORAGE_CONFIG.UPLOAD_DIR, FILE_STORAGE_CONFIG.DIRECTORIES.AVATARS);
      const files = await fs.readdir(avatarDir);
      
      // Find old avatar files for this user
      const userAvatarPattern = new RegExp(`avatar_${userId}_\\d+_[a-f0-9]+\\.jpg$`, 'i');
      let deletedCount = 0;

      for (const filename of files) {
        if (filename !== currentAvatarPath && userAvatarPattern.test(filename)) {
          const filePath = path.join(avatarDir, filename);
          const deleted = await deleteFile(filePath);
          if (deleted) {
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old avatar files for user ${userId}`);
      }

      return deletedCount > 0;
    } catch (error) {
      console.error('Error cleaning up old avatars:', error);
      return false;
    }
  }

  // Get storage quota information
  public async getStorageQuota(userId?: string): Promise<{
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
  }> {
    try {
      let used = 0;
      const limit = 100 * 1024 * 1024 * 1024; // 100GB default limit

      if (userId) {
        // Get user-specific usage
        const result = await prisma.attachment.aggregate({
          where: { uploadedBy: userId },
          _sum: { size: true }
        });
        used = result._sum.size || 0;
      } else {
        // Get total system usage
        const result = await prisma.attachment.aggregate({
          _sum: { size: true }
        });
        used = result._sum.size || 0;
      }

      const remaining = Math.max(0, limit - used);
      const percentUsed = (used / limit) * 100;

      return {
        used,
        limit,
        remaining,
        percentUsed
      };
    } catch (error) {
      console.error('Error calculating storage quota:', error);
      return {
        used: 0,
        limit: 0,
        remaining: 0,
        percentUsed: 0
      };
    }
  }

  // Calculate space freed in recent cleanup
  private async calculateSpaceFreed(): Promise<number> {
    // This is a placeholder - in a real implementation, you'd track
    // the size of files being deleted during cleanup
    return 0;
  }

  // Emergency cleanup when storage is full
  public async emergencyCleanup(): Promise<number> {
    console.log('Starting emergency cleanup...');
    
    let totalFreed = 0;
    
    // Clean temp files older than 1 hour
    totalFreed += await this.cleanupTemporaryFiles(1);
    
    // Clean orphaned files
    totalFreed += await this.cleanupOrphanedFiles();
    
    // Clean missing file records
    totalFreed += await this.cleanupMissingFileRecords();
    
    console.log(`Emergency cleanup completed, freed space for ${totalFreed} files`);
    return totalFreed;
  }
}

// Export singleton instance
export const fileCleanupService = FileCleanupService.getInstance();