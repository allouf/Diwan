import { Request, Response } from 'express';
import { PrismaClient, DocumentStatus } from '../generated/prisma';
import { logActivity } from '../lib/db-utils';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const updateStatusSchema = z.object({
  status: z.nativeEnum(DocumentStatus),
  comment: z.string().optional(),
  assignToId: z.string().optional().nullable()
});

const bulkStatusUpdateSchema = z.object({
  documentIds: z.array(z.string()).min(1),
  status: z.nativeEnum(DocumentStatus),
  comment: z.string().optional()
});

// Status workflow rules
const STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: ['PENDING', 'COMPLETED'],
  PENDING: ['IN_PROGRESS', 'COMPLETED', 'REJECTED'],
  IN_PROGRESS: ['COMPLETED', 'PENDING', 'ON_HOLD'],
  ON_HOLD: ['IN_PROGRESS', 'PENDING'],
  COMPLETED: ['ARCHIVED'],
  REJECTED: ['PENDING', 'DRAFT'],
  ARCHIVED: [] // No transitions allowed from archived
};

const validateStatusTransition = (currentStatus: DocumentStatus, newStatus: DocumentStatus): boolean => {
  if (currentStatus === newStatus) return true;
  return STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
};

// Update document status
export const updateDocumentStatus = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const validatedData = updateStatusSchema.parse(req.body);
    const currentUser = req.user!;

    // Get current document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        referenceNumber: true,
        subject: true,
        status: true,
        createdById: true,
        assignedToId: true,
        departments: {
          select: {
            department: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check permissions
    const canUpdate = 
      currentUser.role === 'ADMIN' ||
      currentUser.role === 'CORRESPONDENCE_OFFICER' ||
      document.createdById === currentUser.id ||
      document.assignedToId === currentUser.id ||
      (currentUser.role === 'DEPARTMENT_HEAD' && 
       document.departments.some(d => d.department.id === currentUser.departmentId));

    if (!canUpdate) {
      return res.status(403).json({ message: 'Insufficient permissions to update document status' });
    }

    // Validate status transition
    if (!validateStatusTransition(document.status, validatedData.status)) {
      return res.status(400).json({
        message: `Invalid status transition from ${document.status} to ${validatedData.status}`,
        allowedTransitions: STATUS_TRANSITIONS[document.status]
      });
    }

    // Validate assignee if provided
    if (validatedData.assignToId) {
      const assignee = await prisma.user.findUnique({
        where: { id: validatedData.assignToId },
        select: { id: true, fullName: true, role: true, status: true }
      });

      if (!assignee || assignee.status !== 'ACTIVE') {
        return res.status(400).json({ message: 'Invalid or inactive assignee' });
      }
    }

    // Update document
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        status: validatedData.status,
        assignedToId: validatedData.assignToId,
        updatedAt: new Date()
      },
      select: {
        id: true,
        referenceNumber: true,
        subject: true,
        status: true,
        assignedToId: true,
        updatedAt: true,
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    // Create activity log entry
    const statusChangeLog = `Status changed from ${document.status} to ${validatedData.status}`;
    const assignmentLog = validatedData.assignToId ? 
      ` and assigned to ${updatedDocument.assignedTo?.fullName}` : '';
    const commentLog = validatedData.comment ? ` - Comment: ${validatedData.comment}` : '';

    await logActivity(
      currentUser.id,
      'UPDATE_DOCUMENT_STATUS',
      `${statusChangeLog}${assignmentLog}${commentLog}`,
      documentId
    );

    // Create notification for assignee
    if (validatedData.assignToId && validatedData.assignToId !== currentUser.id) {
      await prisma.notification.create({
        data: {
          userId: validatedData.assignToId,
          title: 'Document Assigned',
          message: `Document "${document.subject}" (${document.referenceNumber}) has been assigned to you. Status: ${validatedData.status}`,
          type: 'DOCUMENT_ASSIGNED',
          relatedId: documentId
        }
      });
    }

    // Create notification for document creator if status changed significantly
    if (['COMPLETED', 'REJECTED', 'ARCHIVED'].includes(validatedData.status) && 
        document.createdById !== currentUser.id) {
      await prisma.notification.create({
        data: {
          userId: document.createdById,
          title: 'Document Status Updated',
          message: `Your document "${document.subject}" (${document.referenceNumber}) status has been updated to ${validatedData.status}`,
          type: 'DOCUMENT_STATUS_CHANGED',
          relatedId: documentId
        }
      });
    }

    res.json({
      document: updatedDocument,
      previousStatus: document.status,
      comment: validatedData.comment
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    console.error('Error updating document status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get status transition history for a document
export const getDocumentStatusHistory = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const currentUser = req.user!;

    // Check if document exists and user has access
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        createdById: true,
        assignedToId: true,
        departments: {
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
       document.departments.some(d => d.department.id === currentUser.departmentId));

    if (!hasAccess) {
      return res.status(403).json({ message: 'Insufficient permissions to view document status history' });
    }

    // Get status change history from activity logs
    const statusHistory = await prisma.activityLog.findMany({
      where: {
        relatedId: documentId,
        action: 'UPDATE_DOCUMENT_STATUS'
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        details: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        }
      }
    });

    res.json({ statusHistory });
  } catch (error) {
    console.error('Error fetching document status history:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Bulk update document statuses
export const bulkUpdateDocumentStatus = async (req: Request, res: Response) => {
  try {
    const validatedData = bulkStatusUpdateSchema.parse(req.body);
    const currentUser = req.user!;

    // Only admins and correspondence officers can do bulk updates
    if (!['ADMIN', 'CORRESPONDENCE_OFFICER'].includes(currentUser.role)) {
      return res.status(403).json({ message: 'Insufficient permissions for bulk status updates' });
    }

    // Get documents to update
    const documents = await prisma.document.findMany({
      where: { id: { in: validatedData.documentIds } },
      select: {
        id: true,
        referenceNumber: true,
        subject: true,
        status: true,
        createdById: true
      }
    });

    if (documents.length === 0) {
      return res.status(404).json({ message: 'No documents found' });
    }

    // Validate transitions for all documents
    const invalidTransitions = documents.filter(doc => 
      !validateStatusTransition(doc.status, validatedData.status)
    );

    if (invalidTransitions.length > 0) {
      return res.status(400).json({
        message: 'Some documents have invalid status transitions',
        invalidDocuments: invalidTransitions.map(doc => ({
          id: doc.id,
          referenceNumber: doc.referenceNumber,
          currentStatus: doc.status,
          requestedStatus: validatedData.status
        }))
      });
    }

    // Update documents
    const updateResult = await prisma.document.updateMany({
      where: { id: { in: validatedData.documentIds } },
      data: {
        status: validatedData.status,
        updatedAt: new Date()
      }
    });

    // Log activities for each document
    const activityPromises = documents.map(doc => 
      logActivity(
        currentUser.id,
        'BULK_UPDATE_DOCUMENT_STATUS',
        `Bulk status update from ${doc.status} to ${validatedData.status}${
          validatedData.comment ? ` - Comment: ${validatedData.comment}` : ''
        }`,
        doc.id
      )
    );

    await Promise.all(activityPromises);

    // Create notifications for document creators
    const notificationPromises = documents
      .filter(doc => doc.createdById !== currentUser.id)
      .map(doc => 
        prisma.notification.create({
          data: {
            userId: doc.createdById,
            title: 'Document Status Updated (Bulk)',
            message: `Your document "${doc.subject}" (${doc.referenceNumber}) status has been updated to ${validatedData.status}`,
            type: 'DOCUMENT_STATUS_CHANGED',
            relatedId: doc.id
          }
        })
      );

    await Promise.all(notificationPromises);

    res.json({
      message: `Successfully updated ${updateResult.count} documents`,
      updatedCount: updateResult.count,
      newStatus: validatedData.status
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    console.error('Error bulk updating document status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get available status transitions for a document
export const getAvailableStatusTransitions = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { status: true }
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const availableTransitions = STATUS_TRANSITIONS[document.status] || [];

    res.json({
      currentStatus: document.status,
      availableTransitions,
      transitionRules: STATUS_TRANSITIONS
    });
  } catch (error) {
    console.error('Error fetching available status transitions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get status workflow overview
export const getStatusWorkflow = async (req: Request, res: Response) => {
  try {
    // Get document count by status
    const statusCounts = await prisma.document.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    // Get recent status changes
    const recentChanges = await prisma.activityLog.findMany({
      where: { action: 'UPDATE_DOCUMENT_STATUS' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        details: true,
        createdAt: true,
        relatedId: true,
        user: {
          select: {
            fullName: true
          }
        }
      }
    });

    res.json({
      statusCounts: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      workflowRules: STATUS_TRANSITIONS,
      recentChanges
    });
  } catch (error) {
    console.error('Error fetching status workflow:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};