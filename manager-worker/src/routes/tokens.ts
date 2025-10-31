import { Env, AuthenticatedRequest, CreateTokenRequest, UpdateTokenRequest } from '../types/index.js';
import { TokenService } from '../services/tokenService.js';
import {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createPaginatedResponse,
  parseJsonBody,
  getPaginationParams,
  getQueryParams
} from '../utils/response.js';
import { validateData, ValidationRules } from '../utils/validation.js';
import { getCurrentUser } from '../middleware/auth.js';

/**
 * Get all tokens with pagination
 */
export async function getTokensHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const url = new URL(request.url);
    const { page, limit } = getPaginationParams(url);
    const queryParams = getQueryParams(url);
    
    const tokenService = new TokenService(env);
    
    // If search parameters are provided, use search
    if (queryParams.search || queryParams.category) {
      const tokens = await tokenService.searchTokens({
        search: queryParams.search,
        category: queryParams.category,
        createdBy: user.role === 'admin' ? undefined : user.id,
      });
      
      // Manual pagination for search results
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTokens = tokens.slice(startIndex, endIndex);
      
      return createPaginatedResponse(
        paginatedTokens,
        page,
        limit,
        tokens.length
        // 移除message，前端未使用
      );
    }
    
    // Regular listing with pagination
    const result = await tokenService.listTokens(page, limit);
    
    return createPaginatedResponse(
      result.tokens,
      result.page,
      result.limit,
      result.total
      // 移除message，前端未使用
    );
    
  } catch (error) {
    console.error('Get tokens error:', error);
    return createErrorResponse('Failed to retrieve tokens', 500);
  }
}

/**
 * Get token by ID
 */
export async function getTokenByIdHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tokenId = pathParts[pathParts.indexOf('tokens') + 1];

    if (!tokenId || tokenId === 'tokens') {
      return createErrorResponse('Token ID is required', 400);
    }
    
    const tokenService = new TokenService(env);
    const token = await tokenService.getTokenById(tokenId);
    
    if (!token) {
      return createNotFoundResponse('Token not found');
    }
    
    // Allow access if:
    // 1. User is admin, OR
    // 2. Token was created by the current user, OR
    // 3. Token was created via public API (created_by === 'public-import')
    if (user.role !== 'admin' &&
        token.created_by !== user.id &&
        token.created_by !== 'public-import') {
      return createErrorResponse('Access denied', 403);
    }
    
    return createSuccessResponse(token); // 移除message，前端未使用
    
  } catch (error) {
    console.error('Get token by ID error:', error);
    return createErrorResponse('Failed to retrieve token', 500);
  }
}

/**
 * Create new token
 */
export async function createTokenHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const body = await parseJsonBody<CreateTokenRequest>(request);
    
    // Validate input
    const validation = validateData(body, [
      { field: 'access_token', required: true, type: 'string', minLength: 1 },
      { field: 'tenant_url', required: false, type: 'string' },
      { field: 'portal_url', required: false, type: 'string' },
      { field: 'email_note', required: false, type: 'string' },
    ]);
    
    if (!validation.isValid) {
      return createErrorResponse(
        `Validation failed: ${validation.errors.join(', ')}`,
        400
      );
    }
    
    const tokenService = new TokenService(env);
    const token = await tokenService.createToken(body, user.id);
    
    return createSuccessResponse(token, 'Token created successfully', 201); // 保留message，前端使用
    
  } catch (error) {
    console.error('Create token error:', error);
    return createErrorResponse('Failed to create token', 500);
  }
}

/**
 * Update token
 */
export async function updateTokenHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tokenId = pathParts[pathParts.indexOf('tokens') + 1];



    if (!tokenId || tokenId === 'tokens') {
      return createErrorResponse('Token ID is required', 400);
    }
    
    const body = await parseJsonBody<UpdateTokenRequest>(request);
    
    const tokenService = new TokenService(env);
    
    // Check if token exists and user has access
    const existingToken = await tokenService.getTokenById(tokenId);
    if (!existingToken) {
      return createNotFoundResponse('Token not found');
    }
    
    // Allow update if:
    // 1. User is admin, OR
    // 2. Token was created by the current user, OR
    // 3. Token was created via public API (created_by === 'public-import')
    if (user.role !== 'admin' &&
        existingToken.created_by !== user.id &&
        existingToken.created_by !== 'public-import') {
      return createErrorResponse('Access denied', 403);
    }
    
    const updatedToken = await tokenService.updateToken(tokenId, body);
    
    if (!updatedToken) {
      return createNotFoundResponse('Token not found');
    }
    
    return createSuccessResponse(updatedToken, 'Token updated successfully'); // 保留message，前端使用
    
  } catch (error) {
    console.error('Update token error:', error);
    return createErrorResponse('Failed to update token', 500);
  }
}

/**
 * Delete token
 */
export async function deleteTokenHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tokenId = pathParts[pathParts.indexOf('tokens') + 1];

    if (!tokenId || tokenId === 'tokens') {
      return createErrorResponse('Token ID is required', 400);
    }
    
    const tokenService = new TokenService(env);
    
    // Check if token exists and user has access
    const existingToken = await tokenService.getTokenById(tokenId);
    if (!existingToken) {
      return createNotFoundResponse('Token not found');
    }

    // Allow deletion if:
    // 1. User is admin, OR
    // 2. Token was created by the current user, OR
    // 3. Token was created via public API (created_by === 'public-import')
    if (user.role !== 'admin' &&
        existingToken.created_by !== user.id &&
        existingToken.created_by !== 'public-import') {
      return createErrorResponse('Access denied', 403);
    }
    
    const deleted = await tokenService.deleteToken(tokenId);
    
    if (!deleted) {
      return createNotFoundResponse('Token not found');
    }
    
    return createSuccessResponse(null, 'Token deleted successfully'); // 保留message，前端使用
    
  } catch (error) {
    console.error('Delete token error:', error);
    return createErrorResponse('Failed to delete token', 500);
  }
}

/**
 * Batch import tokens
 */
export async function batchImportTokensHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const body = await parseJsonBody<{ tokens: CreateTokenRequest[] }>(request);
    
    if (!body.tokens || !Array.isArray(body.tokens)) {
      return createErrorResponse('Tokens array is required', 400);
    }
    
    if (body.tokens.length === 0) {
      return createErrorResponse('At least one token is required', 400);
    }
    
    if (body.tokens.length > 100) {
      return createErrorResponse('Maximum 100 tokens allowed per batch', 400);
    }
    
    const tokenService = new TokenService(env);
    const result = await tokenService.batchImportTokens(body.tokens, user.id);
    
    return createSuccessResponse({
      imported: result.success.length,
      failed: result.failed.length,
      success: result.success,
      errors: result.failed,
    }, `Batch import completed. ${result.success.length} tokens imported, ${result.failed.length} failed.`);
    
  } catch (error) {
    console.error('Batch import error:', error);
    return createErrorResponse('Failed to import tokens', 500);
  }
}

/**
 * Validate token status
 */
export async function validateTokenStatusHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tokenId = pathParts[pathParts.indexOf('tokens') + 1];
    
    if (!tokenId) {
      return createErrorResponse('Token ID is required', 400);
    }
    
    const tokenService = new TokenService(env);
    
    // Check if token exists and user has access
    const existingToken = await tokenService.getTokenById(tokenId);
    if (!existingToken) {
      return createNotFoundResponse('Token not found');
    }
    
    // Allow validation if:
    // 1. User is admin, OR
    // 2. Token was created by the current user, OR
    // 3. Token was created via public API (created_by === 'public-import')
    if (user.role !== 'admin' &&
        existingToken.created_by !== user.id &&
        existingToken.created_by !== 'public-import') {
      return createErrorResponse('Access denied', 403);
    }

    const result = await tokenService.validateTokenStatus(tokenId);

    const message = result.isValid ? 'Token状态正常' : 'Token已失效，状态已更新';

    return new Response(JSON.stringify({
      success: true,
      data: result.token,
      valid: result.isValid,
      message: message
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Validate token status error:', error);
    return createErrorResponse('Failed to validate token status', 500);
  }
}

/**
 * Batch validate tokens
 */
export async function batchValidateTokensHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }

    const body = await parseJsonBody<{ tokenIds: string[] }>(request);

    if (!body.tokenIds || !Array.isArray(body.tokenIds)) {
      return createErrorResponse('tokenIds array is required', 400);
    }

    if (body.tokenIds.length === 0) {
      return createErrorResponse('At least one token ID is required', 400);
    }

    if (body.tokenIds.length > 50) {
      return createErrorResponse('Maximum 50 tokens can be validated at once', 400);
    }

    const tokenService = new TokenService(env);

    // 验证用户权限 - 只能验证自己的token（除非是admin）
    if (user.role !== 'admin') {
      const tokenChecks = await Promise.all(
        body.tokenIds.map(id => tokenService.getTokenById(id))
      );

      // Allow access to tokens created by user or via public API
      const unauthorizedTokens = tokenChecks.filter(
        token => token &&
                 token.created_by !== user.id &&
                 token.created_by !== 'public-import'
      );

      if (unauthorizedTokens.length > 0) {
        return createErrorResponse('Access denied to some tokens', 403);
      }
    }

    const results = await tokenService.validateTokensBatch(body.tokenIds);

    return createSuccessResponse({
      results,
      summary: {
        total: results.length,
        valid: results.filter(r => r.isValid).length,
        invalid: results.filter(r => !r.isValid).length,
        errors: results.filter(r => r.error).length
      }
    }, 'Batch validation completed');

  } catch (error) {
    console.error('Batch validate tokens error:', error);
    return createErrorResponse('Failed to validate tokens', 500);
  }
}

/**
 * Refresh token information
 */
export async function refreshTokenHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tokenId = pathParts[pathParts.indexOf('tokens') + 1];
    
    if (!tokenId) {
      return createErrorResponse('Token ID is required', 400);
    }
    
    const tokenService = new TokenService(env);
    
    // Check if token exists and user has access
    const existingToken = await tokenService.getTokenById(tokenId);
    if (!existingToken) {
      return createNotFoundResponse('Token not found');
    }
    
    // Allow refresh if:
    // 1. User is admin, OR
    // 2. Token was created by the current user, OR
    // 3. Token was created via public API (created_by === 'public-import')
    if (user.role !== 'admin' &&
        existingToken.created_by !== user.id &&
        existingToken.created_by !== 'public-import') {
      return createErrorResponse('Access denied', 403);
    }

    const refreshedToken = await tokenService.refreshTokenInfo(tokenId);
    
    if (!refreshedToken) {
      return createNotFoundResponse('Token not found');
    }
    
    return createSuccessResponse(refreshedToken, 'Token information refreshed'); // 保留message，前端使用
    
  } catch (error) {
    console.error('Refresh token error:', error);
    return createErrorResponse('Failed to refresh token', 500);
  }
}

/**
 * Get token statistics
 */
export async function getTokenStatsHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const tokenService = new TokenService(env);
    const stats = await tokenService.getTokenStats();
    
    return createSuccessResponse(stats); // 移除message，前端未使用
    
  } catch (error) {
    console.error('Get token stats error:', error);
    return createErrorResponse('Failed to get token statistics', 500);
  }
}

/**
 * Share tokens to public pool (batch only)
 */
export async function shareTokenHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return await handleBatchShare(request, env, ctx);
}

/**
 * Handle batch token share
 */
async function handleBatchShare(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }

    const body = await request.json() as { tokenIds: string[] };
    const { tokenIds } = body;

    if (!Array.isArray(tokenIds) || tokenIds.length === 0) {
      return createErrorResponse('Token IDs array is required', 400);
    }

    const tokenService = new TokenService(env);
    const tokens = [];

    // Get all tokens and check permissions
    for (const tokenId of tokenIds) {
      const token = await tokenService.getTokenById(tokenId);
      // 跳过不存在的token, 跳过已经分享的token
      if (!token || token.is_shared) {
        continue; // Skip non-existent tokens
      }
      if (token.share_info) {
        // 有share信息，需要给这个token添加is_shared字段
        await tokenService.updateToken(tokenId, {
          is_shared: true
        });
        continue; 
      }

      // Check permission - allow access to tokens created by user or via public API
      if (user.role !== 'admin' &&
          token.created_by !== user.id &&
          token.created_by !== 'public-import') {
        continue; // Skip tokens without permission
      }

      tokens.push(token);
    }

    if (tokens.length === 0) {
      return createErrorResponse('No valid tokens to share', 400);
    }

    // Prepare tokens for external API
    const tokensToShare = tokens.map(token => ({
      tenant_url: token.tenant_url,
      access_token: token.access_token,
      portal_url: token.portal_url,
      email_note: token.email_note
    }));

    // Call external API
    const shareResponse = await fetch('https://public.ks666.win/api/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokensToShare)
    });

    const shareResult = await shareResponse.json() as any;

    if (!shareResult.success) {
      return createErrorResponse(shareResult.errors?.join(', ') || 'Failed to share tokens', 500);
    }

    // 处理跳过的Token（已经存在于公共池中）
    if (shareResult.skipped > 0) {
      // 计算哪些Token被跳过了
      const successfulCount = shareResult.email_card_pairs?.length || 0;
      const skippedTokens = tokens.slice(successfulCount, successfulCount + shareResult.skipped);
      const skippedEmails = skippedTokens.map(token => token.email_note).filter(email => email) as string[];

      // 获取跳过Token的激活码信息
      await handleBatchGetShareInfo(skippedEmails, env, ctx);
    }

    // Update tokens with sharing information
    const results = [];
    const cardPairs = shareResult.email_card_pairs || [];

    // Create a map of email to card pair for easier lookup
    const emailToCardPair = new Map();
    for (const cardPair of cardPairs) {
      if (cardPair && cardPair.email) {
        emailToCardPair.set(cardPair.email, cardPair);
      }
    }

    for (const token of tokens) {
      const cardPair = emailToCardPair.get(token.email_note);

      if (cardPair) {
        const shareInfo = {
          recharge_card: cardPair.recharge_card,
          deactivation_code: cardPair.deactivation_code
        };

        await tokenService.updateToken(token.id, {
          share_info: JSON.stringify(shareInfo),
          is_shared: true
        });

        results.push({
          id: token.id,
          email_note: token.email_note,
          recharge_card: cardPair.recharge_card,
          deactivation_code: cardPair.deactivation_code,
          success: true
        });
      } else {
        results.push({
          id: token.id,
          email_note: token.email_note,
          success: false,
          error: 'Failed to get card pair for this token'
        });
      }
    }

    return createSuccessResponse({
      message: `Batch share completed: ${results.filter(r => r.success).length}/${results.length} tokens shared successfully`,
      results,
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

  } catch (error) {
    console.error('Batch share error:', error);
    return createErrorResponse('Failed to batch share tokens', 500);
  }
}

export async function handleBatchGetShareInfo(
  emails: string[],
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  try {
    if (!emails || emails.length === 0) {
      return;
    }

    // 调用查询激活码接口
    const searchResponse = await fetch('https://public.ks666.win/api/public/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_notes: emails
      })
    });

    if (!searchResponse.ok) {
      console.error('Failed to search activation codes:', searchResponse.statusText);
      return;
    }

    const searchResult = await searchResponse.json() as any;

    if (!searchResult.success || !searchResult.data) {
      console.error('Search activation codes failed:', searchResult);
      return;
    }

    const tokenService = new TokenService(env);

    // 处理每个找到的激活码
    for (const item of searchResult.data) {
      if (item.found && item.activation_code) {
        // 根据email_note查找对应的token
        const tokens = await tokenService.getTokensByEmailNote(item.email_note);
        if (!tokens || tokens.length === 0) {
          console.error(`No tokens found for email: ${item.email_note}`);
          continue;
        }
        for (const token of tokens) {
          // 更新token的分享信息
          const shareInfo = {
            recharge_card: item.activation_code,
            deactivation_code: null // 查询接口不返回反激活码
          };

          await tokenService.updateToken(token.id, {
            share_info: JSON.stringify(shareInfo),
            is_shared: true
          });
        }
      }
    }

  } catch (error) {
    console.error('Handle batch get share info error:', error);
  }
}


/**
 * Reset recharge card for shared token
 */
export async function resetRechargeCardHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tokenId = pathParts[3]; // /api/tokens/{id}/reset-card

    if (!tokenId) {
      return createErrorResponse('Token ID is required', 400);
    }

    const tokenService = new TokenService(env);
    const token = await tokenService.getTokenById(tokenId);

    if (!token) {
      return createNotFoundResponse('Token not found');
    }

    // Check if user has permission to reset this token
    // Allow reset if:
    // 1. User is admin, OR
    // 2. Token was created by the current user, OR
    // 3. Token was created via public API (created_by === 'public-import')
    if (user.role !== 'admin' &&
        token.created_by !== user.id &&
        token.created_by !== 'public-import') {
      return createErrorResponse('Permission denied', 403);
    }

    // Check if token is shared
    const tokenShareInfo = token.share_info ? JSON.parse(token.share_info) : null;
    if (!tokenShareInfo?.recharge_card || !tokenShareInfo?.deactivation_code) {
      return createErrorResponse('Token is not shared', 400);
    }

    // Call reset API
    const resetResponse = await fetch('https://public.ks666.win/api/public/deactivate-card', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_note: token.email_note,
        deactivation_code: tokenShareInfo.deactivation_code
      })
    });

    if (!resetResponse.ok) {
      return createErrorResponse('Failed to reset recharge card', 500);
    }

    const resetResult = await resetResponse.json() as any;

    if (!resetResult.success) {
      return createErrorResponse('Failed to reset recharge card', 500);
    }

    // Update token with new recharge card
    const updatedShareInfo = {
      ...tokenShareInfo,
      recharge_card: resetResult.data.new_recharge_card
    };

    await tokenService.updateToken(tokenId, {
      share_info: JSON.stringify(updatedShareInfo)
    });

    return createSuccessResponse({
      message: 'Recharge card reset successfully',
      old_recharge_card: resetResult.data.old_recharge_card,
      new_recharge_card: resetResult.data.new_recharge_card,
      share_info: JSON.stringify(updatedShareInfo)
    });

  } catch (error) {
    console.error('Reset recharge card error:', error);
    return createErrorResponse('Failed to reset recharge card', 500);
  }
}

/**
 * Rebuild email indexes for legacy data migration
 */
export async function rebuildEmailIndexesHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return createErrorResponse('Admin access required', 403);
    }

    const tokenService = new TokenService(env);
    const result = await tokenService.rebuildAllEmailIndexes();

    return createSuccessResponse({
      message: 'Email indexes rebuilt successfully',
      processed: result.processed,
      indexed: result.indexed
    });

  } catch (error) {
    console.error('Rebuild email indexes error:', error);
    return createErrorResponse('Failed to rebuild email indexes', 500);
  }
}
