import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';
import { z } from 'zod';
import { logActivity } from '../lib/db-utils';
import {
  getFilePath,
  getDocumentPath,
  getAvatarPath,
  getTempPath,
  deleteFile,
  formatFileSize,
  getFileMetadata
} from '../lib/fileStorage';
import {
  processAvatar,
  generateThumbnail,
  extractImageMetadata,
  validateImageIntegrity
} from '../lib/imageProcessing';

const prisma = new PrismaClient();

// Validation schemas
const uploadDocumentSchema = z.object({
  documentId: z.string().optional(),
  description: z.string().optional(),
  isPublic: z.union([z.boolean(), z.string()]).transform(val => {
    if (typeof val === 'string') {
      return val === 'true';
    }
    return val;
  }).default(false)
});

const fileAccessSchema = z.object({
  duration: z.number().min(1).max(24 * 7).optional() // Max 7 days
});

// Upload general files
export const uploadFiles = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    const currentUser = req.user!;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const uploadedFiles = [];

    for (const file of files) {
      // Generate thumbnail for images
      let thumbnailPath = null;
      if (file.mimetype.startsWith('image/')) {
        thumbnailPath = await generateThumbnail(file.path, file.originalname);
      }

      // Create file record in database
      const fileRecord = await prisma.attachment.create({
        data: {
          name: file.originalname,
          type: file.mimetype.split('/')[0] || 'file',
          url: `/api/files/${file.filename}`,
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path,
          thumbnailPath,
          uploadedBy: currentUser.id
        }
      });

      uploadedFiles.push({
        id: fileRecord.id,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
        thumbnailPath,
        uploadedAt: fileRecord.uploadedAt
      });
    }

    // Log activity
    await logActivity(
      currentUser.id,
      'UPLOAD_FILES',
      `Uploaded ${files.length} files: ${files.map(f => f.originalname).join(', ')}`
    );

    return res.json({
      message: `Successfully uploaded ${files.length} file(s)`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Upload document attachments
export const uploadDocumentAttachments = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    const currentUser = req.user!;
    const { documentId, description, isPublic } = uploadDocumentSchema.parse(req.body);

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    // Validate document access if documentId provided
    if (documentId) {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          createdById: true,
          assignedToId: true,
          assignedDepartments: {
            select: {
              department: {
                select: { id: true }
              }
            }
          }
        }
      });

      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check permissions
      const hasAccess =
        currentUser.role === 'ADMIN' ||
        currentUser.role === 'CORRESPONDENCE_OFFICER' ||
        document.createdById === currentUser.id ||
        document.assignedToId === currentUser.id ||
        (currentUser.departmentId &&
         document.assignedDepartments.some(d => d.department.id === currentUser.departmentId));

      if (!hasAccess) {
        return res.status(403).json({ message: 'Insufficient permissions to attach files to this document' });
      }
    }

    const uploadedFiles = [];

    for (const file of files) {
      // Generate thumbnail for images
      let thumbnailPath = null;
      if (file.mimetype.startsWith('image/')) {
        thumbnailPath = await generateThumbnail(file.path, file.originalname);
      }

      // Create attachment record
      const attachment = await prisma.attachment.create({
        data: {
          name: file.originalname,
          type: file.mimetype.split('/')[0] || 'file',
          url: `/api/files/${file.filename}`,
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path,
          thumbnailPath,
          description,
          uploadedBy: currentUser.id,
          isPublic: isPublic ?? false,
          ...(documentId && { documentId })
        }
      });

      uploadedFiles.push({
        id: attachment.id,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
        thumbnailPath,
        description: attachment.description,
        uploadedAt: attachment.uploadedAt
      });
    }

    // Log activity
    await logActivity(
      currentUser.id,
      'UPLOAD_DOCUMENT_ATTACHMENTS',
      `Uploaded ${files.length} attachments${documentId ? ` for document ${documentId}` : ''}: ${files.map(f => f.originalname).join(', ')}`,
      documentId
    );

    return res.json({
      message: `Successfully uploaded ${files.length} attachment(s)`,
      attachments: uploadedFiles
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.issues
      });
    }
    console.error('Error uploading document attachments:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Upload user avatar
export const uploadAvatar = async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.Multer.File;
    const currentUser = req.user!;

    if (!file) {
      return res.status(400).json({ message: 'No avatar file uploaded' });
    }

    // Validate image integrity
    const isValidImage = await validateImageIntegrity(file.path);
    if (!isValidImage) {
      await deleteFile(file.path);
      return res.status(400).json({ message: 'Invalid image file' });
    }

    // Process avatar (resize, optimize)
    const processedFilename = await processAvatar(file.path, currentUser.id);
    const avatarPath = getAvatarPath(processedFilename);

    // Update user avatar in database
    await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        avatar: processedFilename,
        updatedAt: new Date()
      }
    });

    // Log activity
    await logActivity(
      currentUser.id,
      'UPLOAD_AVATAR',
      `Updated profile avatar: ${file.originalname}`
    );

    return res.json({
      message: 'Avatar uploaded successfully',
      avatar: {
        filename: processedFilename,
        originalName: file.originalname,
        url: `/api/files/avatar/${processedFilename}`
      }
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return res.status(500).json({ message: 'Failed to upload avatar' });
  }
};

// Serve files with access control
export const serveFile = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const currentUser = req.user!;

    // Get file information from database
    const attachment = await prisma.attachment.findUnique({
      where: { id: fileId },
      include: {
        document: {
          select: {
            id: true,
            createdById: true,
            assignedToId: true,
            assignedDepartments: {
              select: {
                department: {
                  select: { id: true }
                }
              }
            }
          }
        }
      }
    });

    if (!attachment) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check file access permissions
    const isPublic = Boolean(attachment.isPublic);
    let hasAccess = false;

    if (isPublic) {
      hasAccess = true;
    } else if (currentUser.role === 'ADMIN' || currentUser.role === 'CORRESPONDENCE_OFFICER') {
      hasAccess = true;
    } else if (attachment.uploadedBy === currentUser.id) {
      hasAccess = true;
    } else if (attachment.document) {
      // Check document access permissions
      const doc = attachment.document;
      hasAccess =
        doc.createdById === currentUser.id ||
        doc.assignedToId === currentUser.id ||
        !!(currentUser.departmentId &&
         doc.assignedDepartments.some(d => d.department.id === currentUser.departmentId));
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if file exists
    try {
      await fs.access(attachment.path);
    } catch {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    // Log file access
    await logActivity(
      currentUser.id,
      'ACCESS_FILE',
      `Accessed file: ${attachment.originalName}`,
      attachment.document?.id
    );

    // Set appropriate headers
    res.setHeader('Content-Type', attachment.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.originalName}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    // Stream file
    return res.sendFile(path.resolve(attachment.path));
  } catch (error) {
    console.error('Error serving file:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Serve avatar files
export const serveAvatar = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const avatarPath = getAvatarPath(filename);

    // Check if file exists
    try {
      await fs.access(avatarPath);
    } catch {
      return res.status(404).json({ message: 'Avatar not found' });
    }

    // Set headers for avatar serving
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    res.setHeader('ETag', `"${filename}"`);

    // Stream file
    return res.sendFile(path.resolve(avatarPath));
  } catch (error) {
    console.error('Error serving avatar:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Serve thumbnail files
export const serveThumbnail = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const thumbnailPath = path.join(process.cwd(), 'uploads', 'thumbnails', filename);

    // Check if file exists
    try {
      await fs.access(thumbnailPath);
    } catch {
      return res.status(404).json({ message: 'Thumbnail not found' });
    }

    // Set headers
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Stream file
    return res.sendFile(path.resolve(thumbnailPath));
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get file information
export const getFileInfo = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const currentUser = req.user!;

    const attachment = await prisma.attachment.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimetype: true,
        size: true,
        description: true,
        isPublic: true,
        uploadedAt: true,
        uploadedBy: true,
        documentId: true,
        path: true,
        thumbnailPath: true
      }
    });

    if (!attachment) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Fetch related document and user info
    let document = null;
    let uploadedByUser = null;

    if (attachment.documentId) {
      document = await prisma.document.findUnique({
        where: { id: attachment.documentId },
        select: {
          id: true,
          subject: true,
          referenceNumber: true,
          createdById: true,
          assignedToId: true,
          assignedDepartments: {
            select: {
              department: {
                select: { id: true }
              }
            }
          }
        }
      });
    }

    if (attachment.uploadedBy) {
      uploadedByUser = await prisma.user.findUnique({
        where: { id: attachment.uploadedBy },
        select: {
          fullName: true,
          email: true
        }
      });
    }

    // Check access permissions (similar to serveFile)
    const isPublic = Boolean(attachment.isPublic);
    let hasAccess = isPublic ||
                   currentUser.role === 'ADMIN' ||
                   currentUser.role === 'CORRESPONDENCE_OFFICER' ||
                   attachment.uploadedBy === currentUser.id;

    if (!hasAccess && document) {
      hasAccess =
        document.createdById === currentUser.id ||
        document.assignedToId === currentUser.id ||
        !!(currentUser.departmentId &&
         document.assignedDepartments.some(d => d.department.id === currentUser.departmentId));
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get additional metadata for images
    let imageMetadata = null;
    if (attachment.mimetype.startsWith('image/')) {
      imageMetadata = await extractImageMetadata(attachment.path);
    }

    return res.json({
      id: attachment.id,
      filename: attachment.filename,
      originalName: attachment.originalName,
      mimetype: attachment.mimetype,
      size: attachment.size,
      sizeFormatted: formatFileSize(attachment.size),
      description: attachment.description,
      isPublic: attachment.isPublic,
      uploadedAt: attachment.uploadedAt,
      uploadedBy: uploadedByUser,
      document: document ? {
        id: document.id,
        subject: document.subject,
        referenceNumber: document.referenceNumber
      } : null,
      thumbnailPath: attachment.thumbnailPath,
      imageMetadata,
      downloadUrl: `/api/files/${attachment.id}`,
      ...(attachment.thumbnailPath && {
        thumbnailUrl: `/api/files/thumbnail/${attachment.thumbnailPath}`
      })
    });
  } catch (error) {
    console.error('Error getting file info:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete file
export const deleteFileById = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const currentUser = req.user!;

    const attachment = await prisma.attachment.findUnique({
      where: { id: fileId },
      include: {
        document: {
          select: {
            id: true,
            createdById: true
          }
        }
      }
    });

    if (!attachment) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check permissions to delete
    const canDelete = 
      currentUser.role === 'ADMIN' ||
      attachment.uploadedBy === currentUser.id ||
      (attachment.document && attachment.document.createdById === currentUser.id);

    if (!canDelete) {
      return res.status(403).json({ message: 'Insufficient permissions to delete this file' });
    }

    // Delete physical files
    await deleteFile(attachment.path);
    if (attachment.thumbnailPath) {
      await deleteFile(path.join(process.cwd(), 'uploads', 'thumbnails', attachment.thumbnailPath));
    }

    // Delete database record
    await prisma.attachment.delete({
      where: { id: fileId }
    });

    // Log activity
    await logActivity(
      currentUser.id,
      'DELETE_FILE',
      `Deleted file: ${attachment.originalName}`,
      attachment.document?.id
    );

    return res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get storage statistics
export const getStorageStats = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;

    // Only admins can view storage statistics
    if (currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const [
      totalFiles,
      totalSize,
      filesByType,
      storageByUser,
      recentUploads
    ] = await Promise.all([
      prisma.attachment.count(),
      prisma.attachment.aggregate({
        _sum: { size: true }
      }),
      prisma.attachment.groupBy({
        by: ['mimetype'],
        _count: { id: true },
        _sum: { size: true }
      }),
      prisma.attachment.groupBy({
        by: ['uploadedBy'],
        _count: { id: true },
        _sum: { size: true },
        orderBy: {
          _sum: {
            size: 'desc'
          }
        },
        take: 10
      }),
      prisma.attachment.findMany({
        orderBy: { uploadedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          originalName: true,
          size: true,
          uploadedAt: true,
          uploadedBy: true
        }
      })
    ]);

    // Get user details for storage stats
    const userIds = storageByUser.map(item => item.uploadedBy);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, email: true }
    });

    const userMap = users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<string, any>);

    return res.json({
      overview: {
        totalFiles,
        totalSize: totalSize._sum.size || 0,
        totalSizeFormatted: formatFileSize(totalSize._sum.size || 0)
      },
      filesByType: filesByType.map(item => ({
        mimetype: item.mimetype,
        count: item._count.id,
        size: item._sum.size || 0,
        sizeFormatted: formatFileSize(item._sum.size || 0)
      })),
      storageByUser: storageByUser.map(item => ({
        user: userMap[item.uploadedBy],
        fileCount: item._count.id,
        totalSize: item._sum.size || 0,
        totalSizeFormatted: formatFileSize(item._sum.size || 0)
      })),
      recentUploads
    });
  } catch (error) {
    console.error('Error fetching storage statistics:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};