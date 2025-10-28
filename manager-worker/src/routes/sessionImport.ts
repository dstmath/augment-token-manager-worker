import { Env, AuthenticatedRequest, SessionImportRequest } from '../types/index.js';
import { TokenService } from '../services/tokenService.js';
import {
  createSuccessResponse,
  createErrorResponse,
  parseJsonBody,
} from '../utils/response.js';
import { getCurrentUser } from '../middleware/auth.js';

/**
 * Import token from ACE (Augment Code Extension) session
 * This endpoint extracts token information from a browser session cookie
 */
export async function importTokenFromSessionHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }

    const body = await parseJsonBody<SessionImportRequest>(request);

    if (!body.session_token) {
      return createErrorResponse('Session token is required', 400);
    }

    // Extract token information from session
    const tokenInfo = await extractTokenFromSession(body.session_token);

    if (!tokenInfo) {
      return createErrorResponse('Failed to extract token from session. Please ensure you are logged in to Augment Code.', 400);
    }

    // Validate extracted token data
    if (!tokenInfo.access_token) {
      return createErrorResponse('Invalid session: access token not found', 400);
    }

    if (!tokenInfo.tenant_url) {
      return createErrorResponse('Invalid session: tenant URL not found', 400);
    }

    // Create token record
    const tokenService = new TokenService(env);
    const token = await tokenService.createToken(
      {
        tenant_url: tokenInfo.tenant_url,
        access_token: tokenInfo.access_token,
        portal_url: tokenInfo.portal_url || '',
        email_note: body.email_note || tokenInfo.email || '',
      },
      user.id
    );

    return createSuccessResponse(
      token,
      'Token imported successfully from session',
      201
    );
  } catch (error) {
    console.error('Session import error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to import token from session',
      500
    );
  }
}

/**
 * Extract token information from ACE session token
 * The session token is typically stored in browser cookies or localStorage
 */
async function extractTokenFromSession(sessionToken: string): Promise<{
  access_token: string;
  tenant_url: string;
  portal_url?: string;
  email?: string;
} | null> {
  try {
    // Try to parse the session token as JWT or base64 encoded data
    // ACE typically stores session data in a specific format
    
    // First, try to decode as base64
    let sessionData: any;
    
    try {
      // Remove any Bearer prefix if present
      const cleanToken = sessionToken.replace(/^Bearer\s+/i, '');
      
      // Try to parse as JSON directly (if it's a JSON string)
      try {
        sessionData = JSON.parse(cleanToken);
      } catch {
        // Try base64 decode
        const decoded = atob(cleanToken);
        sessionData = JSON.parse(decoded);
      }
    } catch {
      // If not base64, try to parse JWT
      const parts = sessionToken.split('.');
      if (parts.length === 3) {
        // JWT format: header.payload.signature
        const payload = parts[1];
        // Add padding if needed
        const paddedPayload = payload + '='.repeat((4 - (payload.length % 4)) % 4);
        const decoded = atob(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'));
        sessionData = JSON.parse(decoded);
      } else {
        return null;
      }
    }

    // Extract token information from session data
    // ACE session typically contains: access_token, tenant_url, and optionally portal_url
    const access_token = sessionData.access_token || sessionData.accessToken || sessionData.token;
    const tenant_url = sessionData.tenant_url || sessionData.tenantUrl || sessionData.url;
    const portal_url = sessionData.portal_url || sessionData.portalUrl;
    const email = sessionData.email || sessionData.user?.email;

    if (!access_token || !tenant_url) {
      return null;
    }

    return {
      access_token,
      tenant_url,
      portal_url,
      email,
    };
  } catch (error) {
    console.error('Failed to extract token from session:', error);
    return null;
  }
}

/**
 * Batch import tokens from multiple sessions
 */
export async function batchImportFromSessionsHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }

    const body = await parseJsonBody<{ sessions: SessionImportRequest[] }>(request);

    if (!body.sessions || !Array.isArray(body.sessions)) {
      return createErrorResponse('Sessions array is required', 400);
    }

    if (body.sessions.length === 0) {
      return createErrorResponse('At least one session is required', 400);
    }

    if (body.sessions.length > 50) {
      return createErrorResponse('Maximum 50 sessions allowed per batch', 400);
    }

    const tokenService = new TokenService(env);
    const results = {
      success: [] as any[],
      failed: [] as any[],
    };

    for (const sessionReq of body.sessions) {
      try {
        if (!sessionReq.session_token) {
          results.failed.push({
            session: sessionReq,
            error: 'Session token is required',
          });
          continue;
        }

        const tokenInfo = await extractTokenFromSession(sessionReq.session_token);

        if (!tokenInfo || !tokenInfo.access_token || !tokenInfo.tenant_url) {
          results.failed.push({
            session: sessionReq,
            error: 'Failed to extract valid token from session',
          });
          continue;
        }

        const token = await tokenService.createToken(
          {
            tenant_url: tokenInfo.tenant_url,
            access_token: tokenInfo.access_token,
            portal_url: tokenInfo.portal_url || '',
            email_note: sessionReq.email_note || tokenInfo.email || '',
          },
          user.id
        );

        results.success.push(token);
      } catch (error) {
        results.failed.push({
          session: sessionReq,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return createSuccessResponse(
      {
        imported: results.success.length,
        failed: results.failed.length,
        success: results.success,
        errors: results.failed,
      },
      `Batch session import completed. ${results.success.length} tokens imported, ${results.failed.length} failed.`
    );
  } catch (error) {
    console.error('Batch session import error:', error);
    return createErrorResponse('Failed to batch import from sessions', 500);
  }
}

