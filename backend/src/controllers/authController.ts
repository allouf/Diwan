import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { generateTokenPair, verifyRefreshToken, blacklistToken, extractTokenFromHeader } from '../lib/auth';
import { hashPassword, comparePassword, checkRateLimit, recordFailedAttempt, clearFailedAttempts } from '../lib/password';
import { createError } from '../middleware/errorHandler';
import { LoginRequest, LoginResponse, ApiResponse } from '../types';

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body as LoginRequest;
    
    const rateLimit = checkRateLimit(email);
    if (!rateLimit.allowed) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Too many login attempts. Please try again later.`,
        },
      };
      return res.status(429).json(response);
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            nameAr: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      recordFailedAttempt(email);
      throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      recordFailedAttempt(email);
      throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    clearFailedAttempts(email);

    const { password: _, ...userWithoutPassword } = user;
    const tokens = generateTokenPair(userWithoutPassword);

    await prisma.activityLog.create({
      data: {
        action: 'User Login',
        actionAr: 'تسجيل دخول المستخدم',
        details: `User ${user.name} logged in successfully`,
        userId: user.id,
      },
    });

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        user: userWithoutPassword,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (token) {
      blacklistToken(token);
    }

    if (req.user) {
      await prisma.activityLog.create({
        data: {
          action: 'User Logout',
          actionAr: 'تسجيل خروج المستخدم',
          details: `User ${req.user.name} logged out`,
          userId: req.user.id,
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      data: { message: 'Logged out successfully' },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      throw createError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            nameAr: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw createError('User not found or inactive', 401, 'UNAUTHORIZED');
    }

    const { password: _, ...userWithoutPassword } = user;
    const tokens = generateTokenPair(userWithoutPassword);

    blacklistToken(refreshToken);

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        user: userWithoutPassword,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            contactPerson: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }

    const response: ApiResponse = {
      success: true,
      data: user,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        name: true,
      },
    });

    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }

    const isValidPassword = await comparePassword(currentPassword, user.password);
    if (!isValidPassword) {
      throw createError('Current password is incorrect', 401, 'INVALID_PASSWORD');
    }

    const hashedNewPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
        updatedAt: new Date(),
      },
    });

    await prisma.activityLog.create({
      data: {
        action: 'Password Changed',
        actionAr: 'تم تغيير كلمة المرور',
        details: `User ${user.name} changed their password`,
        userId: userId,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: { message: 'Password changed successfully' },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};