import { Request, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { logActivity } from '../lib/db-utils';
import { hashPassword } from '../lib/password';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.nativeEnum(UserRole),
  departmentId: z.string().optional(),
  password: z.string().min(6)
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(2).optional(),
  role: z.nativeEnum(UserRole).optional(),
  departmentId: z.string().optional().nullable(),
  isActive: z.boolean().optional()
});

const changePasswordSchema = z.object({
  newPassword: z.string().min(6)
});

// Get all users with filtering and pagination
export const getUsers = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      status,
      departmentId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // Build where clause
    const where: any = {};
    
    if (role) where.role = role;
    if (status) where.isActive = status === 'ACTIVE';
    if (departmentId) where.departmentId = departmentId;
    
    if (search) {
      where.OR = [
        { fullName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Get users with related data
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          
          departmentId: true,
          createdAt: true,
          updatedAt: true,
          department: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          _count: {
            select: {
              documentsCreated: true,
              assignedDocuments: true
            }
          }
        },
        skip,
        take,
        orderBy: {
          [sortBy as string]: sortOrder as 'asc' | 'desc'
        }
      }),
      prisma.user.count({ where })
    ]);

    // Add user statistics
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const [recentDocuments, pendingTasks] = await Promise.all([
          prisma.document.count({
            where: {
              OR: [
                { createdById: user.id },
                { assignedToId: user.id }
              ],
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
              }
            }
          }),
          prisma.document.count({
            where: {
              assignedToId: user.id,
              status: {
                in: ['PENDING', 'IN_PROGRESS']
              }
            }
          })
        ]);

        return {
          ...user,
          stats: {
            totalCreated: user._count.documentsCreated,
            totalAssigned: user._count.assignedDocuments,
            recentDocuments,
            pendingTasks
          }
        };
      })
    );

    return res.json({
      users: usersWithStats,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get user by ID
export const getUserById = async (req: Request, res: Response) => {
  try{
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        _count: {
          select: {
            documentsCreated: true,
            assignedDocuments: true,
            activityLogs: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user activity statistics
    const [recentActivity, documentStats, loginHistory] = await Promise.all([
      prisma.activityLog.findMany({
        where: { userId: user.id },
        orderBy: { timestamp: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          details: true,
          timestamp: true
        }
      }),
      prisma.document.groupBy({
        by: ['status'],
        where: {
          OR: [
            { createdById: user.id },
            { assignedToId: user.id }
          ]
        },
        _count: {
          id: true
        }
      }),
      prisma.activityLog.findMany({
        where: {
          userId: user.id,
          action: 'LOGIN'
        },
        orderBy: { timestamp: 'desc' },
        take: 5,
        select: {
          timestamp: true,
          details: true
        }
      })
    ]);

    return res.json({
      ...user,
      stats: {
        totalCreated: user._count.documentsCreated,
        totalAssigned: user._count.assignedDocuments,
        totalActivities: user._count.activityLogs,
        documentsByStatus: documentStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count.id;
          return acc;
        }, {} as Record<string, number>)
      },
      recentActivity,
      loginHistory
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Create new user (admin only)
export const createUser = async (req: Request, res: Response) => {
  try {
    const validatedData = createUserSchema.parse(req.body);
    const currentUser = req.user!;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Validate department if provided
    if (validatedData.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: validatedData.departmentId }
      });
      if (!department) {
        return res.status(400).json({ message: 'Department not found' });
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name: validatedData.fullName.split(' ')[0], // Extract first name
        email: validatedData.email,
        fullName: validatedData.fullName,
        role: validatedData.role,
        departmentId: validatedData.departmentId || null,
        password: hashedPassword,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        departmentId: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    // Log activity
    await logActivity(
      currentUser.id,
      'CREATE_USER',
      `Created new user: ${newUser.fullName} (${newUser.email})`
    );

    // Create welcome notification for the new user
    // TODO: Fix notification schema - currently requires documentId which doesn't apply to system notifications
    // await prisma.notification.create({
    //   data: {
    //     recipientUserId: newUser.id,
    //     message: `Welcome ${newUser.fullName}! Your account has been created successfully. Your role is ${newUser.role}.`,
    //     messageAr: `مرحباً ${newUser.fullName}! تم إنشاء حسابك بنجاح. دورك هو ${newUser.role}.`,
    //     documentId: '', // Required but not applicable for system notifications
    //     departmentId: newUser.departmentId || ''
    //   }
    // });

    return res.status(201).json(newUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.issues 
      });
    }
    console.error('Error creating user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Update user (admin only)
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = updateUserSchema.parse(req.body);
    const currentUser = req.user!;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent self-role change for admins
    if (currentUser.id === id && validatedData.role && validatedData.role !== currentUser.role) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    // Check if email is already taken
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: validatedData.email }
      });
      if (emailExists) {
        return res.status(400).json({ message: 'Email is already taken' });
      }
    }

    // Validate department if provided
    if (validatedData.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: validatedData.departmentId }
      });
      if (!department) {
        return res.status(400).json({ message: 'Department not found' });
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...validatedData,
        updatedAt: new Date()
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    // Log activity
    await logActivity(
      currentUser.id,
      'UPDATE_USER',
      `Updated user: ${updatedUser.fullName} (${updatedUser.email})`
    );

    // Notify user of profile update
    // TODO: Fix notification schema - currently requires documentId which doesn't apply to system notifications
    // if (validatedData.isActive || validatedData.role) {
    //   await prisma.notification.create({
    //     data: {
    //       recipientUserId: updatedUser.id,
    //       message: `Your account has been updated by an administrator.${
    //         validatedData.isActive ? ` Status: ${validatedData.isActive}` : ''
    //       }${validatedData.role ? ` Role: ${validatedData.role}` : ''}`,
    //       messageAr: 'تم تحديث حسابك من قبل المسؤول',
    //       documentId: '',
    //       departmentId: updatedUser.departmentId || ''
    //     }
    //   });
    // }

    return res.json(updatedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.issues 
      });
    }
    console.error('Error updating user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete user (admin only) - soft delete by setting status to INACTIVE
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUser = req.user!;

    // Prevent self-deletion
    if (currentUser.id === id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true
      }
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!existingUser.isActive) {
      return res.status(400).json({ message: 'User is already inactive' });
    }

    // Soft delete by setting status to INACTIVE
    await prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    // Log activity
    await logActivity(
      currentUser.id,
      'DELETE_USER',
      `Deactivated user: ${existingUser.fullName} (${existingUser.email})`
    );

    return res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Change user password (admin only)
export const changeUserPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = changePasswordSchema.parse(req.body);
    const currentUser = req.user!;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true
      }
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await hashPassword(validatedData.newPassword);

    // Update password
    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        updatedAt: new Date()
      }
    });

    // Log activity
    await logActivity(
      currentUser.id,
      'CHANGE_USER_PASSWORD',
      `Changed password for user: ${existingUser.fullName} (${existingUser.email})`
    );

    // Notify user
    // TODO: Fix notification schema - currently requires documentId which doesn't apply to system notifications
    // await prisma.notification.create({
    //   data: {
    //     recipientUserId: existingUser.id,
    //     message: 'Your password has been changed by an administrator. Please use your new password to log in.',
    //     messageAr: 'تم تغيير كلمة المرور الخاصة بك من قبل المسؤول',
    //     documentId: '',
    //     departmentId: existingUser.departmentId || ''
    //   }
    // });

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.issues 
      });
    }
    console.error('Error changing user password:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get user statistics (admin only)
export const getUserStats = async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      activeUsers,
      usersByRole,
      usersByDepartment,
      recentRegistrations
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true }
      }),
      prisma.user.groupBy({
        by: ['departmentId'],
        _count: { id: true },
        where: { departmentId: { not: null } }
      }),
      prisma.user.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
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
        }
      })
    ]);

    // Get department names for statistics
    const departmentIds = usersByDepartment.map(stat => stat.departmentId).filter(Boolean);
    const departments = await prisma.department.findMany({
      where: { id: { in: departmentIds as string[] } },
      select: { id: true, name: true }
    });

    const departmentMap = departments.reduce((acc, dept) => {
      acc[dept.id] = dept.name;
      return acc;
    }, {} as Record<string, string>);

    res.json({
      overview: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers
      },
      byRole: usersByRole.reduce((acc, stat) => {
        acc[stat.role] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      byDepartment: usersByDepartment.reduce((acc, stat) => {
        if (stat.departmentId) {
          acc[departmentMap[stat.departmentId] || 'Unknown'] = stat._count.id;
        }
        return acc;
      }, {} as Record<string, number>),
      recentRegistrations
    });
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};