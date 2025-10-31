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

    console.log('Starting session import for user:', user.id);

    // Extract token information from session
    const tokenInfo = await extractTokenFromSession(body.session_token);

    if (!tokenInfo) {
      return createErrorResponse(
        'Failed to extract token from session. Please check: 1) Session cookie is valid and not expired, 2) You are logged in to auth.augmentcode.com, 3) Account is not banned. Check server logs for details.',
        400
      );
    }

    // Validate extracted token data
    if (!tokenInfo.access_token) {
      return createErrorResponse('Invalid session: access token not found', 400);
    }

    if (!tokenInfo.tenant_url) {
      return createErrorResponse('Invalid session: tenant URL not found', 400);
    }

    console.log('Successfully extracted token, creating record...');

    // Create token record with auth_session for credit tracking
    const tokenService = new TokenService(env);
    let token = await tokenService.createToken(
      {
        tenant_url: tokenInfo.tenant_url,
        access_token: tokenInfo.access_token,
        portal_url: tokenInfo.portal_url || '',
        email_note: body.email_note || tokenInfo.email || '',
        auth_session: body.session_token, // Save auth session for credit consumption tracking
      },
      user.id
    );

    // Automatically refresh portal info after creation
    if (token.portal_url) {
      console.log('Refreshing portal info for newly imported token...');
      try {
        token = await tokenService.refreshTokenInfo(token.id) || token;
        console.log('Portal info refreshed successfully');
      } catch (error) {
        console.error('Failed to refresh portal info:', error);
        // Don't fail the import if portal refresh fails
      }
    }

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
    // Clean the session token and decode if needed
    let cleanSession = sessionToken.trim();

    // Try to decode if it's URL encoded
    try {
      const decoded = decodeURIComponent(cleanSession);
      if (decoded !== cleanSession) {
        console.log('Session token was URL encoded, using decoded version');
        cleanSession = decoded;
      }
    } catch (e) {
      // Not URL encoded, use as is
    }

    console.log('Starting session import, session length:', cleanSession.length);

    // Generate PKCE parameters
    const codeVerifier = generateRandomString(32);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateRandomString(42);
    const clientId = 'v'; // Augment OAuth client ID
    const authBaseUrl = 'https://auth.augmentcode.com';

    // Step 1: Access terms-accept page with session cookie to get authorization code
    const termsUrl = `${authBaseUrl}/terms-accept?response_type=code&code_challenge=${codeChallenge}&client_id=${clientId}&state=${state}&prompt=login`;

    console.log('Fetching terms page...');
    const termsResponse = await fetch(termsUrl, {
      method: 'GET',
      headers: {
        'Cookie': `session=${cleanSession}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    console.log('Terms page response status:', termsResponse.status);

    if (!termsResponse.ok) {
      console.error('Failed to fetch terms page:', termsResponse.status, termsResponse.statusText);
      const errorText = await termsResponse.text();
      console.error('Error response:', errorText.substring(0, 500));
      return null;
    }

    const html = await termsResponse.text();
    console.log('Received HTML, length:', html.length);

    // Log a snippet of the HTML to debug
    console.log('HTML snippet:', html.substring(0, 500));

    // Step 2: Extract code, state, and tenant_url from HTML using regex
    // Try multiple regex patterns
    let codeMatch = html.match(/code:\s*"([^"]+)"/);
    let stateMatch = html.match(/state:\s*"([^"]+)"/);
    let tenantUrlMatch = html.match(/tenant_url:\s*"([^"]+)"/);

    // Try alternative patterns if first attempt fails
    if (!codeMatch) {
      codeMatch = html.match(/code["\s:]+([a-zA-Z0-9_-]+)/);
    }
    if (!stateMatch) {
      stateMatch = html.match(/state["\s:]+([a-zA-Z0-9_-]+)/);
    }
    if (!tenantUrlMatch) {
      tenantUrlMatch = html.match(/tenant_url["\s:]+(https?:\/\/[^"'\s]+)/);
    }

    if (!codeMatch || !stateMatch || !tenantUrlMatch) {
      console.error('Failed to extract OAuth parameters from HTML');
      console.error('Code match:', !!codeMatch, 'State match:', !!stateMatch, 'Tenant URL match:', !!tenantUrlMatch);

      // Check if we got a login page instead
      if (html.includes('login') || html.includes('sign in') || html.includes('Sign In')) {
        console.error('Received login page - session may be invalid or expired');
      }

      return null;
    }

    const code = codeMatch[1];
    const extractedState = stateMatch[1];
    const tenantUrl = tenantUrlMatch[1];

    console.log('Extracted OAuth parameters:', {
      code: code.substring(0, 10) + '...',
      state: extractedState.substring(0, 10) + '...',
      tenantUrl
    });

    // Step 3: Exchange authorization code for access token
    const tokenUrl = `${tenantUrl}token`;
    const tokenPayload = {
      grant_type: 'authorization_code',
      client_id: clientId,
      code_verifier: codeVerifier,
      redirect_uri: '',
      code: code,
    };

    console.log('Exchanging code for token at:', tokenUrl);
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenPayload),
    });

    console.log('Token exchange response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      console.error('Failed to exchange token:', tokenResponse.status, tokenResponse.statusText);
      const errorText = await tokenResponse.text();
      console.error('Token exchange error:', errorText);
      return null;
    }

    const tokenData = await tokenResponse.json() as any;
    console.log('Token data received:', { hasAccessToken: !!tokenData.access_token });

    if (!tokenData.access_token) {
      console.error('No access token in response:', tokenData);
      return null;
    }

    console.log('Successfully extracted access token, now fetching portal URL and email...');

    // Step 4: Try to get portal_url and email using auth session
    let portalUrl: string | undefined = undefined;
    let email: string | undefined = undefined;

    try {
      // Method 1: Try to fetch directly with auth session (PRIMARY METHOD)
      // Based on logs: app.augmentcode.com APIs require auth session, not app session
      console.log('🔥🔥🔥 CODE VERSION: 2024-10-31-v2 🔥🔥🔥');
      console.log('Method 1: Trying to fetch directly with auth session...');
      const [userInfo, subscriptionInfo] = await Promise.all([
        fetchAppUserWithAuthSession(cleanSession),
        fetchAppSubscriptionWithAuthSession(cleanSession),
      ]);

      email = userInfo?.email;
      portalUrl = subscriptionInfo?.portalUrl;

      console.log('User info fetched via auth session:', { hasEmail: !!email, hasPortalUrl: !!portalUrl });

      // If Method 1 failed, try Method 2
      if (!email || !portalUrl) {
        console.log('Method 2: Trying to exchange auth session for app session...');
        try {
          const appSession = await exchangeAuthSessionForAppSession(cleanSession);
          console.log('App session obtained successfully, fetching user info...');

          // Fetch user info and subscription info in parallel
          const [userInfo2, subscriptionInfo2] = await Promise.all([
            fetchAppUser(appSession),
            fetchAppSubscription(appSession),
          ]);

          if (!email) email = userInfo2?.email;
          if (!portalUrl) portalUrl = subscriptionInfo2?.portalUrl;

          console.log('User info fetched via app session:', { hasEmail: !!email, hasPortalUrl: !!portalUrl });
        } catch (appSessionError) {
          console.error('Failed to use app session method:', appSessionError);
        }
      }
    } catch (error) {
      console.error('Failed to fetch portal URL and email (all methods):', error);
      // Don't fail the entire import if we can't get portal info
      // The token is still valid, just missing some metadata
    }

    console.log('Successfully extracted token from session');
    return {
      access_token: tokenData.access_token,
      tenant_url: tenantUrl,
      portal_url: portalUrl,
      email: email,
    };
  } catch (error) {
    console.error('Failed to extract token from session - Exception:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
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

        let token = await tokenService.createToken(
          {
            tenant_url: tokenInfo.tenant_url,
            access_token: tokenInfo.access_token,
            portal_url: tokenInfo.portal_url || '',
            email_note: sessionReq.email_note || tokenInfo.email || '',
            auth_session: sessionReq.session_token, // Save auth session for credit tracking
          },
          user.id
        );

        // Automatically refresh portal info after creation
        if (token.portal_url) {
          try {
            token = await tokenService.refreshTokenInfo(token.id) || token;
          } catch (error) {
            console.error(`Failed to refresh portal info for token ${token.id}:`, error);
            // Don't fail the import if portal refresh fails
          }
        }

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

/**
 * Exchange auth session for app session
 * This mimics the browser's login flow to get the app session cookie
 */
async function exchangeAuthSessionForAppSession(authSession: string): Promise<string> {
  console.log('Exchanging auth session for app session...');

  // Step 1: Visit app.augmentcode.com/login with auth session cookie
  // This triggers the OAuth flow and sets the _session cookie
  const loginResponse = await fetch('https://app.augmentcode.com/login', {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': `session=${authSession}`,
    },
    redirect: 'manual', // Don't follow redirects automatically
  });

  console.log('Login response status:', loginResponse.status);
  console.log('Login response headers:', JSON.stringify([...loginResponse.headers.entries()]));

  // Extract _session cookie from Set-Cookie header
  // Note: Cloudflare Workers may not expose Set-Cookie in headers.get()
  // Try to get all Set-Cookie headers
  const setCookieHeaders: string[] = [];
  loginResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      setCookieHeaders.push(value);
    }
  });

  console.log('Set-Cookie headers found:', setCookieHeaders.length);

  for (const setCookieHeader of setCookieHeaders) {
    console.log('Set-Cookie header:', setCookieHeader.substring(0, 100));
    const sessionMatch = setCookieHeader.match(/_session=([^;]+)/);
    if (sessionMatch) {
      const appSession = decodeURIComponent(sessionMatch[1]);
      console.log('App session extracted from login response');
      return appSession;
    }
  }

  // Also try the standard way
  const setCookieHeader = loginResponse.headers.get('set-cookie');
  if (setCookieHeader) {
    console.log('Set-Cookie from headers.get():', setCookieHeader.substring(0, 100));
    const sessionMatch = setCookieHeader.match(/_session=([^;]+)/);
    if (sessionMatch) {
      const appSession = decodeURIComponent(sessionMatch[1]);
      console.log('App session extracted from login response (standard way)');
      return appSession;
    }
  }

  // Step 2: If not found in login response, try /api/user
  console.log('App session not found in login response, trying /api/user...');
  const userResponse = await fetch('https://app.augmentcode.com/api/user', {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Cookie': `session=${authSession}`,
    },
  });

  console.log('User API response status:', userResponse.status);
  console.log('User API response headers:', JSON.stringify([...userResponse.headers.entries()]));

  const userSetCookie = userResponse.headers.get('set-cookie');
  if (userSetCookie) {
    console.log('User API Set-Cookie:', userSetCookie.substring(0, 100));
    const sessionMatch = userSetCookie.match(/_session=([^;]+)/);
    if (sessionMatch) {
      const appSession = decodeURIComponent(sessionMatch[1]);
      console.log('App session extracted from user API response');
      return appSession;
    }
  }

  throw new Error('Failed to extract app session cookie from response. Check logs for details.');
}

/**
 * Fetch user information from app.augmentcode.com
 */
async function fetchAppUser(appSession: string): Promise<{ email?: string } | null> {
  try {
    console.log('Fetching user info from app.augmentcode.com...');
    const response = await fetch('https://app.augmentcode.com/api/user', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Cookie': `_session=${encodeURIComponent(appSession)}`,
      },
    });

    console.log('User API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch user info:', response.status, errorText.substring(0, 200));
      return null;
    }

    const data = await response.json() as any;
    console.log('User data received:', JSON.stringify(data));
    console.log('User info fetched:', { hasEmail: !!data.email, email: data.email });
    return {
      email: data.email,
    };
  } catch (error) {
    console.error('Error fetching user info:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message, error.stack);
    }
    return null;
  }
}

/**
 * Fetch subscription information from app.augmentcode.com
 */
async function fetchAppSubscription(appSession: string): Promise<{ portalUrl?: string } | null> {
  try {
    console.log('Fetching subscription info from app.augmentcode.com...');
    console.log('App session length:', appSession.length);
    console.log('App session preview:', appSession.substring(0, 20) + '...');

    const response = await fetch('https://app.augmentcode.com/api/subscription', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Cookie': `_session=${encodeURIComponent(appSession)}`,
      },
    });

    console.log('Subscription API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch subscription info:', response.status, errorText.substring(0, 200));
      return null;
    }

    const data = await response.json() as any;
    console.log('Subscription data received:', JSON.stringify(data));
    console.log('Subscription info fetched:', { hasPortalUrl: !!data.portalUrl, portalUrl: data.portalUrl });
    return {
      portalUrl: data.portalUrl,
    };
  } catch (error) {
    console.error('Error fetching subscription info:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message, error.stack);
    }
    return null;
  }
}

/**
 * Fetch user information using auth session directly
 */
async function fetchAppUserWithAuthSession(authSession: string): Promise<{ email?: string } | null> {
  try {
    console.log('🚀🚀🚀 fetchAppUserWithAuthSession CALLED - v2024-10-31 🚀🚀🚀');
    console.log('Fetching user info with auth session...');
    console.log('Auth session length:', authSession.length);

    // Try multiple cookie formats - prioritize session cookie based on 401 error
    const cookieFormats = [
      { name: 'session (raw)', value: `session=${authSession}` },
      { name: 'session (encoded)', value: `session=${encodeURIComponent(authSession)}` },
      { name: '_session (raw)', value: `_session=${authSession}` },
      { name: '_session (encoded)', value: `_session=${encodeURIComponent(authSession)}` },
    ];

    for (let i = 0; i < cookieFormats.length; i++) {
      const format = cookieFormats[i];
      console.log(`User API attempt ${i + 1} [${format.name}]: Trying...`);

      const response = await fetch('https://app.augmentcode.com/api/user', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': format.value,
        },
      });

      console.log(`User API attempt ${i + 1}: Response status:`, response.status);

      if (response.ok) {
        const data = await response.json() as any;
        console.log(`User API attempt ${i + 1}: ✅ SUCCESS! Data:`, JSON.stringify(data));

        if (data.email) {
          console.log(`✅ Email found with ${format.name}:`, data.email);
          return {
            email: data.email,
          };
        } else {
          console.log('⚠️ Response OK but no email in data');
        }
      } else {
        const errorText = await response.text();
        console.log(`User API attempt ${i + 1}: ❌ Failed:`, errorText.substring(0, 200));
      }
    }

    console.error('❌ All attempts failed to fetch user info');
    return null;
  } catch (error) {
    console.error('Error fetching user info with auth session:', error);
    return null;
  }
}

/**
 * Fetch subscription information using auth session directly
 */
async function fetchAppSubscriptionWithAuthSession(authSession: string): Promise<{ portalUrl?: string } | null> {
  try {
    console.log('🎯🎯🎯 fetchAppSubscriptionWithAuthSession CALLED - v2024-10-31 🎯🎯🎯');
    console.log('Fetching subscription info with auth session...');
    console.log('Auth session length:', authSession.length);
    console.log('Auth session first 30 chars:', authSession.substring(0, 30));

    // Try multiple cookie formats - prioritize session cookie based on 401 error
    const cookieFormats = [
      { name: 'session (raw)', value: `session=${authSession}` },
      { name: 'session (encoded)', value: `session=${encodeURIComponent(authSession)}` },
      { name: '_session (raw)', value: `_session=${authSession}` },
      { name: '_session (encoded)', value: `_session=${encodeURIComponent(authSession)}` },
    ];

    for (let i = 0; i < cookieFormats.length; i++) {
      const format = cookieFormats[i];
      console.log(`Subscription API attempt ${i + 1} [${format.name}]: Trying...`);

      const response = await fetch('https://app.augmentcode.com/api/subscription', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': format.value,
        },
      });

      console.log(`Subscription API attempt ${i + 1}: Response status:`, response.status);

      if (response.ok) {
        const data = await response.json() as any;
        console.log(`Subscription API attempt ${i + 1}: ✅ SUCCESS! Data:`, JSON.stringify(data));

        if (data.portalUrl) {
          console.log(`✅ Portal URL found with ${format.name}:`, data.portalUrl);
          return {
            portalUrl: data.portalUrl,
          };
        } else {
          console.log('⚠️ Response OK but no portalUrl in data');
        }
      } else {
        const errorText = await response.text();
        console.log(`Subscription API attempt ${i + 1}: ❌ Failed:`, errorText.substring(0, 200));
      }
    }

    console.error('❌ All attempts failed to fetch subscription info');
    return null;
  } catch (error) {
    console.error('Error fetching subscription info with auth session:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    return null;
  }
}

/**
 * Public API: Import token from session (for third-party integration)
 * This endpoint is public and does not require authentication
 * It takes the first session from the sessions array and optional portalUrl
 */
export async function publicImportSessionHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body = await parseJsonBody<{ sessions: string[]; portalUrl?: string }>(request);

    // Validate request body
    if (!body.sessions || !Array.isArray(body.sessions)) {
      return createErrorResponse('sessions 数组是必需的', 400);
    }

    if (body.sessions.length === 0) {
      return createErrorResponse('sessions 数组不能为空', 400);
    }

    // Only take the first session
    const sessionToken = body.sessions[0];
    const providedPortalUrl = body.portalUrl;

    if (!sessionToken || typeof sessionToken !== 'string') {
      return createErrorResponse('Session token 无效', 400);
    }

    console.log('Public session import started');
    console.log('Session token length:', sessionToken.length);
    console.log('Provided portalUrl:', providedPortalUrl || '未提供');

    // Extract token information from session
    const tokenInfo = await extractTokenFromSession(sessionToken);

    if (!tokenInfo) {
      return createErrorResponse(
        '从 Session 提取 Token 失败。请检查：1) Session cookie 有效且未过期，2) 已登录 auth.augmentcode.com，3) 账户未被封禁',
        400
      );
    }

    // Validate extracted token data
    if (!tokenInfo.access_token) {
      return createErrorResponse('无效的 Session：未找到 access token', 400);
    }

    if (!tokenInfo.tenant_url) {
      return createErrorResponse('无效的 Session：未找到 tenant URL', 400);
    }

    console.log('Successfully extracted token from session');

    // Use provided portalUrl if available, otherwise use extracted one
    const finalPortalUrl = providedPortalUrl || tokenInfo.portal_url || '';

    // Create token record with auth_session for credit tracking
    // Use a default user ID for public imports
    const publicUserId = 'public-import';
    const tokenService = new TokenService(env);

    let token = await tokenService.createToken(
      {
        tenant_url: tokenInfo.tenant_url,
        access_token: tokenInfo.access_token,
        portal_url: finalPortalUrl,
        email_note: tokenInfo.email || '',
        auth_session: sessionToken, // Save auth session for credit consumption tracking
      },
      publicUserId
    );

    // Automatically refresh portal info after creation if portal_url exists
    if (token.portal_url) {
      console.log('Refreshing portal info for newly imported token...');
      try {
        token = await tokenService.refreshTokenInfo(token.id) || token;
        console.log('Portal info refreshed successfully');
      } catch (error) {
        console.error('Failed to refresh portal info:', error);
        // Don't fail the import if portal refresh fails
      }
    }

    // Build success message
    const message = `成功 1 个，失败 0 个`;

    return createSuccessResponse(
      {
        imported: 1,
        failed: 0,
        success: [token],
        errors: [],
      },
      message,
      201
    );
  } catch (error) {
    console.error('Public session import error:', error);

    // Build error message
    const errorMessage = error instanceof Error ? error.message : '导入失败';
    const message = `成功 0 个，失败 1 个`;

    return createErrorResponse(
      message + ' - ' + errorMessage,
      500
    );
  }
}
