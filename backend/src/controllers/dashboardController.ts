import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { getDocumentStats } from '../lib/db-utils';
import { createError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';

/**
 * Get overall system statistics
 * GET /api/dashboard/stats
 */
export const getSystemStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get basic document statistics
    const documentStats = await getDocumentStats();

    // Get additional system statistics
    const [
      totalUsers,
      activeUsers,
      totalDepartments,
      totalCategories,
      recentActivity,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.department.count({ where: { isActive: true } }),
      prisma.category.count({ where: { isActive: true } }),
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
      }),
    ]);

    const stats = {
      ...documentStats,
      totalUsers,
      activeUsers,
      totalDepartments,
      totalCategories,
      recentActivity,
      systemHealth: {
        status: 'healthy',
        timestamp: new Date(),
      },
    };

    const response: ApiResponse = {
      success: true,
      data: stats,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get user-specific dashboard data
 * GET /api/dashboard/user-stats
 */
export const getUserStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const departmentId = req.user!.departmentId;

    // Base stats for all users
    let stats: any = {
      user: {
        id: userId,
        role: userRole,
        departmentId,
      },
    };

    if (userRole === 'ADMIN' || userRole === 'CORRESPONDENCE_OFFICER') {
      // Full system access - get comprehensive stats
      const documentStats = await getDocumentStats();
      stats = {
        ...stats,
        documentStats,
      };
    } else if (userRole === 'DEPARTMENT_HEAD' || userRole === 'DEPARTMENT_USER') {
      // Department-specific stats
      if (!departmentId) {
        throw createError('User has no department assigned', 400, 'NO_DEPARTMENT');
      }

      const [
        assignedDocuments,
        unseenDocuments,
        completedDocuments,
        pendingDocuments,
        myNotifications,
        departmentActivity,
      ] = await Promise.all([
        // Total documents assigned to user's department
        prisma.document.count({
          where: {
            assignedDepartments: {
              some: { departmentId },
            },
          },
        }),

        // Unseen documents by this user
        prisma.document.count({
          where: {
            assignedDepartments: {
              some: { departmentId },
            },
            seenEntries: {
              none: { userId },
            },
            status: {
              notIn: ['COMPLETED', 'ARCHIVED'],
            },
          },
        }),

        // Completed documents
        prisma.document.count({
          where: {
            assignedDepartments: {
              some: { departmentId },
            },
            status: 'COMPLETED',
          },
        }),

        // Pending documents
        prisma.document.count({
          where: {
            assignedDepartments: {
              some: { departmentId },
            },
            status: 'PENDING',
          },
        }),

        // User's unread notifications
        prisma.notification.findMany({
          where: {
            recipientUserId: userId,
            isRead: false,
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            document: {
              select: { referenceNumber: true, subject: true },
            },
          },
        }),

        // Recent department activity
        prisma.activityLog.findMany({
          where: {
            OR: [
              { userId },
              {
                document: {
                  assignedDepartments: {
                    some: { departmentId },
                  },
                },
              },
            ],
          },
          take: 10,
          orderBy: { timestamp: 'desc' },
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        }),
      ]);

      stats = {
        ...stats,
        assignedDocuments,
        unseenDocuments,
        completedDocuments,
        pendingDocuments,
        notifications: myNotifications,
        recentActivity: departmentActivity,
      };
    }

    const response: ApiResponse = {
      success: true,
      data: stats,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get analytics for document processing trends
 * GET /api/analytics/documents
 */
export const getDocumentAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { timeframe = 'month' } = req.query;

    // Calculate date range based on timeframe
    const now = new Date();
    let startDate: Date;
    
    switch (timeframe) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStart, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get analytics data
    const [
      documentsOverTime,
      statusDistribution,
      priorityDistribution,
      departmentPerformance,
      categoryDistribution,
    ] = await Promise.all([
      // Documents created over time (daily aggregation)
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM documents 
        WHERE created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,

      // Document status distribution
      prisma.document.groupBy({
        by: ['status'],
        _count: { status: true },
        where: {
          createdAt: { gte: startDate },
        },
      }),

      // Priority distribution
      prisma.document.groupBy({
        by: ['priority'],
        _count: { priority: true },
        where: {
          createdAt: { gte: startDate },
        },
      }),

      // Department performance metrics
      prisma.$queryRaw`
        SELECT 
          d.name,
          d.name_ar,
          COUNT(DISTINCT doc.id) as total_documents,
          COUNT(DISTINCT CASE WHEN doc.status = 'COMPLETED' THEN doc.id END) as completed_documents,
          AVG(CASE WHEN doc.status = 'COMPLETED' 
            THEN EXTRACT(EPOCH FROM (doc.updated_at - doc.created_at))/3600 
            END) as avg_completion_hours
        FROM departments d
        LEFT JOIN document_departments dd ON d.id = dd.department_id
        LEFT JOIN documents doc ON dd.document_id = doc.id AND doc.created_at >= ${startDate}
        WHERE d.is_active = true
        GROUP BY d.id, d.name, d.name_ar
        ORDER BY total_documents DESC
      `,

      // Category distribution
      prisma.$queryRaw`
        SELECT 
          c.name,
          c.name_ar,
          COUNT(d.id) as document_count
        FROM categories c
        LEFT JOIN documents d ON c.id = d.category_id AND d.created_at >= ${startDate}
        WHERE c.is_active = true
        GROUP BY c.id, c.name, c.name_ar
        ORDER BY document_count DESC
      `,
    ]);

    const analytics = {
      timeframe,
      dateRange: { start: startDate, end: now },
      trends: {
        documentsOverTime,
        statusDistribution,
        priorityDistribution,
      },
      performance: {
        departmentPerformance,
        categoryDistribution,
      },
    };

    const response: ApiResponse = {
      success: true,
      data: analytics,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get system performance metrics
 * GET /api/analytics/performance
 */
export const getPerformanceMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [
      avgProcessingTime,
      completionRate,
      responseTime,
      workloadDistribution,
    ] = await Promise.all([
      // Average processing time for completed documents
      prisma.$queryRaw<Array<{ avg_hours: number | null }>>`
        SELECT 
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_hours
        FROM documents 
        WHERE status = 'COMPLETED'
        AND updated_at > created_at
      `,

      // Completion rate by month
      prisma.$queryRaw<Array<{ month: Date; total_created: number; completed: number; completion_rate: number }>>`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as total_created,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
          ROUND(
            COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::numeric / 
            COUNT(*)::numeric * 100, 2
          ) as completion_rate
        FROM documents 
        WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month
      `,

      // Average response time (time to first seen)
      prisma.$queryRaw<Array<{ avg_response_hours: number | null }>>`
        SELECT 
          AVG(EXTRACT(EPOCH FROM (dse.seen_at - d.created_at))/3600) as avg_response_hours
        FROM documents d
        INNER JOIN document_seen_entries dse ON d.id = dse.document_id
        WHERE d.created_at >= CURRENT_DATE - INTERVAL '30 days'
      `,

      // Workload distribution by user
      prisma.$queryRaw<Array<{ name: string; email: string; department_name: string | null; documents_seen: number; outcomes_created: number }>>`
        SELECT 
          u.name,
          u.email,
          dept.name as department_name,
          COUNT(DISTINCT dse.document_id) as documents_seen,
          COUNT(DISTINCT o.id) as outcomes_created
        FROM users u
        LEFT JOIN departments dept ON u.department_id = dept.id
        LEFT JOIN document_seen_entries dse ON u.id = dse.user_id 
          AND dse.seen_at >= CURRENT_DATE - INTERVAL '30 days'
        LEFT JOIN outcomes o ON u.id = o.logged_by_id 
          AND o.logged_at >= CURRENT_DATE - INTERVAL '30 days'
        WHERE u.is_active = true
        GROUP BY u.id, u.name, u.email, dept.name
        ORDER BY documents_seen DESC
        LIMIT 20
      `,
    ]);

    const performance = {
      avgProcessingTime: avgProcessingTime[0]?.avg_hours || 0,
      avgResponseTime: responseTime[0]?.avg_response_hours || 0,
      completionRate,
      workloadDistribution,
      generatedAt: new Date(),
    };

    const response: ApiResponse = {
      success: true,
      data: performance,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};