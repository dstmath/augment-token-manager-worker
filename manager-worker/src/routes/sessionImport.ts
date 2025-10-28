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
 * Extract token information from ACE session cookie
 * This uses the Augment OAuth flow with the session cookie
 */
async function extractTokenFromSession(sessionToken: string): Promise<{
  access_token: string;
  tenant_url: string;
  portal_url?: string;
  email?: string;
} | null> {
  try {
    // Clean the session token
    const cleanSession = sessionToken.trim();

    // Generate PKCE parameters
    const codeVerifier = generateRandomString(32);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateRandomString(42);
    const clientId = 'vscode-augment';
    const authBaseUrl = 'https://auth.augmentcode.com';

    // Step 1: Access terms-accept page with session cookie to get authorization code
    const termsUrl = `${authBaseUrl}/terms-accept?response_type=code&code_challenge=${codeChallenge}&client_id=${clientId}&state=${state}&prompt=login`;

    const termsResponse = await fetch(termsUrl, {
      method: 'GET',
      headers: {
        'Cookie': `session=${cleanSession}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!termsResponse.ok) {
      console.error('Failed to fetch terms page:', termsResponse.status);
      return null;
    }

    const html = await termsResponse.text();

    // Step 2: Extract code, state, and tenant_url from HTML using regex
    const codeMatch = html.match(/code:\s*"([^"]+)"/);
    const stateMatch = html.match(/state:\s*"([^"]+)"/);
    const tenantUrlMatch = html.match(/tenant_url:\s*"([^"]+)"/);

    if (!codeMatch || !stateMatch || !tenantUrlMatch) {
      console.error('Failed to extract OAuth parameters from HTML');
      return null;
    }

    const code = codeMatch[1];
    const extractedState = stateMatch[1];
    const tenantUrl = tenantUrlMatch[1];

    console.log('Extracted OAuth parameters:', { code: code.substring(0, 10) + '...', tenantUrl });

    // Step 3: Exchange authorization code for access token
    const tokenUrl = `${tenantUrl}token`;
    const tokenPayload = {
      grant_type: 'authorization_code',
      client_id: clientId,
      code_verifier: codeVerifier,
      redirect_uri: '',
      code: code,
    };

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenPayload),
    });

    if (!tokenResponse.ok) {
      console.error('Failed to exchange token:', tokenResponse.status);
      return null;
    }

    const tokenData = await tokenResponse.json() as any;

    if (!tokenData.access_token) {
      console.error('No access token in response');
      return null;
    }

    return {
      access_token: tokenData.access_token,
      tenant_url: tenantUrl,
      portal_url: undefined,
      email: undefined,
    };
  } catch (error) {
    console.error('Failed to extract token from session:', error);
    return null;
  }
}

/**
 * Generate a random string for PKCE
 */
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }

  return result;
}

/**
 * Generate code challenge for PKCE
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);

  // Convert to base64url
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
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

