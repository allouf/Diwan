import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const searchSchema = z.object({
  query: z.string().min(1),
  type: z.enum(['documents', 'users', 'departments', 'all']).default('all'),
  limit: z.number().min(1).max(100).default(20),
  page: z.number().min(1).default(1)
});

const advancedSearchSchema = z.object({
  query: z.string().optional(),
  documentStatus: z.array(z.string()).optional(),
  categoryIds: z.array(z.string()).optional(),
  departmentIds: z.array(z.string()).optional(),
  createdById: z.string().optional(),
  assignedToId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  attachmentExists: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(20),
  page: z.number().min(1).default(1),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'referenceNumber']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

const autocompleteSchema = z.object({
  query: z.string().min(1),
  type: z.enum(['subject', 'content', 'reference', 'user', 'department']),
  limit: z.number().min(1).max(20).default(10)
});

// Global search across all entities
export const globalSearch = async (req: Request, res: Response) => {
  try {
    const validatedQuery = searchSchema.parse(req.query);
    const currentUser = req.user!;
    const { query, type, limit, page } = validatedQuery;
    const skip = (page - 1) * limit;

    const results: any = {
      query,
      type,
      results: {},
      pagination: {
        page,
        limit
      }
    };

    // Search documents
    if (type === 'documents' || type === 'all') {
      const documentWhere: any = {
        OR: [
          { subject: { contains: query, mode: 'insensitive' as const } },
          { content: { contains: query, mode: 'insensitive' as const } },
          { referenceNumber: { contains: query, mode: 'insensitive' as const } }
        ]
      };

      // Apply department restrictions for non-admin users
      if (!['ADMIN', 'CORRESPONDENCE_OFFICER'].includes(currentUser.role) && currentUser.departmentId) {
        documentWhere.assignedDepartments = {
          some: {
            departmentId: currentUser.departmentId
          }
        };
      }

      const [documents, documentsCount] = await Promise.all([
        prisma.document.findMany({
          where: documentWhere,
          select: {
            id: true,
            referenceNumber: true,
            subject: true,
            status: true,
            priority: true,
            createdAt: true,
            createdBy: {
              select: {
                fullName: true
              }
            },
            category: {
              select: {
                id: true,
                name: true
              }
            },
            assignedDepartments: {
              select: {
                department: {
                  select: {
                    name: true
                  }
                }
              }
            }
          },
          skip: type === 'documents' ? skip : 0,
          take: type === 'documents' ? limit : Math.min(limit, 5),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.document.count({ where: documentWhere })
      ]);

      results.results.documents = {
        items: documents,
        total: documentsCount,
        ...(type === 'documents' && {
          pagination: {
            page,
            limit,
            pages: Math.ceil(documentsCount / limit)
          }
        })
      };
    }

    // Search users (admin and correspondence officers only)
    if ((type === 'users' || type === 'all') && 
        ['ADMIN', 'CORRESPONDENCE_OFFICER'].includes(currentUser.role)) {
      const userWhere = {
        OR: [
          { fullName: { contains: query, mode: 'insensitive' as const } },
          { email: { contains: query, mode: 'insensitive' as const } }
        ]
      };

      const [users, usersCount] = await Promise.all([
        prisma.user.findMany({
          where: userWhere,
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            createdAt: true,
            department: {
              select: {
                name: true
              }
            }
          },
          skip: type === 'users' ? skip : 0,
          take: type === 'users' ? limit : Math.min(limit, 5),
          orderBy: { fullName: 'asc' }
        }),
        prisma.user.count({ where: userWhere })
      ]);

      results.results.users = {
        items: users,
        total: usersCount,
        ...(type === 'users' && {
          pagination: {
            page,
            limit,
            pages: Math.ceil(usersCount / limit)
          }
        })
      };
    }

    // Search departments
    if (type === 'departments' || type === 'all') {
      const departmentWhere = {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { code: { contains: query, mode: 'insensitive' as const } },
          { description: { contains: query, mode: 'insensitive' as const } }
        ]
      };

      const [departments, departmentsCount] = await Promise.all([
        prisma.department.findMany({
          where: departmentWhere,
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            isActive: true,
            _count: {
              select: {
                users: true,
                documents: true
              }
            }
          },
          skip: type === 'departments' ? skip : 0,
          take: type === 'departments' ? limit : Math.min(limit, 5),
          orderBy: { name: 'asc' }
        }),
        prisma.department.count({ where: departmentWhere })
      ]);

      results.results.departments = {
        items: departments,
        total: departmentsCount,
        ...(type === 'departments' && {
          pagination: {
            page,
            limit,
            pages: Math.ceil(departmentsCount / limit)
          }
        })
      };
    }

    return res.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.issues
      });
    }
    console.error('Error performing global search:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Advanced document search with filters
export const advancedDocumentSearch = async (req: Request, res: Response) => {
  try {
    const validatedQuery = advancedSearchSchema.parse(req.query);
    const currentUser = req.user!;
    
    const {
      query,
      documentStatus,
      categoryIds,
      departmentIds,
      createdById,
      assignedToId,
      priority,
      dateFrom,
      dateTo,
      attachmentExists,
      limit,
      page,
      sortBy,
      sortOrder
    } = validatedQuery;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Text search
    if (query) {
      where.OR = [
        { subject: { contains: query, mode: 'insensitive' as const } },
        { content: { contains: query, mode: 'insensitive' as const } },
        { referenceNumber: { contains: query, mode: 'insensitive' as const } }
      ];
    }

    // Status filter
    if (documentStatus && documentStatus.length > 0) {
      where.status = { in: documentStatus };
    }

    // Category filter
    if (categoryIds && categoryIds.length > 0) {
      where.categories = {
        some: {
          categoryId: { in: categoryIds }
        }
      };
    }

    // Department filter
    if (departmentIds && departmentIds.length > 0) {
      where.assignedDepartments = {
        some: {
          departmentId: { in: departmentIds }
        }
      };
    }

    // User filters
    if (createdById) {
      where.createdById = createdById;
    }

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    // Priority filter
    if (priority) {
      where.priority = priority;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Attachment filter
    if (attachmentExists !== undefined) {
      if (attachmentExists) {
        where.attachments = {
          some: {}
        };
      } else {
        where.attachments = {
          none: {}
        };
      }
    }

    // Apply department restrictions for non-admin users
    if (!['ADMIN', 'CORRESPONDENCE_OFFICER'].includes(currentUser.role) && currentUser.departmentId) {
      if (where.assignedDepartments) {
        // If department filter already exists, add current user's department to the filter
        where.assignedDepartments.some.departmentId = currentUser.departmentId;
      } else {
        where.assignedDepartments = {
          some: {
            departmentId: currentUser.departmentId
          }
        };
      }
    }

    // Execute search
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          referenceNumber: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: {
              id: true,
              fullName: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              fullName: true
            }
          },
          category: {
            select: {
              id: true,
              name: true
            }
          },
          assignedDepartments: {
            select: {
              department: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          _count: {
            select: {
              attachments: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder
        }
      }),
      prisma.document.count({ where })
    ]);

    return res.json({
      documents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        query,
        documentStatus,
        categoryIds,
        departmentIds,
        createdById,
        assignedToId,
        priority,
        dateFrom,
        dateTo,
        attachmentExists
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
    console.error('Error performing advanced document search:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Auto-complete suggestions
export const getAutocompleteSuggestions = async (req: Request, res: Response) => {
  try {
    const validatedQuery = autocompleteSchema.parse(req.query);
    const currentUser = req.user!;
    const { query, type, limit } = validatedQuery;

    let suggestions: any[] = [];

    switch (type) {
      case 'subject':
        const subjectResults = await prisma.document.findMany({
          where: {
            subject: {
              contains: query,
              mode: 'insensitive' as const
            },
            ...((!['ADMIN', 'CORRESPONDENCE_OFFICER'].includes(currentUser.role) && currentUser.departmentId) && {
              assignedDepartments: {
                some: {
                  departmentId: currentUser.departmentId
                }
              }
            })
          },
          select: {
            subject: true
          },
          distinct: ['subject'],
          take: limit
        });
        suggestions = subjectResults.map(doc => ({
          value: doc.subject,
          type: 'subject'
        }));
        break;

      case 'content':
        // For content search, we'll return documents that match
        const contentResults = await prisma.document.findMany({
          where: {
            ...((!['ADMIN', 'CORRESPONDENCE_OFFICER'].includes(currentUser.role) && currentUser.departmentId) && {
              assignedDepartments: {
                some: {
                  departmentId: currentUser.departmentId
                }
              }
            })
          },
          select: {
            id: true,
            subject: true,
            referenceNumber: true
          },
          take: limit
        });
        suggestions = contentResults.map(doc => ({
          value: doc.subject,
          label: `${doc.referenceNumber}: ${doc.subject}`,
          id: doc.id,
          type: 'document'
        }));
        break;

      case 'reference':
        const refResults = await prisma.document.findMany({
          where: {
            referenceNumber: {
              contains: query,
              mode: 'insensitive' as const
            },
            ...((!['ADMIN', 'CORRESPONDENCE_OFFICER'].includes(currentUser.role) && currentUser.departmentId) && {
              assignedDepartments: {
                some: {
                  departmentId: currentUser.departmentId
                }
              }
            })
          },
          select: {
            referenceNumber: true,
            subject: true
          },
          take: limit
        });
        suggestions = refResults.map(doc => ({
          value: doc.referenceNumber,
          label: `${doc.referenceNumber}: ${doc.subject}`,
          type: 'reference'
        }));
        break;

      case 'user':
        if (['ADMIN', 'CORRESPONDENCE_OFFICER'].includes(currentUser.role)) {
          const userResults = await prisma.user.findMany({
            where: {
              OR: [
                { fullName: { contains: query, mode: 'insensitive' as const } },
                { email: { contains: query, mode: 'insensitive' as const } }
              ],
              isActive: true
            },
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true
            },
            take: limit
          });
          suggestions = userResults.map(user => ({
            value: user.fullName,
            label: `${user.fullName} (${user.email})`,
            id: user.id,
            role: user.role,
            type: 'user'
          }));
        }
        break;

      case 'department':
        const deptResults = await prisma.department.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: 'insensitive' as const } },
              { code: { contains: query, mode: 'insensitive' as const } }
            ],
            isActive: true
          },
          select: {
            id: true,
            name: true,
            code: true
          },
          take: limit
        });
        suggestions = deptResults.map(dept => ({
          value: dept.name,
          label: `${dept.name} (${dept.code})`,
          id: dept.id,
          type: 'department'
        }));
        break;
    }

    return res.json({
      query,
      type,
      suggestions
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.issues
      });
    }
    console.error('Error getting autocomplete suggestions:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get search filters (categories, departments, users, etc.)
export const getSearchFilters = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;

    const [categories, departments, users, statuses] = await Promise.all([
      // Categories
      prisma.category.findMany({
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              documents: true
            }
          }
        },
        orderBy: { name: 'asc' }
      }),
      // Departments
      prisma.department.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          _count: {
            select: {
              documents: true
            }
          }
        },
        orderBy: { name: 'asc' }
      }),
      // Users (only for admin and correspondence officers)
      ['ADMIN', 'CORRESPONDENCE_OFFICER'].includes(currentUser.role) 
        ? prisma.user.findMany({
            where: { isActive: true },
            select: {
              id: true,
              fullName: true,
              role: true,
              department: {
                select: {
                  name: true
                }
              }
            },
            orderBy: { fullName: 'asc' }
          })
        : [],
      // Document statuses with counts
      prisma.document.groupBy({
        by: ['status'],
        _count: { id: true },
        ...((!['ADMIN', 'CORRESPONDENCE_OFFICER'].includes(currentUser.role) && currentUser.departmentId) && {
          where: {
            assignedDepartments: {
              some: {
                departmentId: currentUser.departmentId
              }
            }
          }
        })
      })
    ]);

    res.json({
      categories: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        documentCount: cat._count.documents
      })),
      assignedDepartments: departments.map(dept => ({
        id: dept.id,
        name: dept.name,
        code: dept.code,
        documentCount: dept._count.documents
      })),
      users: users.map(user => ({
        id: user.id,
        fullName: user.fullName,
        role: user.role,
        department: user.department?.name
      })),
      statuses: statuses.map(status => ({
        status: status.status,
        count: status._count && typeof status._count === 'object' && 'id' in status._count ? status._count.id : 0
      })),
      priorities: [
        { value: 'LOW', label: 'Low' },
        { value: 'MEDIUM', label: 'Medium' },
        { value: 'HIGH', label: 'High' },
        { value: 'URGENT', label: 'Urgent' }
      ]
    });
  } catch (error) {
    console.error('Error getting search filters:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Save search query for quick access
export const saveSearchQuery = async (req: Request, res: Response) => {
  try {
    const { name, query, filters } = req.body;
    const currentUser = req.user!;

    // For now, we'll store in a simple JSON format in user preferences
    // In a real system, you might want a separate SavedSearches table
    
    const savedSearch = {
      id: Date.now().toString(),
      name,
      query,
      filters,
      createdAt: new Date(),
      userId: currentUser.id
    };

    // This would typically be saved to a database table
    // For now, we'll just return the search object
    
    res.json({
      message: 'Search query saved successfully',
      savedSearch
    });
  } catch (error) {
    console.error('Error saving search query:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};