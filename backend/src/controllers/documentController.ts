import { Request, Response, NextFunction } from 'express';
import { DocumentStatus, Priority, SenderType } from '../generated/prisma';
import prisma from '../lib/prisma';
import { generateReferenceNumber } from '../lib/db-utils';
import { createError } from '../middleware/errorHandler';
import { ApiResponse, PaginatedResponse } from '../types';

interface DocumentQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: DocumentStatus[];
  priority?: Priority[];
  categoryId?: string;
  departmentId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Create new document
 * POST /api/documents
 */
export const createDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      subject,
      summary,
      senderType,
      senderName,
      categoryId,
      priority = Priority.NORMAL,
      physicalLocation,
      departmentIds = [],
      dateReceived = new Date(),
    } = req.body;

    // Generate unique reference number
    const referenceNumber = await generateReferenceNumber();

    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw createError('Category not found', 404, 'CATEGORY_NOT_FOUND');
    }

    // Verify departments exist
    if (departmentIds.length > 0) {
      const departments = await prisma.department.findMany({
        where: { id: { in: departmentIds } },
      });

      if (departments.length !== departmentIds.length) {
        throw createError('One or more departments not found', 404, 'DEPARTMENT_NOT_FOUND');
      }
    }

    // Create document in transaction
    const document = await prisma.$transaction(async (tx) => {
      // Create the document
      const newDoc = await tx.document.create({
        data: {
          referenceNumber,
          dateReceived: new Date(dateReceived),
          subject,
          summary,
          senderType,
          senderName,
          priority,
          physicalLocation,
          status: DocumentStatus.DRAFT,
          categoryId,
          createdById: req.user!.id,
        },
        include: {
          category: {
            select: { id: true, name: true, nameAr: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Assign to departments
      if (departmentIds.length > 0) {
        await tx.documentDepartment.createMany({
          data: departmentIds.map((deptId: string) => ({
            documentId: newDoc.id,
            departmentId: deptId,
          })),
        });
      }

      // Log activity
      await tx.activityLog.create({
        data: {
          action: 'Document Created',
          actionAr: 'تم إنشاء الوثيقة',
          details: `Document ${referenceNumber} created: ${subject}`,
          userId: req.user!.id,
          documentId: newDoc.id,
          documentReference: referenceNumber,
        },
      });

      return newDoc;
    });

    const response: ApiResponse = {
      success: true,
      data: {
        document,
        message: 'Document created successfully',
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get documents with filtering and pagination
 * GET /api/documents
 */
export const getDocuments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      priority,
      categoryId,
      departmentId,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as any;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause
    const where: any = {};

    // Role-based filtering
    if (req.user?.role === 'DEPARTMENT_USER' || req.user?.role === 'DEPARTMENT_HEAD') {
      where.assignedDepartments = {
        some: {
          departmentId: req.user.departmentId,
        },
      };
    }

    // Search functionality
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { senderName: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by status
    if (status && status.length > 0) {
      where.status = { in: Array.isArray(status) ? status : [status] };
    }

    // Filter by priority
    if (priority && priority.length > 0) {
      where.priority = { in: Array.isArray(priority) ? priority : [priority] };
    }

    // Filter by category
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Filter by department
    if (departmentId) {
      where.assignedDepartments = {
        some: {
          departmentId: departmentId,
        },
      };
    }

    // Date range filtering
    if (dateFrom || dateTo) {
      where.dateReceived = {};
      if (dateFrom) where.dateReceived.gte = new Date(dateFrom);
      if (dateTo) where.dateReceived.lte = new Date(dateTo);
    }

    // Get documents and total count
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          category: {
            select: { id: true, name: true, nameAr: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          assignedDepartments: {
            include: {
              department: {
                select: { id: true, name: true, nameAr: true },
              },
            },
          },
          _count: {
            select: {
              outcomes: true,
              attachments: true,
              seenEntries: true,
            },
          },
        },
      }),
      prisma.document.count({ where }),
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    const response: ApiResponse<PaginatedResponse<any>> = {
      success: true,
      data: {
        data: documents,
        meta: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages,
        },
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single document by ID
 * GET /api/documents/:id
 */
export const getDocumentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, nameAr: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        assignedDepartments: {
          include: {
            department: {
              select: { id: true, name: true, nameAr: true },
            },
          },
        },
        outcomes: {
          include: {
            department: {
              select: { id: true, name: true, nameAr: true },
            },
            loggedBy: {
              select: { id: true, name: true, email: true },
            },
            attachments: true,
          },
          orderBy: { loggedAt: 'desc' },
        },
        attachments: true,
        seenEntries: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            department: {
              select: { id: true, name: true, nameAr: true },
            },
          },
          orderBy: { seenAt: 'desc' },
        },
        activityLogs: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { timestamp: 'desc' },
          take: 20, // Limit activity logs
        },
      },
    });

    if (!document) {
      throw createError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Check if user has permission to view this document
    if (req.user?.role === 'DEPARTMENT_USER' || req.user?.role === 'DEPARTMENT_HEAD') {
      const hasAccess = document.assignedDepartments.some(
        (assignment) => assignment.departmentId === req.user!.departmentId
      );

      if (!hasAccess) {
        throw createError('Access denied to this document', 403, 'ACCESS_DENIED');
      }
    }

    // Mark document as seen by current user (if from department)
    if (req.user?.departmentId) {
      await prisma.documentSeenEntry.upsert({
        where: {
          documentId_userId: {
            documentId: id,
            userId: req.user.id,
          },
        },
        update: {
          seenAt: new Date(),
        },
        create: {
          documentId: id,
          userId: req.user.id,
          departmentId: req.user.departmentId,
          seenAt: new Date(),
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      data: document,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Update document
 * PUT /api/documents/:id
 */
export const updateDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      subject,
      summary,
      senderName,
      priority,
      physicalLocation,
      categoryId,
      status,
    } = req.body;

    // Check if document exists
    const existingDoc = await prisma.document.findUnique({
      where: { id },
    });

    if (!existingDoc) {
      throw createError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Check permissions (only admin and correspondence officer can update)
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'CORRESPONDENCE_OFFICER') {
      throw createError('Insufficient permissions to update document', 403, 'ACCESS_DENIED');
    }

    // Update document
    const updatedDocument = await prisma.document.update({
      where: { id },
      data: {
        ...(subject && { subject }),
        ...(summary && { summary }),
        ...(senderName && { senderName }),
        ...(priority && { priority }),
        ...(physicalLocation && { physicalLocation }),
        ...(categoryId && { categoryId }),
        ...(status && { status }),
        updatedAt: new Date(),
      },
      include: {
        category: {
          select: { id: true, name: true, nameAr: true },
        },
        assignedDepartments: {
          include: {
            department: {
              select: { id: true, name: true, nameAr: true },
            },
          },
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'Document Updated',
        actionAr: 'تم تحديث الوثيقة',
        details: `Document ${existingDoc.referenceNumber} updated`,
        userId: req.user!.id,
        documentId: id,
        documentReference: existingDoc.referenceNumber,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: updatedDocument,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Assign document to departments
 * POST /api/documents/:id/assign
 */
export const assignDocumentToDepartments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { departmentIds } = req.body;

    if (!departmentIds || !Array.isArray(departmentIds) || departmentIds.length === 0) {
      throw createError('Department IDs are required', 400, 'INVALID_INPUT');
    }

    // Check if document exists
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw createError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Check permissions
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'CORRESPONDENCE_OFFICER') {
      throw createError('Insufficient permissions', 403, 'ACCESS_DENIED');
    }

    // Verify departments exist
    const departments = await prisma.department.findMany({
      where: { id: { in: departmentIds } },
    });

    if (departments.length !== departmentIds.length) {
      throw createError('One or more departments not found', 404, 'DEPARTMENT_NOT_FOUND');
    }

    // Remove existing assignments and create new ones
    await prisma.$transaction(async (tx) => {
      // Remove existing assignments
      await tx.documentDepartment.deleteMany({
        where: { documentId: id },
      });

      // Create new assignments
      await tx.documentDepartment.createMany({
        data: departmentIds.map((deptId: string) => ({
          documentId: id,
          departmentId: deptId,
        })),
      });

      // Update document status to PENDING
      await tx.document.update({
        where: { id },
        data: { status: DocumentStatus.PENDING },
      });

      // Create notifications for department users
      const departmentUsers = await tx.user.findMany({
        where: {
          departmentId: { in: departmentIds },
          isActive: true,
        },
      });

      if (departmentUsers.length > 0) {
        await tx.notification.createMany({
          data: departmentUsers.map((user) => ({
            documentId: id,
            recipientUserId: user.id,
            departmentId: user.departmentId!,
            message: `New document assigned: ${document.referenceNumber}`,
            messageAr: `وثيقة جديدة تم تعيينها: ${document.referenceNumber}`,
          })),
        });
      }

      // Log activity
      await tx.activityLog.create({
        data: {
          action: 'Document Assigned',
          actionAr: 'تم تعيين الوثيقة',
          details: `Document ${document.referenceNumber} assigned to ${departments.length} department(s)`,
          userId: req.user!.id,
          documentId: id,
          documentReference: document.referenceNumber,
        },
      });
    });

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Document assigned successfully',
        assignedDepartments: departments.length,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};