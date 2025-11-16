import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { createError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';

/**
 * Get all departments
 * GET /api/departments
 */
export const getDepartments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { includeStats = false } = req.query;

    const departments = await prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        nameAr: true,
        contactPerson: true,
        email: true,
        phone: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        ...(includeStats === 'true' && {
          _count: {
            select: {
              users: true,
              documents: true,
              outcomes: true,
            },
          },
        }),
      },
      orderBy: { name: 'asc' },
    });

    const response: ApiResponse = {
      success: true,
      data: departments,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get department by ID
 * GET /api/departments/:id
 */
export const getDepartmentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        categories: {
          include: {
            category: {
              select: { id: true, name: true, nameAr: true },
            },
          },
        },
        _count: {
          select: {
            documents: true,
            outcomes: true,
            notifications: true,
          },
        },
      },
    });

    if (!department) {
      throw createError('Department not found', 404, 'DEPARTMENT_NOT_FOUND');
    }

    const response: ApiResponse = {
      success: true,
      data: department,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Create new department
 * POST /api/departments
 */
export const createDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      name,
      nameAr,
      contactPerson,
      email,
      phone,
      description,
    } = req.body;

    // Check if department with same name exists
    const existingDepartment = await prisma.department.findUnique({
      where: { name },
    });

    if (existingDepartment) {
      throw createError('Department with this name already exists', 409, 'DEPARTMENT_EXISTS');
    }

    const department = await prisma.department.create({
      data: {
        name,
        nameAr,
        contactPerson,
        email,
        phone,
        description,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'Department Created',
        actionAr: 'تم إنشاء قسم',
        details: `Department "${name}" created`,
        userId: req.user!.id,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        department,
        message: 'Department created successfully',
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Update department
 * PUT /api/departments/:id
 */
export const updateDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      nameAr,
      contactPerson,
      email,
      phone,
      description,
    } = req.body;

    // Check if department exists
    const existingDepartment = await prisma.department.findUnique({
      where: { id },
    });

    if (!existingDepartment) {
      throw createError('Department not found', 404, 'DEPARTMENT_NOT_FOUND');
    }

    // Check if new name conflicts with existing department
    if (name && name !== existingDepartment.name) {
      const nameConflict = await prisma.department.findUnique({
        where: { name },
      });

      if (nameConflict) {
        throw createError('Department with this name already exists', 409, 'DEPARTMENT_EXISTS');
      }
    }

    const updatedDepartment = await prisma.department.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(nameAr && { nameAr }),
        ...(contactPerson !== undefined && { contactPerson }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(description !== undefined && { description }),
        updatedAt: new Date(),
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'Department Updated',
        actionAr: 'تم تحديث القسم',
        details: `Department "${existingDepartment.name}" updated`,
        userId: req.user!.id,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: updatedDepartment,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get documents assigned to department
 * GET /api/departments/:id/documents
 */
export const getDepartmentDocuments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 20,
      status,
      priority,
    } = req.query as any;

    // Check if user has access to this department
    if (req.user?.role === 'DEPARTMENT_USER' || req.user?.role === 'DEPARTMENT_HEAD') {
      if (req.user.departmentId !== id) {
        throw createError('Access denied to this department', 403, 'ACCESS_DENIED');
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where: any = {
      assignedDepartments: {
        some: {
          departmentId: id,
        },
      },
    };

    if (status) {
      where.status = { in: Array.isArray(status) ? status : [status] };
    }

    if (priority) {
      where.priority = { in: Array.isArray(priority) ? priority : [priority] };
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          category: {
            select: { id: true, name: true, nameAr: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          seenEntries: {
            where: { departmentId: id },
            select: {
              userId: true,
              seenAt: true,
              user: {
                select: { name: true, email: true },
              },
            },
          },
          _count: {
            select: {
              outcomes: true,
              attachments: true,
            },
          },
        },
      }),
      prisma.document.count({ where }),
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    const response: ApiResponse = {
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
 * Get department statistics
 * GET /api/departments/:id/stats
 */
export const getDepartmentStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if user has access to this department
    if (req.user?.role === 'DEPARTMENT_USER' || req.user?.role === 'DEPARTMENT_HEAD') {
      if (req.user.departmentId !== id) {
        throw createError('Access denied to this department', 403, 'ACCESS_DENIED');
      }
    }

    const [
      totalDocuments,
      pendingDocuments,
      seenDocuments,
      completedDocuments,
      unseenDocuments,
      outcomes,
      activeUsers,
    ] = await Promise.all([
      // Total documents assigned to department
      prisma.document.count({
        where: {
          assignedDepartments: {
            some: { departmentId: id },
          },
        },
      }),

      // Pending documents
      prisma.document.count({
        where: {
          assignedDepartments: {
            some: { departmentId: id },
          },
          status: 'PENDING',
        },
      }),

      // Seen documents
      prisma.document.count({
        where: {
          assignedDepartments: {
            some: { departmentId: id },
          },
          seenEntries: {
            some: { departmentId: id },
          },
        },
      }),

      // Completed documents
      prisma.document.count({
        where: {
          assignedDepartments: {
            some: { departmentId: id },
          },
          status: 'COMPLETED',
        },
      }),

      // Unseen documents
      prisma.document.count({
        where: {
          assignedDepartments: {
            some: { departmentId: id },
          },
          seenEntries: {
            none: { departmentId: id },
          },
          status: {
            notIn: ['COMPLETED', 'ARCHIVED'],
          },
        },
      }),

      // Outcomes created by department
      prisma.outcome.count({
        where: { departmentId: id },
      }),

      // Active users in department
      prisma.user.count({
        where: {
          departmentId: id,
          isActive: true,
        },
      }),
    ]);

    const stats = {
      totalDocuments,
      pendingDocuments,
      seenDocuments,
      completedDocuments,
      unseenDocuments,
      outcomes,
      activeUsers,
      seenPercentage: totalDocuments > 0 ? Math.round((seenDocuments / totalDocuments) * 100) : 0,
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