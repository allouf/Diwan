import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const getActivitiesSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  userId: z.string().optional(),
  action: z.string().optional(),
  relatedId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z.enum(['timestamp', 'action', 'userId']).default('timestamp'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Get activity logs with filtering and pagination
export const getActivityLogs = async (req: Request, res: Response) => {
  try {
    const validatedQuery = getActivitiesSchema.parse(req.query);
    const currentUser = req.user!;

    // Only admins and correspondence officers can view all activity logs
    if (!['ADMIN', 'CORRESPONDENCE_OFFICER'].includes(currentUser.role)) {
      return res.status(403).json({ message: 'Insufficient permissions to view activity logs' });
    }

    const {
      page,
      limit,
      userId,
      action,
      relatedId,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder
    } = validatedQuery;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (userId) where.userId = userId;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (relatedId) where.relatedId = relatedId;
    
    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = new Date(dateFrom);
      if (dateTo) where.timestamp.lte = new Date(dateTo);
    }

    // Get activity logs
    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          details: true,
          relatedId: true,
          timestamp: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              department: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder
        }
      }),
      prisma.activityLog.count({ where })
    ]);

    return res.json({
      activities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        userId,
        action,
        relatedId,
        dateFrom,
        dateTo
      },
      sorting: {
        sortBy,
        sortOrder
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.issues
      });
    }
    console.error('Error fetching activity logs:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get user's own activity logs
export const getUserActivityLogs = async (req: Request, res: Response) => {
  try {
    const validatedQuery = getActivitiesSchema.parse(req.query);
    const currentUser = req.user!;

    const {
      page,
      limit,
      action,
      relatedId,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder
    } = validatedQuery;

    const skip = (page - 1) * limit;

    // Build where clause - only show current user's activities
    const where: any = { userId: currentUser.id };
    
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (relatedId) where.relatedId = relatedId;
    
    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = new Date(dateFrom);
      if (dateTo) where.timestamp.lte = new Date(dateTo);
    }

    // Get activity logs
    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          details: true,
          relatedId: true,
          timestamp: true
        },
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder
        }
      }),
      prisma.activityLog.count({ where })
    ]);

    return res.json({
      activities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        action,
        relatedId,
        dateFrom,
        dateTo
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.issues
      });
    }
    console.error('Error fetching user activity logs:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get activity statistics
export const getActivityStatistics = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;

    // Only admins and correspondence officers can view activity statistics
    if (!['ADMIN', 'CORRESPONDENCE_OFFICER'].includes(currentUser.role)) {
      return res.status(403).json({ message: 'Insufficient permissions to view activity statistics' });
    }

    const [
      totalActivities,
      activitiesByAction,
      activitiesByUser,
      recentActivities,
      dailyStats
    ] = await Promise.all([
      // Total activity count
      prisma.activityLog.count(),

      // Activities by action type
      prisma.activityLog.groupBy({
        by: ['action'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
      }),

      // Top users by activity count
      prisma.activityLog.groupBy({
        by: ['userId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      }),

      // Recent activities
      prisma.activityLog.findMany({
        take: 20,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          action: true,
          details: true,
          timestamp: true,
          user: {
            select: {
              fullName: true,
              role: true
            }
          }
        }
      }),

      // Daily activity stats for the last 30 days
      prisma.$queryRaw`
        SELECT
          DATE(timestamp) as date,
          COUNT(*) as count
        FROM ActivityLog
        WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `
    ]);

    // Get user details for top users
    const userIds = activitiesByUser.map(item => item.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        fullName: true,
        role: true,
        department: {
          select: { name: true }
        }
      }
    });

    const userMap = users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<string, any>);

    const topUsersByActivity = activitiesByUser.map(item => ({
      user: userMap[item.userId],
      activityCount: item._count.id
    }));

    return res.json({
      overview: {
        totalActivities
      },
      byAction: activitiesByAction.map(item => ({
        action: item.action,
        count: item._count.id
      })),
      topUsers: topUsersByActivity,
      recentActivities,
      dailyStats
    });
  } catch (error) {
    console.error('Error fetching activity statistics:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get activities for a specific document
export const getDocumentActivities = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const currentUser = req.user!;

    // Check if user has access to the document
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
      return res.status(403).json({ message: 'Insufficient permissions to view document activities' });
    }

    // Get document activities
    const activities = await prisma.activityLog.findMany({
      where: { relatedId: documentId },
      select: {
        id: true,
        action: true,
        details: true,
        timestamp: true,
        user: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    return res.json({
      documentId,
      activities
    });
  } catch (error) {
    console.error('Error fetching document activities:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get activity summary for dashboard
export const getActivitySummary = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;

    // Get user-specific activity summary
    const [
      userActivities,
      todayActivities,
      weekActivities,
      recentUserActivities
    ] = await Promise.all([
      // User's total activities
      prisma.activityLog.count({
        where: { userId: currentUser.id }
      }),

      // Today's activities (all users if admin, user-specific otherwise)
      prisma.activityLog.count({
        where: {
          ...((['ADMIN', 'CORRESPONDENCE_OFFICER'].includes(currentUser.role)) 
            ? {} 
            : { userId: currentUser.id }
          ),
          timestamp: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),

      // This week's activities
      prisma.activityLog.count({
        where: {
          ...((['ADMIN', 'CORRESPONDENCE_OFFICER'].includes(currentUser.role)) 
            ? {} 
            : { userId: currentUser.id }
          ),
          timestamp: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Recent user activities
      prisma.activityLog.findMany({
        where: { userId: currentUser.id },
        take: 10,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          action: true,
          details: true,
          timestamp: true
        }
      })
    ]);

    return res.json({
      userStats: {
        total: userActivities,
        today: todayActivities,
        thisWeek: weekActivities
      },
      recentActivities: recentUserActivities
    });
  } catch (error) {
    console.error('Error fetching activity summary:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};