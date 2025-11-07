import { Router, Response } from 'express';
import { AuthenticatedRequest, CreateTokenRequest, UpdateTokenRequest } from '../types/index.js';
import { sendSuccess, sendError, sendPaginatedResponse, getPaginationParams } from '../utils/response.js';
import { authMiddleware, getCurrentUser } from '../middleware/auth.js';
import { TokenService } from '../services/tokenService.js';

const router = Router();
const tokenService = new TokenService();

/**
 * GET /api/tokens
 * List all tokens with pagination
 */
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return sendError(res, 'Authentication required', 401);
    }
    
    const { page, limit } = getPaginationParams(req.query);
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    
    // If search parameters are provided, use search
    if (search || category) {
      const tokens = await tokenService.searchTokens({
        search,
        category,
        createdBy: user.role === 'ADMIN' ? undefined : user.id,
      });
      
      // Manual pagination for search results
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTokens = tokens.slice(startIndex, endIndex);
      
      return sendPaginatedResponse(res, paginatedTokens, page, limit, tokens.length);
    }
    
    // Regular listing with pagination
    const result = await tokenService.listTokens(
      page,
      limit,
      user.role === 'ADMIN' ? undefined : user.id
    );
    
    return sendPaginatedResponse(res, result.tokens, result.page, result.limit, result.total);
    
  } catch (error) {
    console.error('Get tokens error:', error);
    return sendError(res, 'Failed to retrieve tokens', 500);
  }
});

/**
 * GET /api/tokens/stats
 * Get token statistics
 */
router.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return sendError(res, 'Authentication required', 401);
    }
    
    const stats = await tokenService.getTokenStats(
      user.role === 'ADMIN' ? undefined : user.id
    );
    
    return sendSuccess(res, stats);
    
  } catch (error) {
    console.error('Get stats error:', error);
    return sendError(res, 'Failed to retrieve statistics', 500);
  }
});

/**
 * GET /api/tokens/:id
 * Get a specific token by ID
 */
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return sendError(res, 'Authentication required', 401);
    }
    
    const token = await tokenService.getTokenById(req.params.id);
    
    if (!token) {
      return sendError(res, 'Token not found', 404);
    }
    
    // Check ownership (non-admin users can only access their own tokens)
    if (user.role !== 'ADMIN' && token.created_by !== user.id) {
      return sendError(res, 'Access denied', 403);
    }
    
    return sendSuccess(res, token);
    
  } catch (error) {
    console.error('Get token error:', error);
    return sendError(res, 'Failed to retrieve token', 500);
  }
});

/**
 * POST /api/tokens
 * Create a new token
 */
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return sendError(res, 'Authentication required', 401);
    }
    
    const body: CreateTokenRequest = req.body;
    
    if (!body.access_token) {
      return sendError(res, 'Access token is required', 400);
    }
    
    const token = await tokenService.createToken(body, user.id);
    
    return sendSuccess(res, token, 'Token created successfully', 201);
    
  } catch (error) {
    console.error('Create token error:', error);
    return sendError(res, 'Failed to create token', 500);
  }
});

/**
 * POST /api/tokens/batch-import
 * Batch import tokens
 */
router.post('/batch-import', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return sendError(res, 'Authentication required', 401);
    }
    
    const { tokens } = req.body;
    
    if (!tokens || !Array.isArray(tokens)) {
      return sendError(res, 'Tokens array is required', 400);
    }
    
    if (tokens.length === 0) {
      return sendError(res, 'At least one token is required', 400);
    }
    
    if (tokens.length > 100) {
      return sendError(res, 'Maximum 100 tokens allowed per batch', 400);
    }
    
    const createdTokens = await tokenService.batchImportTokens(tokens, user.id);
    
    return sendSuccess(res, {
      imported: createdTokens.length,
      tokens: createdTokens,
    }, 'Tokens imported successfully');
    
  } catch (error) {
    console.error('Batch import error:', error);
    return sendError(res, 'Failed to import tokens', 500);
  }
});

/**
 * PUT /api/tokens/:id
 * Update a token
 */
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return sendError(res, 'Authentication required', 401);
    }
    
    const existingToken = await tokenService.getTokenById(req.params.id);
    
    if (!existingToken) {
      return sendError(res, 'Token not found', 404);
    }
    
    // Check ownership
    if (user.role !== 'ADMIN' && existingToken.created_by !== user.id) {
      return sendError(res, 'Access denied', 403);
    }
    
    const body: UpdateTokenRequest = req.body;
    const updatedToken = await tokenService.updateToken(req.params.id, body);
    
    if (!updatedToken) {
      return sendError(res, 'Failed to update token', 500);
    }
    
    return sendSuccess(res, updatedToken, 'Token updated successfully');
    
  } catch (error) {
    console.error('Update token error:', error);
    return sendError(res, 'Failed to update token', 500);
  }
});

/**
 * DELETE /api/tokens/:id
 * Delete a token
 */
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      return sendError(res, 'Authentication required', 401);
    }
    
    const existingToken = await tokenService.getTokenById(req.params.id);
    
    if (!existingToken) {
      return sendError(res, 'Token not found', 404);
    }
    
    // Check ownership
    if (user.role !== 'ADMIN' && existingToken.created_by !== user.id) {
      return sendError(res, 'Access denied', 403);
    }
    
    const deleted = await tokenService.deleteToken(req.params.id);
    
    if (!deleted) {
      return sendError(res, 'Failed to delete token', 500);
    }
    
    return sendSuccess(res, null, 'Token deleted successfully');
    
  } catch (error) {
    console.error('Delete token error:', error);
    return sendError(res, 'Failed to delete token', 500);
  }
});

export default router;

