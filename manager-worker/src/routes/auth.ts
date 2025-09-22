import { Env, AuthenticatedRequest, LoginRequest } from '../types/index.js';
import {
  createSuccessResponse,
  createErrorResponse,
  parseJsonBody,
  createUnauthorizedResponse
} from '../utils/response.js';
import { getCurrentUser, getCurrentSession } from '../middleware/auth.js';
import { parseUserCredentials } from '../utils/auth.js';
import { OAuthHandlers } from '../oauth/handlers.js';

// Legacy OAuth functions removed - now using oauth module

// Legacy getAugmentAccessToken function removed - now using oauth module

/**
 * Login endpoint
 */
export async function loginHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    // 简单的请求体解析
    const requestText = await request.text();
    if (!requestText) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Request body is empty'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let body: LoginRequest;
    try {
      body = JSON.parse(requestText);
    } catch (e) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 基本验证
    if (!body.username || !body.password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Username and password are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查用户凭据配置
    if (!env.USER_CREDENTIALS) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User authentication not configured. Please set USER_CREDENTIALS in your configuration.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证用户凭据
    const credentials = parseUserCredentials(env.USER_CREDENTIALS);
    const storedPassword = credentials.get(body.username);
    if (!storedPassword || storedPassword !== body.password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid credentials'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 生成会话令牌
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时

    // 存储会话
    await env.SESSIONS_KV.put(
      `session:${sessionToken}`,
      JSON.stringify({
        userId: `user-${body.username}`,
        username: body.username,
        role: body.username === 'admin' ? 'admin' : 'user',
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      }),
      { expirationTtl: 24 * 60 * 60 }
    );

    // 返回成功响应
    return new Response(JSON.stringify({
      success: true,
      data: {
        user: {
          id: `user-${body.username}`,
          username: body.username,
          email: `${body.username}@example.com`,
          role: body.username === 'admin' ? 'admin' : 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        sessionToken: sessionToken,
        expiresIn: '24h'
      },
      message: 'Login successful'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Logout endpoint
 */
export async function logoutHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    // 提取会话令牌
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.substring(7);

      // 删除会话
      await env.SESSIONS_KV.delete(`session:${sessionToken}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Logout successful'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Logout error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Logout failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}



/**
 * Validate token endpoint (check if current token is valid)
 */
export async function validateTokenHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    const session = getCurrentSession(request);
    
    if (!user || !session) {
      return createUnauthorizedResponse('Invalid token');
    }
    
    return createSuccessResponse({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      session: {
        sessionId: session.sessionId,
        // 移除expiresAt，前端未使用
      },
    }); // 移除message，前端未使用
    
  } catch (error) {
    console.error('Validate token error:', error);
    return createUnauthorizedResponse('Token validation failed');
  }
}



/**
 * Generate Augment OAuth authorization URL with PKCE
 */
export async function generateUrlHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createUnauthorizedResponse('Authentication required');
    }

    // Use new OAuth module
    const oauthHandlers = new OAuthHandlers(env);
    return await oauthHandlers.handleAuthorize(request);

  } catch (error) {
    console.error('Generate URL error:', error);
    return createErrorResponse('生成授权URL失败: ' + (error instanceof Error ? error.message : 'Unknown error'), 500);
  }
}

/**
 * Validate OAuth authorization response
 */
export async function validateResponseHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createUnauthorizedResponse('Authentication required');
    }

    const body = await parseJsonBody<{
      auth_response: {
        code: string;
        state: string;
        tenant_url: string;
      };
      oauth_state: {
        code_verifier: string;
        code_challenge: string;
        state: string;
        creation_time: number;
      };
    }>(request);

    console.log('Validate response request:', {
      authResponse: body.auth_response,
      oauthState: body.oauth_state
    });

    // Validate state parameter to prevent CSRF attacks
    if (body.auth_response.state !== body.oauth_state.state) {
      console.error('State mismatch:', {
        authResponseState: body.auth_response.state,
        oauthStateState: body.oauth_state.state
      });
      return createErrorResponse('state参数不匹配，可能存在安全风险', 400);
    }

    // Validate OAuth state expiration (30 minutes)
    const currentTime = Date.now();
    const timeDiff = currentTime - body.oauth_state.creation_time;
    console.log('OAuth state time validation:', {
      currentTime,
      creationTime: body.oauth_state.creation_time,
      timeDiff,
      timeDiffMinutes: Math.round(timeDiff / (1000 * 60)),
      isExpired: timeDiff > 30 * 60 * 1000
    });

    if (timeDiff > 30 * 60 * 1000) {
      return createErrorResponse('OAuth状态已过期，请重新开始授权流程', 400);
    }

    // Use new OAuth module for token exchange
    const oauthHandlers = new OAuthHandlers(env);

    // Create code input in the expected format
    const codeInput = JSON.stringify({
      code: body.auth_response.code,
      state: body.auth_response.state,
      tenant_url: body.auth_response.tenant_url
    });

    // Convert frontend oauth_state to proper OAuthState format
    const oauthState = {
      codeVerifier: body.oauth_state.code_verifier,
      codeChallenge: body.oauth_state.code_challenge,
      state: body.oauth_state.state,
      creationTime: body.oauth_state.creation_time
    };

    // Create a mock request for the token handler
    const tokenRequest = new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code_input: codeInput,
        state: body.oauth_state.state,
        oauth_state: oauthState
      })
    });

    return await oauthHandlers.handleToken(tokenRequest);

  } catch (error) {
    console.error('Validate response error:', error);
    return createErrorResponse('获取access token失败: ' + (error instanceof Error ? error.message : 'Unknown error'), 500);
  }
}


