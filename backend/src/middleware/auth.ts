import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../generated/prisma';
import { verifyAccessToken, extractTokenFromHeader } from '../lib/auth';
import { createError } from './errorHandler';
import prisma from '../lib/prisma';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        departmentId?: string;
        name?: string;
      };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      throw createError('Access token is required', 401, 'UNAUTHORIZED');
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      throw createError('Invalid or expired token', 401, 'UNAUTHORIZED');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw createError('User not found or inactive', 401, 'UNAUTHORIZED');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId || undefined,
      name: user.name,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError('User not authenticated', 401, 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        createError(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
};

export const requireAdmin = authorize(UserRole.ADMIN);