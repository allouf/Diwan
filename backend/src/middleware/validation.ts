import { Request, Response, NextFunction } from 'express';
import { validatePasswordStrength } from '../lib/password';
import { createError } from './errorHandler';

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateLogin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { email, password } = req.body;
  const errors: string[] = [];

  if (!email) {
    errors.push('Email is required');
  } else if (!isValidEmail(email)) {
    errors.push('Invalid email format');
  }

  if (!password) {
    errors.push('Password is required');
  }

  if (email) {
    req.body.email = email.toLowerCase().trim();
  }

  if (errors.length > 0) {
    return next(
      createError(
        `Validation failed: ${errors.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      )
    );
  }

  next();
};

export const validateChangePassword = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { currentPassword, newPassword } = req.body;
  const errors: string[] = [];

  if (!currentPassword) {
    errors.push('Current password is required');
  }

  if (!newPassword) {
    errors.push('New password is required');
  } else {
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }
  }

  if (errors.length > 0) {
    return next(
      createError(
        `Validation failed: ${errors.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      )
    );
  }

  next();
};

export const validateRefreshToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return next(
      createError(
        'Refresh token is required',
        400,
        'VALIDATION_ERROR'
      )
    );
  }

  next();
};