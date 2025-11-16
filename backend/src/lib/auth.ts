import jwt from 'jsonwebtoken';
import { User } from '../generated/prisma';
import { TokenPayload } from '../types';

// Token blacklist (in production, use Redis or database)
const tokenBlacklist = new Set<string>();

/**
 * Generate JWT access token
 */
export const generateAccessToken = (user: Omit<User, 'password'>): string => {
  const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    issuer: 'cms-backend',
    audience: 'cms-frontend',
  });
};

/**
 * Generate JWT refresh token
 */
export const generateRefreshToken = (user: Omit<User, 'password'>): string => {
  const payload = {
    userId: user.id,
    email: user.email,
    type: 'refresh',
  };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: 'cms-backend',
    audience: 'cms-frontend',
  });
};

/**
 * Verify and decode JWT access token
 */
export const verifyAccessToken = (token: string): TokenPayload | null => {
  try {
    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
      issuer: 'cms-backend',
      audience: 'cms-frontend',
    }) as TokenPayload;

    return decoded;
  } catch (error) {
    console.error('Access token verification failed:', error);
    return null;
  }
};

/**
 * Verify and decode JWT refresh token
 */
export const verifyRefreshToken = (token: string): { userId: string; email: string; type: string } | null => {
  try {
    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!, {
      issuer: 'cms-backend',
      audience: 'cms-frontend',
    }) as { userId: string; email: string; type: string };

    // Ensure it's a refresh token
    if (decoded.type !== 'refresh') {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Refresh token verification failed:', error);
    return null;
  }
};

/**
 * Add token to blacklist (for logout)
 */
export const blacklistToken = (token: string): void => {
  tokenBlacklist.add(token);
  
  // Clean up expired tokens periodically (basic implementation)
  // In production, use a more sophisticated approach with Redis TTL
  if (tokenBlacklist.size > 10000) {
    // Clear all tokens if too many (simple cleanup)
    tokenBlacklist.clear();
  }
};

/**
 * Check if token is blacklisted
 */
export const isTokenBlacklisted = (token: string): boolean => {
  return tokenBlacklist.has(token);
};

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

/**
 * Get token expiration time
 */
export const getTokenExpirationTime = (token: string): number | null => {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    return decoded?.exp || null;
  } catch {
    return null;
  }
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  const exp = getTokenExpirationTime(token);
  if (!exp) return true;
  
  return Date.now() >= exp * 1000;
};

/**
 * Generate both access and refresh tokens
 */
export const generateTokenPair = (user: Omit<User, 'password'>) => {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
  };
};