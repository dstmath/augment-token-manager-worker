import { Router, Response } from 'express';
import { AuthenticatedRequest, LoginRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { parseUserCredentials, generateSessionId, getSessionExpiryDate } from '../utils/auth.js';
import { config } from '../config/env.js';
import prisma from '../config/database.js';
import { authMiddleware, getCurrentUser, getCurrentSession } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';

const router = Router();

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', authRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body: LoginRequest = req.body;
    
    if (!body.username || !body.password) {
      return sendError(res, 'Username and password are required', 400);
    }
    
    // Verify credentials from environment variable
    const credentials = parseUserCredentials(config.userCredentials);
    const storedPassword = credentials.get(body.username);
    
    if (!storedPassword || storedPassword !== body.password) {
      return sendError(res, 'Invalid credentials', 401);
    }
    
    // Find or create user
    let user = await prisma.user.findUnique({
      where: { username: body.username },
    });
    
    if (!user) {
      // Create user if doesn't exist
      user = await prisma.user.create({
        data: {
          username: body.username,
          password: storedPassword, // In production, this should be hashed
          role: body.username === 'admin' ? 'ADMIN' : 'USER',
        },
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return sendError(res, 'User account is inactive', 403);
    }
    
    // Create session
    const sessionId = generateSessionId();
    const expiresAt = getSessionExpiryDate(config.sessionExpiryHours);
    
    const session = await prisma.session.create({
      data: {
        sessionId,
        userId: user.id,
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
    
    return sendSuccess(res, {
      token: sessionId,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      expiresAt: expiresAt.toISOString(),
    }, 'Login successful');
    
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, 'Login failed', 500);
  }
});

/**
 * POST /api/auth/logout
 * User logout
 */
router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = getCurrentSession(req);
    
    if (session) {
      await prisma.session.delete({
        where: { id: session.id },
      });
    }
    
    return sendSuccess(res, null, 'Logout successful');
    
  } catch (error) {
    console.error('Logout error:', error);
    return sendError(res, 'Logout failed', 500);
  }
});

/**
 * GET /api/auth/validate
 * Validate current session
 */
router.get('/validate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getCurrentUser(req);
    const session = getCurrentSession(req);
    
    if (!user || !session) {
      return sendError(res, 'Invalid session', 401);
    }
    
    return sendSuccess(res, {
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      session: {
        sessionId: session.sessionId,
      },
    });
    
  } catch (error) {
    console.error('Validate error:', error);
    return sendError(res, 'Validation failed', 500);
  }
});

export default router;

