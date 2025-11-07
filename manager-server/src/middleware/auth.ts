import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import prisma from '../config/database.js';
import { sendError } from '../utils/response.js';

/**
 * Authentication middleware
 * Validates session token and attaches user to request
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get session token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    
    const sessionToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Find session in database
    const session = await prisma.session.findUnique({
      where: { sessionId: sessionToken },
      include: { user: true },
    });
    
    if (!session) {
      sendError(res, 'Invalid session token', 401);
      return;
    }
    
    // Check if session has expired
    if (new Date() > session.expiresAt) {
      // Delete expired session
      await prisma.session.delete({ where: { id: session.id } });
      sendError(res, 'Session expired', 401);
      return;
    }
    
    // Check if user is active
    if (!session.user.isActive) {
      sendError(res, 'User account is inactive', 403);
      return;
    }
    
    // Attach user and session to request
    req.user = session.user;
    req.session = session;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    sendError(res, 'Authentication failed', 500);
  }
}

/**
 * Admin middleware
 * Requires user to be authenticated and have admin role
 */
export async function adminMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    sendError(res, 'Authentication required', 401);
    return;
  }
  
  if (req.user.role !== 'ADMIN') {
    sendError(res, 'Admin access required', 403);
    return;
  }
  
  next();
}

/**
 * Get current user from request
 */
export function getCurrentUser(req: AuthenticatedRequest) {
  return req.user;
}

/**
 * Get current session from request
 */
export function getCurrentSession(req: AuthenticatedRequest) {
  return req.session;
}

