import bcrypt from 'bcryptjs';

/**
 * Hash password with bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Validate password strength
 */
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Rate limiting for password attempts (simple in-memory implementation)
 */
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

/**
 * Check if user has exceeded login attempts
 */
export const checkRateLimit = (identifier: string): {
  allowed: boolean;
  remainingAttempts: number;
  resetTime?: Date;
} => {
  const maxAttempts = 5;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  
  const now = Date.now();
  const userAttempts = loginAttempts.get(identifier);
  
  if (!userAttempts) {
    return { allowed: true, remainingAttempts: maxAttempts - 1 };
  }
  
  // Reset if window has passed
  if (now - userAttempts.lastAttempt > windowMs) {
    loginAttempts.delete(identifier);
    return { allowed: true, remainingAttempts: maxAttempts - 1 };
  }
  
  if (userAttempts.count >= maxAttempts) {
    return {
      allowed: false,
      remainingAttempts: 0,
      resetTime: new Date(userAttempts.lastAttempt + windowMs),
    };
  }
  
  return {
    allowed: true,
    remainingAttempts: maxAttempts - userAttempts.count - 1,
  };
};

/**
 * Record a failed login attempt
 */
export const recordFailedAttempt = (identifier: string): void => {
  const now = Date.now();
  const userAttempts = loginAttempts.get(identifier);
  
  if (!userAttempts) {
    loginAttempts.set(identifier, { count: 1, lastAttempt: now });
  } else {
    userAttempts.count += 1;
    userAttempts.lastAttempt = now;
  }
};

/**
 * Clear failed attempts (on successful login)
 */
export const clearFailedAttempts = (identifier: string): void => {
  loginAttempts.delete(identifier);
};