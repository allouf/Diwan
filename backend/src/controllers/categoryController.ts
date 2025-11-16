import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { createError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';

/**
 * Get all categories
 * GET /api/categories
 */
export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { includeStats = false } = req.query;

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        nameAr: true,
        createdAt: true,
        updatedAt: true,
        ...(includeStats === 'true' && {
          _count: {
            select: {
              documents: true,
              suggestedDepartments: true,
            },
          },
          suggestedDepartments: {
            include: {
              department: {
                select: { id: true, name: true, nameAr: true },
              },
            },
          },
        }),
      },
      orderBy: { name: 'asc' },
    });

    const response: ApiResponse = {
      success: true,
      data: categories,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get category by ID
 * GET /api/categories/:id
 */
export const getCategoryById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        suggestedDepartments: {
          include: {
            department: {
              select: { id: true, name: true, nameAr: true },
            },
          },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
    });

    if (!category) {
      throw createError('Category not found', 404, 'CATEGORY_NOT_FOUND');
    }

    const response: ApiResponse = {
      success: true,
      data: category,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Create new category
 * POST /api/categories
 */
export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, nameAr, suggestedDepartmentIds = [] } = req.body;

    // Check if category with same name exists
    const existingCategory = await prisma.category.findUnique({
      where: { name },
    });

    if (existingCategory) {
      throw createError('Category with this name already exists', 409, 'CATEGORY_EXISTS');
    }

    // Verify suggested departments exist
    if (suggestedDepartmentIds.length > 0) {
      const departments = await prisma.department.findMany({
        where: { id: { in: suggestedDepartmentIds } },
      });

      if (departments.length !== suggestedDepartmentIds.length) {
        throw createError('One or more suggested departments not found', 404, 'DEPARTMENT_NOT_FOUND');
      }
    }

    // Create category with suggested departments
    const category = await prisma.$transaction(async (tx) => {
      const newCategory = await tx.category.create({
        data: { name, nameAr },
      });

      // Create suggested department relationships
      if (suggestedDepartmentIds.length > 0) {
        await tx.categoryDepartment.createMany({
          data: suggestedDepartmentIds.map((deptId: string) => ({
            categoryId: newCategory.id,
            departmentId: deptId,
          })),
        });
      }

      return newCategory;
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'Category Created',
        actionAr: 'تم إنشاء تصنيف',
        details: `Category "${name}" created with ${suggestedDepartmentIds.length} suggested departments`,
        userId: req.user!.id,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        category,
        message: 'Category created successfully',
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Update category
 * PUT /api/categories/:id
 */
export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, nameAr, suggestedDepartmentIds } = req.body;

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      throw createError('Category not found', 404, 'CATEGORY_NOT_FOUND');
    }

    // Check if new name conflicts with existing category
    if (name && name !== existingCategory.name) {
      const nameConflict = await prisma.category.findUnique({
        where: { name },
      });

      if (nameConflict) {
        throw createError('Category with this name already exists', 409, 'CATEGORY_EXISTS');
      }
    }

    // Update category and suggested departments
    const updatedCategory = await prisma.$transaction(async (tx) => {
      const category = await tx.category.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(nameAr && { nameAr }),
          updatedAt: new Date(),
        },
      });

      // Update suggested departments if provided
      if (suggestedDepartmentIds !== undefined) {
        // Verify departments exist
        if (suggestedDepartmentIds.length > 0) {
          const departments = await tx.department.findMany({
            where: { id: { in: suggestedDepartmentIds } },
          });

          if (departments.length !== suggestedDepartmentIds.length) {
            throw createError('One or more suggested departments not found', 404, 'DEPARTMENT_NOT_FOUND');
          }
        }

        // Remove existing relationships
        await tx.categoryDepartment.deleteMany({
          where: { categoryId: id },
        });

        // Create new relationships
        if (suggestedDepartmentIds.length > 0) {
          await tx.categoryDepartment.createMany({
            data: suggestedDepartmentIds.map((deptId: string) => ({
              categoryId: id,
              departmentId: deptId,
            })),
          });
        }
      }

      return category;
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'Category Updated',
        actionAr: 'تم تحديث التصنيف',
        details: `Category "${existingCategory.name}" updated`,
        userId: req.user!.id,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: updatedCategory,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete category (soft delete)
 * DELETE /api/categories/:id
 */
export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    });

    if (!category) {
      throw createError('Category not found', 404, 'CATEGORY_NOT_FOUND');
    }

    // Check if category has documents
    if (category._count.documents > 0) {
      throw createError(
        `Cannot delete category with ${category._count.documents} associated documents`,
        400,
        'CATEGORY_HAS_DOCUMENTS'
      );
    }

    // Soft delete by marking as inactive
    await prisma.category.update({
      where: { id },
      data: { isActive: false },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'Category Deleted',
        actionAr: 'تم حذف التصنيف',
        details: `Category "${category.name}" deleted`,
        userId: req.user!.id,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: { message: 'Category deleted successfully' },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get documents in category
 * GET /api/categories/:id/documents
 */
export const getCategoryDocuments = async (
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

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where: any = { categoryId: id };

    // Role-based filtering
    if (req.user?.role === 'DEPARTMENT_USER' || req.user?.role === 'DEPARTMENT_HEAD') {
      where.assignedDepartments = {
        some: {
          departmentId: req.user.departmentId,
        },
      };
    }

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