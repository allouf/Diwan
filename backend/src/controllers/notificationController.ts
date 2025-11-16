import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { createError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';

/**
 * Get user notifications with pagination
 * GET /api/notifications
 */
export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      unreadOnly = false,
    } = req.query as any;

    const userId = req.user!.id;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where: any = { recipientUserId: userId };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          document: {
            select: {
              id: true,
              referenceNumber: true,
              subject: true,
              status: true,
              priority: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              nameAr: true,
            },
          },
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { recipientUserId: userId, isRead: false },
      }),
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    const response: ApiResponse = {
      success: true,
      data: {
        data: notifications,
        meta: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages,
          unreadCount,
        },
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
export const markNotificationAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if notification exists and belongs to user
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw createError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }

    if (notification.recipientUserId !== userId) {
      throw createError('Access denied to this notification', 403, 'ACCESS_DENIED');
    }

    // Mark as read
    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      include: {
        document: {
          select: {
            referenceNumber: true,
            subject: true,
          },
        },
      },
    });

    const response: ApiResponse = {
      success: true,
      data: updatedNotification,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
export const markAllNotificationsAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Update all unread notifications for user
    const result = await prisma.notification.updateMany({
      where: {
        recipientUserId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'All notifications marked as read',
        updatedCount: result.count,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notifications count
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const count = await prisma.notification.count({
      where: {
        recipientUserId: userId,
        isRead: false,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: { unreadCount: count },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Create notification (admin/system only)
 * POST /api/notifications
 */
export const createNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      documentId,
      recipientUserIds,
      departmentId,
      message,
      messageAr,
    } = req.body;

    // Validate required fields
    if (!documentId || !recipientUserIds || !Array.isArray(recipientUserIds) || recipientUserIds.length === 0) {
      throw createError('Document ID and recipient user IDs are required', 400, 'INVALID_INPUT');
    }

    if (!message || !messageAr) {
      throw createError('Message in both languages is required', 400, 'INVALID_INPUT');
    }

    // Verify document exists
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw createError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Verify users exist
    const users = await prisma.user.findMany({
      where: { id: { in: recipientUserIds } },
    });

    if (users.length !== recipientUserIds.length) {
      throw createError('One or more recipient users not found', 404, 'USER_NOT_FOUND');
    }

    // Create notifications for all recipients
    const notifications = await prisma.notification.createMany({
      data: recipientUserIds.map((userId: string) => ({
        documentId,
        recipientUserId: userId,
        departmentId: departmentId || users.find(u => u.id === userId)?.departmentId || '',
        message,
        messageAr,
      })),
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'Notifications Created',
        actionAr: 'تم إنشاء الإشعارات',
        details: `Created ${notifications.count} notifications for document ${document.referenceNumber}`,
        userId: req.user!.id,
        documentId,
        documentReference: document.referenceNumber,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Notifications created successfully',
        count: notifications.count,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete notification
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if notification exists and belongs to user
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw createError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }

    // Only allow users to delete their own notifications or admin
    if (notification.recipientUserId !== userId && req.user!.role !== 'ADMIN') {
      throw createError('Access denied to this notification', 403, 'ACCESS_DENIED');
    }

    // Delete notification
    await prisma.notification.delete({
      where: { id },
    });

    const response: ApiResponse = {
      success: true,
      data: { message: 'Notification deleted successfully' },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};